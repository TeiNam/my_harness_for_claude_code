#!/usr/bin/env node
'use strict';

/**
 * select-assets.js — Resolve which asset files should be symlinked into
 * ~/.claude based on the user's workload selection.
 *
 * Asset taxonomy:
 *   - agents/<name>.md          → ~/.claude/agents/_harness/<name>.md
 *   - commands/<name>.md        → ~/.claude/commands/_harness/<name>.md
 *   - skills/<dir>/             → ~/.claude/skills/_harness/<dir>      (whole dir)
 *   - rules/<group>/<file>.md   → ~/.claude/rules/_harness/<group>/<file>.md
 *
 * For agents/commands/rules we link individual files. For skills we link the
 * whole skill directory because skills can carry multiple resource files
 * alongside SKILL.md and we don't want to enumerate them.
 *
 * Each asset's `workloads:` frontmatter (added by tag-assets.js) decides
 * which groups it belongs to. If the asset has no frontmatter or no
 * `workloads:` line, we fall back to the workloads heuristic in
 * `workloads.js` (rule files use folder-based classification).
 *
 * Selection rules:
 *   1. CLI flags: --workload=a,b  /  --skip-workload=a,b
 *   2. Default: every group enabled
 *   3. After resolving the active group set, an asset is selected when its
 *      classified groups intersect that set.
 *
 * CLI:
 *   node scripts/install/select-assets.js [--workload=...] [--skip-workload=...]
 *     [--format=lines|json] [--root=<repo>]
 *
 * Default --format=lines emits one entry per line:
 *   <kind>\t<repo-relative-source>\t<.claude-relative-target>
 * which install.sh consumes directly.
 */

const fs = require('fs');
const path = require('path');

const {
  GROUPS,
  classify,
  classifyRulePath,
  identifierOf,
  validateGroups,
} = require('./workloads');

function parseList(value) {
  if (!value) return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const flags = {
    workload: null,
    skipWorkload: null,
    format: 'lines',
    root: null,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    let key = a;
    let value = null;
    const eq = a.indexOf('=');
    if (eq !== -1) {
      key = a.slice(0, eq);
      value = a.slice(eq + 1);
    }
    switch (key) {
      case '--workload':
      case '--workloads':
        flags.workload = parseList(value !== null ? value : args[++i]);
        break;
      case '--skip-workload':
      case '--skip-workloads':
        flags.skipWorkload = parseList(value !== null ? value : args[++i]);
        break;
      case '--format':
        flags.format = value !== null ? value : args[++i];
        break;
      case '--root':
        flags.root = value !== null ? value : args[++i];
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

/**
 * Pull the leading `--- ... ---` YAML frontmatter and return it as a flat
 * key→raw-string map. Same simple form used by validate-agents.js.
 */
function readFrontmatter(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') return null;
  const out = {};
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') return out;
    const m = lines[i].match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return null;
}

/**
 * Parse an inline YAML sequence: `[a, b, "c"]` → ["a", "b", "c"].
 * Tolerant of single quotes and unquoted scalars.
 */
function parseInlineList(raw) {
  if (typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return [];
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return [];
  return inner
    .split(',')
    .map(s => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

function readWorkloads(filePath, fallback) {
  let fm = null;
  try {
    fm = readFrontmatter(filePath);
  } catch (_) {
    fm = null;
  }
  if (fm && typeof fm.workloads === 'string') {
    const parsed = parseInlineList(fm.workloads);
    if (parsed.length) return parsed;
  }
  return fallback;
}

function selectGroups({ workload, skipWorkload }) {
  let active;
  if (workload && workload.length) {
    validateGroups(workload, '--workload');
    active = GROUPS.filter(g => workload.includes(g));
  } else {
    active = GROUPS.slice();
  }
  if (skipWorkload && skipWorkload.length) {
    validateGroups(skipWorkload, '--skip-workload');
    active = active.filter(g => !skipWorkload.includes(g));
  }
  return active;
}

function listAgentAssets(root) {
  const dir = path.join(root, 'agents');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const filePath = path.join(dir, f);
      const fallback = classify({ kind: 'agent', identifier: identifierOf(f) });
      const groups = readWorkloads(filePath, fallback);
      return {
        kind: 'agent',
        sourceRel: path.posix.join('agents', f),
        targetRel: path.posix.join('agents', '_harness', f),
        groups,
      };
    });
}

function listCommandAssets(root) {
  const dir = path.join(root, 'commands');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const filePath = path.join(dir, f);
      const fallback = classify({ kind: 'command', identifier: identifierOf(f) });
      const groups = readWorkloads(filePath, fallback);
      return {
        kind: 'command',
        sourceRel: path.posix.join('commands', f),
        targetRel: path.posix.join('commands', '_harness', f),
        groups,
      };
    });
}

function listSkillAssets(root) {
  const dir = path.join(root, 'skills');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(dir, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;
    const fallback = classify({ kind: 'skill', identifier: entry.name });
    const groups = readWorkloads(skillFile, fallback);
    out.push({
      kind: 'skill',
      sourceRel: path.posix.join('skills', entry.name),
      targetRel: path.posix.join('skills', '_harness', entry.name),
      groups,
    });
  }
  return out;
}

function listRuleAssets(root) {
  const dir = path.join(root, 'rules');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  function walk(currentDir, base) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const full = path.join(currentDir, entry.name);
      const rel = path.posix.join(base, entry.name);
      if (entry.isDirectory()) walk(full, rel);
      else if (entry.name.endsWith('.md')) {
        // rules/ classifies by parent folder; frontmatter (when present)
        // overrides only if it provides a `workloads:` key.
        const folderGroups = classifyRulePath(rel);
        const groups = readWorkloads(full, folderGroups);
        out.push({
          kind: 'rule',
          sourceRel: rel,
          targetRel: rel.replace(/^rules\//, 'rules/_harness/'),
          groups,
        });
      }
    }
  }
  walk(dir, 'rules');
  return out;
}

function listAllAssets(root) {
  return [
    ...listAgentAssets(root),
    ...listCommandAssets(root),
    ...listSkillAssets(root),
    ...listRuleAssets(root),
  ];
}

function intersect(a, b) {
  const setB = new Set(b);
  return a.some(x => setB.has(x));
}

function selectAssets({ root, workload, skipWorkload }) {
  const activeGroups = selectGroups({ workload, skipWorkload });
  const all = listAllAssets(root);
  return {
    activeGroups,
    selected: all.filter(a => intersect(a.groups, activeGroups)),
    all,
  };
}

function main(argv) {
  const flags = parseArgs(argv);
  if (flags.help) {
    console.log(
      [
        'select-assets.js — print install entries based on workload selection',
        '',
        'Flags:',
        '  --workload=a,b        Whitelist groups',
        '  --skip-workload=a,b   Drop groups from the resolved set',
        '  --format=lines        kind\\tsource\\ttarget per line (default)',
        '  --format=json         JSON array',
        '  --root=PATH           Repo root (default: this file\'s ../..)',
        '',
        `Groups: ${GROUPS.join(', ')}`,
      ].join('\n')
    );
    return 0;
  }

  const root = flags.root || path.resolve(__dirname, '..', '..');
  const { selected, activeGroups } = selectAssets({
    root,
    workload: flags.workload,
    skipWorkload: flags.skipWorkload,
  });

  if (flags.format === 'json') {
    process.stdout.write(JSON.stringify({ activeGroups, assets: selected }, null, 2) + '\n');
  } else {
    for (const a of selected) {
      process.stdout.write(`${a.kind}\t${a.sourceRel}\t${a.targetRel}\n`);
    }
  }
  return 0;
}

if (require.main === module) {
  try {
    process.exit(main(process.argv));
  } catch (e) {
    process.stderr.write(`[select-assets] ${e.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  GROUPS,
  parseArgs,
  parseInlineList,
  readWorkloads,
  selectGroups,
  selectAssets,
  listAllAssets,
};
