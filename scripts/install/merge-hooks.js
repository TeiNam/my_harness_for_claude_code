#!/usr/bin/env node
'use strict';

/**
 * merge-hooks.js — Merge hooks/hooks.json into ~/.claude/settings.json.
 *
 * Each hook entry must carry an `id`. Existing entries with the same `id` are
 * replaced; entries the user added themselves (different or absent ids) are
 * preserved. A timestamped backup of settings.json is written before any
 * change.
 *
 * Usage:
 *   node scripts/install/merge-hooks.js               Merge (writes settings.json)
 *   node scripts/install/merge-hooks.js --dry-run     Print plan, do not write
 *   node scripts/install/merge-hooks.js --uninstall   Remove only harness ids
 *   node scripts/install/merge-hooks.js --hooks <path>  Use alternate hooks.json
 *   node scripts/install/merge-hooks.js --settings <path>  Use alternate settings.json
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const HARNESS_ID_PREFIXES = ['pre:', 'post:', 'session:', 'stop:'];

function parseArgs(argv) {
  const args = argv.slice(2);
  const flags = { dryRun: false, uninstall: false, hooksPath: null, settingsPath: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--dry-run') flags.dryRun = true;
    else if (a === '--uninstall') flags.uninstall = true;
    else if (a === '--hooks') flags.hooksPath = args[++i];
    else if (a === '--settings') flags.settingsPath = args[++i];
    else if (a === '-h' || a === '--help') flags.help = true;
    else throw new Error(`Unknown flag: ${a}`);
  }
  return flags;
}

function defaultClaudeHome() {
  return process.env.CLAUDE_HOME || path.join(os.homedir(), '.claude');
}

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8');
  if (!raw.trim()) return null;
  return JSON.parse(raw);
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function backupSettings(file) {
  if (!fs.existsSync(file)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = `${file}.bak.${stamp}`;
  fs.copyFileSync(file, dest);
  return dest;
}

function isHarnessId(id) {
  if (typeof id !== 'string' || !id) return false;
  return HARNESS_ID_PREFIXES.some(p => id.startsWith(p));
}

function collectHarnessIds(hooksDoc) {
  const ids = new Set();
  for (const event of Object.keys(hooksDoc.hooks || {})) {
    for (const group of hooksDoc.hooks[event]) {
      if (group && typeof group.id === 'string') ids.add(group.id);
    }
  }
  return ids;
}

function mergeEvent(existingGroups, harnessGroups, harnessIds) {
  // Drop any existing groups whose id is a harness id (we'll re-add below).
  const kept = (existingGroups || []).filter(group => {
    return !(group && typeof group.id === 'string' && harnessIds.has(group.id));
  });
  // Append harness groups in their declared order. Diff plan uses this too.
  return [...kept, ...harnessGroups];
}

function uninstallEvent(existingGroups, harnessIds) {
  return (existingGroups || []).filter(group => {
    return !(group && typeof group.id === 'string' && harnessIds.has(group.id));
  });
}

function planMerge(settings, hooksDoc) {
  const harnessIds = collectHarnessIds(hooksDoc);
  const next = JSON.parse(JSON.stringify(settings || {}));
  next.hooks = next.hooks || {};

  const summary = { added: [], replaced: [], preservedUserIds: [] };

  for (const event of Object.keys(hooksDoc.hooks)) {
    const existing = next.hooks[event] || [];
    const existingIds = new Set(existing.filter(g => g && g.id).map(g => g.id));

    for (const group of hooksDoc.hooks[event]) {
      if (!group || typeof group.id !== 'string') continue;
      if (existingIds.has(group.id)) summary.replaced.push(group.id);
      else summary.added.push(group.id);
    }

    for (const group of existing) {
      if (group && typeof group.id === 'string' && !harnessIds.has(group.id)) {
        summary.preservedUserIds.push(group.id);
      }
    }

    next.hooks[event] = mergeEvent(existing, hooksDoc.hooks[event], harnessIds);
  }

  return { next, summary };
}

function planUninstall(settings, hooksDoc) {
  const harnessIds = collectHarnessIds(hooksDoc);
  const next = JSON.parse(JSON.stringify(settings || {}));
  next.hooks = next.hooks || {};

  const summary = { removed: [], preservedUserIds: [] };

  for (const event of Object.keys(next.hooks)) {
    const existing = next.hooks[event] || [];
    for (const group of existing) {
      if (group && typeof group.id === 'string') {
        if (harnessIds.has(group.id)) summary.removed.push(group.id);
        else summary.preservedUserIds.push(group.id);
      }
    }
    const filtered = uninstallEvent(existing, harnessIds);
    if (filtered.length === 0) delete next.hooks[event];
    else next.hooks[event] = filtered;
  }

  if (Object.keys(next.hooks).length === 0) delete next.hooks;
  return { next, summary };
}

function printPlan(label, summary) {
  console.log(`\n[${label}]`);
  for (const k of Object.keys(summary)) {
    const list = summary[k];
    if (!list.length) continue;
    console.log(`  ${k} (${list.length}):`);
    list.forEach(id => console.log(`    - ${id}`));
  }
}

function main(argv = process.argv) {
  const flags = parseArgs(argv);
  if (flags.help) {
    console.log(
      [
        'merge-hooks.js — Merge hooks/hooks.json into ~/.claude/settings.json',
        '',
        'Flags:',
        '  --dry-run            Print plan, do not write',
        '  --uninstall          Remove only harness-owned hook ids',
        '  --hooks <path>       Path to hooks.json (default: <repo>/hooks/hooks.json)',
        '  --settings <path>    Path to settings.json (default: $CLAUDE_HOME/settings.json)',
        '  -h, --help           Show this help',
      ].join('\n')
    );
    return 0;
  }

  const repoRoot = path.resolve(__dirname, '..', '..');
  const hooksPath = flags.hooksPath || path.join(repoRoot, 'hooks', 'hooks.json');
  const settingsPath = flags.settingsPath || path.join(defaultClaudeHome(), 'settings.json');

  const hooksDoc = readJson(hooksPath);
  if (!hooksDoc || !hooksDoc.hooks) {
    throw new Error(`hooks.json missing or invalid: ${hooksPath}`);
  }
  const settings = readJson(settingsPath) || {};

  const { next, summary } = flags.uninstall
    ? planUninstall(settings, hooksDoc)
    : planMerge(settings, hooksDoc);

  console.log(`hooks file:    ${hooksPath}`);
  console.log(`settings file: ${settingsPath}`);
  printPlan(flags.uninstall ? 'uninstall' : 'merge', summary);

  if (flags.dryRun) {
    console.log('\n[dry-run] settings.json not written.');
    return 0;
  }

  const backup = backupSettings(settingsPath);
  if (backup) console.log(`\nbackup: ${backup}`);
  writeJson(settingsPath, next);
  console.log(`wrote:  ${settingsPath}`);
  return 0;
}

if (require.main === module) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(`[merge-hooks] ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  parseArgs,
  collectHarnessIds,
  planMerge,
  planUninstall,
  isHarnessId,
};
