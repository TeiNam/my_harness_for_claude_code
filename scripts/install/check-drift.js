#!/usr/bin/env node
'use strict';

/**
 * check-drift.js — Report drift between repo asset selection and what is
 * actually symlinked into $CLAUDE_HOME.
 *
 * Motivation: the install ran once long ago with only a few assets tagged, so
 * the global ~/.claude ended up near-empty while hooks were fully injected by
 * another path. There was no way to *notice* that without a manual `ls`. This
 * gives a one-shot health check: for the selected workloads, is every asset
 * the repo would install actually linked, and does each link still point at
 * the repo source?
 *
 * It reads only — it never creates, removes, or rewrites links. When drift is
 * found it prints what to run (`./install.sh --force ...`) and exits non-zero
 * so it can gate CI or a session-start nudge.
 *
 * Usage:
 *   node scripts/install/check-drift.js [--workload=a,b] [--skip-workload=a,b]
 *   node scripts/install/check-drift.js --json
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const { selectAssets } = require('./select-assets');

function parseArgs(argv) {
  const flags = { workload: null, skipWorkload: null, json: false, root: null, claudeHome: null };
  for (const a of argv.slice(2)) {
    const eq = a.indexOf('=');
    const key = eq === -1 ? a : a.slice(0, eq);
    const val = eq === -1 ? null : a.slice(eq + 1);
    const list = v =>
      v
        ? v
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
        : [];
    switch (key) {
      case '--workload':
      case '--workloads':
        flags.workload = list(val);
        break;
      case '--skip-workload':
      case '--skip-workloads':
        flags.skipWorkload = list(val);
        break;
      case '--json':
        flags.json = true;
        break;
      case '--root':
        flags.root = val;
        break;
      case '--claude-home':
        flags.claudeHome = val;
        break;
      case '-h':
      case '--help':
        flags.help = true;
        break;
      default:
        throw new Error(`Unknown flag: ${a}`);
    }
  }
  return flags;
}

function classifyLink(absSource, absTarget) {
  // Returns one of: 'ok' | 'missing' | 'wrong-target' | 'broken' | 'not-a-link'
  let lst;
  try {
    lst = fs.lstatSync(absTarget);
  } catch {
    return 'missing';
  }
  if (!lst.isSymbolicLink()) return 'not-a-link';
  let dest;
  try {
    dest = fs.readlinkSync(absTarget);
  } catch {
    return 'broken';
  }
  if (path.resolve(path.dirname(absTarget), dest) !== path.resolve(absSource)) {
    return 'wrong-target';
  }
  if (!fs.existsSync(absTarget)) return 'broken'; // dangling — source gone
  return 'ok';
}

/**
 * Every link under the asset folders that points into this repo, relative to
 * $CLAUDE_HOME. Needed because the selection-driven check above can only see
 * assets the repo still declares: a link left behind after an asset is deleted,
 * renamed, or moved out of an installed folder is invisible to it. Those
 * leftovers matter — a stale rule link that still resolves keeps getting loaded
 * into every session.
 *
 * Ownership is decided by where the link points, not by the folder it sits in:
 * skills install as `skills/<name>` rather than under `_harness/`, and links
 * pointing outside the repo belong to other plugins or the user.
 */
function listInstalledLinks(claudeHome, root) {
  const found = [];
  const insideRepo = target => {
    const abs = path.resolve(root);
    const resolved = path.resolve(target);
    return resolved === abs || resolved.startsWith(abs + path.sep);
  };

  // Scope matters: only the two shapes the installer creates are ours. Recursing
  // everywhere would also collect links a user placed *inside* their own skill,
  // and uninstall would then delete them.
  //   1. <kind>/_harness/**        — agents, commands, rules (nested)
  //   2. skills/<name>             — skills, linked as a direct child
  // Only skills install as a direct child, so the other folders' top level is
  // user territory and is left unscanned.
  const walk = (dir, recurse) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      // A missing folder just means nothing of that kind is installed. Any
      // other error (permissions, I/O) must not read as "no orphans".
      if (e.code === 'ENOENT') return;
      throw e;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        let target;
        try {
          target = fs.readlinkSync(abs);
        } catch {
          continue;
        }
        const resolved = path.isAbsolute(target) ? target : path.resolve(path.dirname(abs), target);
        // targetRel values are built with forward slashes, so normalize before
        // comparing — on Windows path.relative() would otherwise return
        // backslashes and every healthy link would read as an orphan.
        if (insideRepo(resolved)) found.push(path.relative(claudeHome, abs).split(path.sep).join('/'));
        continue;
      }
      if (entry.isDirectory() && recurse) walk(abs, true);
    }
  };

  for (const kind of ['agents', 'commands', 'skills', 'rules']) {
    walk(path.join(claudeHome, kind, '_harness'), true);
  }
  walk(path.join(claudeHome, 'skills'), false);
  return found;
}

function main(argv) {
  const flags = parseArgs(argv);
  if (flags.help) {
    console.log(
      [
        'check-drift.js — report drift between repo asset selection and ~/.claude links',
        '',
        'Flags:',
        '  --workload=a,b       Limit to these workload groups (default: all)',
        '  --skip-workload=a,b  Drop groups from the resolved set',
        '  --json               Machine-readable output',
        '  --claude-home=PATH   Override $CLAUDE_HOME'
      ].join('\n')
    );
    return 0;
  }

  const root = flags.root || path.resolve(__dirname, '..', '..');
  const claudeHome = flags.claudeHome || process.env.CLAUDE_HOME || path.join(os.homedir(), '.claude');

  // --workload 미지정 시 설치 매니페스트의 워크로드를 기본값으로 사용한다.
  // 전 그룹 검사로 폴백하면 수동 전용 그룹(lab)이 영구 오탐 드리프트로 잡힌다.
  let workload = flags.workload;
  if (!workload) {
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(claudeHome, '_harness-manifest.json'), 'utf8'));
      if (Array.isArray(manifest.workloads) && manifest.workloads.length) workload = manifest.workloads;
    } catch {
      /* 매니페스트 없음 — 전 그룹 검사로 폴백 */
    }
  }

  const { selected, activeGroups } = selectAssets({
    root,
    workload,
    skipWorkload: flags.skipWorkload
  });

  const buckets = { ok: [], missing: [], 'wrong-target': [], broken: [], 'not-a-link': [], orphan: [] };
  for (const a of selected) {
    const absSource = path.join(root, a.sourceRel);
    const absTarget = path.join(claudeHome, a.targetRel);
    buckets[classifyLink(absSource, absTarget)].push(a.targetRel);
  }

  // Orphans are judged against everything the repo *could* install, not against
  // the workload subset being checked — otherwise `--workload=core` would report
  // every other workload's healthy links as orphans and tell you to uninstall.
  const declared = new Set(selectAssets({ root }).selected.map(a => a.targetRel));
  for (const rel of listInstalledLinks(claudeHome, root)) {
    if (!declared.has(rel)) buckets.orphan.push(rel);
  }

  const drift =
    buckets.missing.length +
    buckets['wrong-target'].length +
    buckets.broken.length +
    buckets['not-a-link'].length +
    buckets.orphan.length;

  if (flags.json) {
    console.log(JSON.stringify({ activeGroups, selected: selected.length, drift, buckets }, null, 2));
    return drift === 0 ? 0 : 1;
  }

  console.log(`workloads: ${activeGroups.join(', ')}`);
  console.log(`selected assets: ${selected.length}  |  linked ok: ${buckets.ok.length}  |  drift: ${drift}`);
  for (const kind of ['missing', 'wrong-target', 'broken', 'not-a-link', 'orphan']) {
    if (!buckets[kind].length) continue;
    console.log(`\n  ${kind} (${buckets[kind].length}):`);
    buckets[kind].slice(0, 30).forEach(t => console.log(`    - ${t}`));
    if (buckets[kind].length > 30) console.log(`    … +${buckets[kind].length - 30} more`);
  }

  if (drift > 0) {
    const wl = flags.workload && flags.workload.length ? ` --workload=${flags.workload.join(',')}` : '';
    // A command that omits CLAUDE_HOME would operate on the default ~/.claude —
    // i.e. wipe a different install than the one just inspected.
    const home = claudeHome === path.join(os.homedir(), '.claude') ? '' : `CLAUDE_HOME=${claudeHome} `;
    console.log(`\nDrift detected. Re-sync with:\n  ${home}./install.sh --force${wl}`);
    if (buckets.orphan.length) {
      // --uninstall clears everything the harness installed, so the re-install
      // must name the same workloads (otherwise the menu/--all decides for you)
      // and re-apply the optional hook stack if it was in use. Spell both out —
      // an incomplete instruction here costs the user their setup.
      const restoreWl = wl || (activeGroups.length ? ` --workload=${activeGroups.join(',')}` : '');
      console.log(
        '\n  orphan links are not removed by --force (it only re-links what the repo declares).' +
          `\n  Clear them with:\n    ${home}./install.sh --uninstall && ${home}./install.sh${restoreWl}` +
          '\n  Note: --uninstall drops every harness link and hook. Re-run with the same' +
          `\n  workloads (above), and add \`${home}node scripts/install/merge-hooks.js --optional\`` +
          '\n  afterwards if you were running the optional hook stack.'
      );
    }
    return 1;
  }
  console.log('\nNo drift — global install matches the repo selection.');
  return 0;
}

if (require.main === module) {
  try {
    process.exit(main(process.argv));
  } catch (e) {
    process.stderr.write(`[check-drift] ${e.message}\n`);
    process.exit(2);
  }
}

module.exports = { classifyLink, parseArgs };
