#!/usr/bin/env node
'use strict';

/**
 * merge-hooks.js — Merge hooks/hooks.json into ~/.claude/settings.json.
 *
 * Merging is **declarative**: after a run, the harness-owned part of
 * settings.json equals exactly what was merged. Any harness hook that is not in
 * the merged set is removed — including ids retired from hooks.json and legacy
 * id-less groups written by older installers. Groups the user added themselves
 * (no harness id, no harness script path) are preserved.
 *
 * hooks.json holds the minimal core stack. hooks-optional.json holds the
 * opt-in quality/observability/blocking stack; add it with --optional.
 *
 * Usage:
 *   node scripts/install/merge-hooks.js               Merge core (writes settings.json)
 *   node scripts/install/merge-hooks.js --optional    Merge core + optional stack
 *   node scripts/install/merge-hooks.js --dry-run     Print plan, do not write
 *   node scripts/install/merge-hooks.js --uninstall   Remove all harness-owned hooks
 *   node scripts/install/merge-hooks.js --hooks <path>  Use alternate hooks.json
 *   node scripts/install/merge-hooks.js --settings <path>  Use alternate settings.json
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const HARNESS_ID_PREFIXES = ['pre:', 'post:', 'session:', 'stop:', 'subagent:'];

/**
 * Ownership is decided by the script a group actually invokes, never by its id.
 * An id prefix like `pre:` is a harness convention, not a fact — a third-party
 * hook may use the same shape, and deleting it would silently disable it.
 *
 * A group is harness-owned when its command references `scripts/hooks/<name>`
 * where <name> is a real file in this repo's scripts/hooks. Inline bootstrappers
 * spell that path as a literal or via path.join('scripts','hooks',…), so the
 * separator is matched loosely — but the basename must be one we ship, which is
 * what keeps a vendor's own /vendor/scripts/hooks/security.js from matching.
 */
const SCRIPTS_HOOKS_PREFIX = /scripts["'\s,\\/]+hooks["'\s,\\/]+/;

/**
 * Every harness hook goes through our own launcher: the inline bootstrapper that
 * resolves CLAUDE_PLUGIN_ROOT, plugin-hook-bootstrap.js, or run-with-flags.js.
 * Requiring one of these *in addition to* a shipped basename is what separates
 * our `scripts/hooks/cost-tracker.js` from a vendor's identically-named file.
 *
 * Residual risk, accepted: CLAUDE_PLUGIN_ROOT is not harness-exclusive, so a
 * plugin that also ships `scripts/hooks/<one of our exact basenames>` and reads
 * that env var would be treated as ours. It cannot be narrowed further from a
 * command string alone — subagent:budget's inline launcher uses neither
 * plugin-hook-bootstrap nor run-with-flags, so dropping the env marker would make
 * our own hook unrecognizable and duplicate it on re-merge. The backup file and
 * `--dry-run` sweep list are the mitigations.
 */
const HARNESS_LAUNCHER_MARKERS = ['CLAUDE_PLUGIN_ROOT', 'plugin-hook-bootstrap', 'run-with-flags'];

let harnessScriptNamesCache = null;

function harnessScriptNames() {
  if (harnessScriptNamesCache) return harnessScriptNamesCache;
  const dir = path.resolve(__dirname, '..', 'hooks');
  // A repo-local read that fails is not a normal condition. Treating it as "no
  // scripts" would silently make every legacy group unrecognizable, so the merge
  // would append duplicates instead of replacing them. Fail loudly instead.
  const names = fs.readdirSync(dir).filter(f => f.endsWith('.js') || f.endsWith('.sh'));
  harnessScriptNamesCache = new Set(names);
  return harnessScriptNamesCache;
}

/** settings.json ships string commands; tolerate array form defensively. */
function commandText(command) {
  if (typeof command === 'string') return command;
  if (Array.isArray(command)) return command.filter(c => typeof c === 'string').join(' ');
  return '';
}

/** Does this command invoke a script this repo ships, through our launcher? */
function referencesHarnessScript(command) {
  const text = commandText(command);
  if (!text) return false;
  if (!HARNESS_LAUNCHER_MARKERS.some(marker => text.includes(marker))) return false;

  const names = harnessScriptNames();
  if (names.size === 0) return false;

  let rest = text;
  for (;;) {
    const match = SCRIPTS_HOOKS_PREFIX.exec(rest);
    if (!match) return false;
    const after = rest.slice(match.index + match[0].length);
    // Next token is the script name: stop at the first quote/space/comma/slash.
    const name = (after.match(/^[A-Za-z0-9._-]+/) || [''])[0];
    if (names.has(name)) return true;
    rest = after;
  }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const flags = { dryRun: false, uninstall: false, optional: false, hooksPath: null, settingsPath: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--dry-run') flags.dryRun = true;
    else if (a === '--uninstall') flags.uninstall = true;
    else if (a === '--optional') flags.optional = true;
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

/**
 * Harness ids follow this shape by convention. Used for reporting only — never
 * for deciding ownership, since a third-party hook may use the same shape.
 */
function looksLikeHarnessId(id) {
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

/** id-less group that still invokes a harness script — written by older installers. */
function isLegacyHarnessGroup(group) {
  if (!group || typeof group !== 'object') return false;
  if (typeof group.id === 'string' && group.id) return false;
  return (Array.isArray(group.hooks) ? group.hooks : []).some(
    h => h && referencesHarnessScript(h.command)
  );
}

/**
 * True for any group the harness owns. Two ways to qualify:
 *   1. its id is in the set being merged, or
 *   2. it invokes a script this repo ships (covers retired ids and legacy
 *      id-less groups alike).
 * A third-party group with a `pre:`-shaped id but no harness script is NOT ours.
 */
function isHarnessGroup(group, ownedIds) {
  if (!group || typeof group !== 'object') return false;
  if (typeof group.id === 'string' && ownedIds.has(group.id)) return true;
  return (Array.isArray(group.hooks) ? group.hooks : []).some(
    h => h && referencesHarnessScript(h.command)
  );
}

function mergeEvent(existingGroups, harnessGroups, ownedIds) {
  // Drop every harness-owned group; the merged set below is the new truth.
  const kept = (existingGroups || []).filter(group => !isHarnessGroup(group, ownedIds));
  // Append harness groups in their declared order. Diff plan uses this too.
  return [...kept, ...harnessGroups];
}

function uninstallEvent(existingGroups, ownedIds) {
  return (existingGroups || []).filter(group => !isHarnessGroup(group, ownedIds));
}

/**
 * Load the core hooks doc, plus hooks-optional.json when it is in scope.
 * Uninstall always loads both so retired/optional ids are swept too.
 */
function loadHooksDocs(corePath, flags = {}) {
  const core = readJson(corePath);
  if (!core || !core.hooks) {
    throw new Error(`hooks.json missing or invalid: ${corePath}`);
  }

  const optionalPath = path.join(path.dirname(corePath), 'hooks-optional.json');
  const wantOptional = flags.optional || flags.uninstall;
  const optional = wantOptional ? readJson(optionalPath) : null;
  if (!optional || !optional.hooks) {
    // --optional with no readable file would silently sweep the optional stack
    // instead of installing it. Fail loudly rather than doing the opposite.
    if (flags.optional) {
      throw new Error(`--optional requested but hooks-optional.json missing or invalid: ${optionalPath}`);
    }
    return { doc: core, sources: [corePath] };
  }

  const merged = { ...core, hooks: {} };
  for (const src of [core, optional]) {
    for (const [event, groups] of Object.entries(src.hooks)) {
      merged.hooks[event] = [...(merged.hooks[event] || []), ...groups];
    }
  }
  return { doc: merged, sources: [corePath, optionalPath] };
}

function describeGroup(group) {
  if (group && typeof group.id === 'string' && group.id) return group.id;
  const matcher = group && group.matcher ? group.matcher : '*';
  return `(legacy id-less, matcher ${matcher})`;
}

function planMerge(settings, hooksDoc) {
  const ownedIds = collectHarnessIds(hooksDoc);
  const next = JSON.parse(JSON.stringify(settings || {}));
  next.hooks = next.hooks || {};

  const summary = { added: [], replaced: [], swept: [], overwrittenUserGroups: [], preservedUserIds: [] };

  for (const event of Object.keys(hooksDoc.hooks)) {
    const existing = next.hooks[event] || [];
    const existingIds = new Set(existing.filter(g => g && g.id).map(g => g.id));

    // A group that claims one of our ids but runs someone else's script is a
    // collision, not our hook. The id is the merge key so it cannot survive
    // alongside ours — but it must not disappear silently. Report it; the
    // timestamped settings.json backup is the way back.
    for (const group of existing) {
      if (!group || typeof group.id !== 'string' || !ownedIds.has(group.id)) continue;
      if ((group.hooks || []).some(h => h && referencesHarnessScript(h.command))) continue;
      summary.overwrittenUserGroups.push(`${event}:${group.id}`);
    }

    for (const group of hooksDoc.hooks[event]) {
      if (!group || typeof group.id !== 'string') continue;
      if (existingIds.has(group.id)) summary.replaced.push(group.id);
      else summary.added.push(group.id);
    }

    for (const group of existing) {
      if (!isHarnessGroup(group, ownedIds)) {
        if (group && typeof group.id === 'string' && group.id) summary.preservedUserIds.push(group.id);
        continue;
      }
      if (!(group && typeof group.id === 'string' && ownedIds.has(group.id))) {
        summary.swept.push(`${event}:${describeGroup(group)}`);
      }
    }

    next.hooks[event] = mergeEvent(existing, hooksDoc.hooks[event], ownedIds);
  }

  // Events not present in the merged doc can still hold retired harness groups.
  for (const event of Object.keys(next.hooks)) {
    if (hooksDoc.hooks[event]) continue;
    const existing = next.hooks[event] || [];
    for (const group of existing) {
      if (isHarnessGroup(group, ownedIds)) summary.swept.push(`${event}:${describeGroup(group)}`);
    }
    const filtered = uninstallEvent(existing, ownedIds);
    if (filtered.length === 0) delete next.hooks[event];
    else next.hooks[event] = filtered;
  }

  return { next, summary };
}

function planUninstall(settings, hooksDoc) {
  const ownedIds = collectHarnessIds(hooksDoc);
  const next = JSON.parse(JSON.stringify(settings || {}));
  next.hooks = next.hooks || {};

  const summary = { removed: [], preservedUserIds: [] };

  for (const event of Object.keys(next.hooks)) {
    const existing = next.hooks[event] || [];
    for (const group of existing) {
      if (isHarnessGroup(group, ownedIds)) summary.removed.push(`${event}:${describeGroup(group)}`);
      else if (group && typeof group.id === 'string' && group.id) summary.preservedUserIds.push(group.id);
    }
    const filtered = uninstallEvent(existing, ownedIds);
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
        '  --optional           Also merge hooks-optional.json (quality/blocking stack)',
        '  --dry-run            Print plan, do not write',
        '  --uninstall          Remove all harness-owned hooks (core + optional + legacy)',
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

  const { doc: hooksDoc, sources } = loadHooksDocs(hooksPath, flags);
  const settings = readJson(settingsPath) || {};

  const { next, summary } = flags.uninstall
    ? planUninstall(settings, hooksDoc)
    : planMerge(settings, hooksDoc);

  console.log(`hooks files:   ${sources.join(', ')}`);
  console.log(`settings file: ${settingsPath}`);
  printPlan(flags.uninstall ? 'uninstall' : 'merge', summary);

  if (summary.overwrittenUserGroups && summary.overwrittenUserGroups.length) {
    console.log(
      `\n  WARNING: ${summary.overwrittenUserGroups.length} non-harness group(s) claim a harness hook id ` +
        'and will be replaced.\n  The id is the merge key, so they cannot coexist. Restore from the backup if unintended.'
    );
  }

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
  loadHooksDocs,
  planMerge,
  planUninstall,
  looksLikeHarnessId,
  isHarnessGroup,
  isLegacyHarnessGroup,
  referencesHarnessScript,
};
