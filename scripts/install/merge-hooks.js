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
 * Every harness hook is launched through one of our own files, and each name here
 * is harness-specific rather than a generic convention. Requiring one of them *in
 * addition to* a shipped basename is what separates our
 * `scripts/hooks/cost-tracker.js` from a vendor's identically-named file.
 *
 * `CLAUDE_PLUGIN_ROOT` deliberately does NOT appear: every plugin reads that env
 * var, so any plugin shipping a file whose basename matches one of ours (a
 * `session-end.js`, say) would have been claimed — and deleted — as ours.
 *
 * `subagent-budget.js` is listed because that hook's inline launcher resolves the
 * root itself instead of going through plugin-hook-bootstrap or run-with-flags;
 * the basename is unique enough to stand in as its fingerprint. If a new hook
 * launches some third way, add its marker here and the "every shipped group is
 * recognised" test will tell you if you forgot.
 *
 * Hard limit, accepted: a command string can always be imitated. A plugin that
 * shipped its own `scripts/hooks/run-with-flags.js` would be read as ours. Static
 * text is all settings.json gives us — harness hooks resolve their root at
 * runtime, so there is no absolute path to compare. These names are coined here
 * rather than generic, which is as far as the signal goes; the timestamped backup
 * and the `--dry-run` sweep list are what make a wrong call recoverable.
 */
const HARNESS_LAUNCHER_MARKERS = ['plugin-hook-bootstrap', 'run-with-flags', 'subagent-budget.js'];

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
 * The only reliable ownership signal: the group runs a script this repo ships,
 * through our launcher. Covers retired ids and legacy id-less groups alike, and
 * never claims a third-party hook that merely uses a `pre:`-shaped id.
 */
function runsHarnessScript(group) {
  if (!group || typeof group !== 'object') return false;
  return (Array.isArray(group.hooks) ? group.hooks : []).some(
    h => h && referencesHarnessScript(h.command)
  );
}

/**
 * A group that runs our script AND something else. Replacing it loses the other
 * command; splitting it would leave two groups with the same id, which the merge
 * key forbids. So we keep the group whole (ours wins) and report it — the harness
 * documents that settings.json hooks are edited through this script, not by hand.
 */
function hasForeignCommandAlongsideOurs(group) {
  if (!runsHarnessScript(group)) return false;
  return (Array.isArray(group.hooks) ? group.hooks : []).some(h => {
    if (!h) return false;
    // Non-command entries (type: 'http', 'prompt', …) are never ours, so their
    // presence alongside our command still means the group is mixed.
    if (!('command' in h)) return true;
    const text = commandText(h.command).trim();
    return text.length > 0 && !referencesHarnessScript(h.command);
  });
}

/**
 * Ownership *for an event we are merging into*. Here an id match also counts:
 * the id is the merge key, so a foreign group holding one of our ids cannot
 * coexist with ours regardless of what it runs. planMerge reports those
 * separately (summary.overwrittenUserGroups) so the replacement is never silent.
 *
 * Everywhere else — events we are not merging into, and --uninstall — use
 * runsHarnessScript() alone: there is no key collision to resolve, so a foreign
 * group that borrowed our id must survive.
 */
function isHarnessGroup(group, ownedIds) {
  if (!group || typeof group !== 'object') return false;
  if (typeof group.id === 'string' && ownedIds.has(group.id)) return true;
  return runsHarnessScript(group);
}

function mergeEvent(existingGroups, harnessGroups, ownedIds) {
  // Drop every harness-owned group; the merged set below is the new truth.
  const kept = (existingGroups || []).filter(group => !isHarnessGroup(group, ownedIds));
  // Append harness groups in their declared order. Diff plan uses this too.
  return [...kept, ...harnessGroups];
}

function uninstallEvent(existingGroups) {
  return (existingGroups || []).filter(group => !runsHarnessScript(group));
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
  const next = JSON.parse(JSON.stringify(settings || {}));
  next.hooks = next.hooks || {};

  const summary = { added: [], replaced: [], swept: [], overwrittenUserGroups: [], mixedGroups: [], preservedUserIds: [] };

  for (const event of Object.keys(hooksDoc.hooks)) {
    const existing = next.hooks[event] || [];
    const existingIds = new Set(existing.filter(g => g && g.id).map(g => g.id));

    // Ids collide per event, not globally: hooks live under an event key, so a
    // foreign PreToolUse group named `stop:cost-tracker` never contends with our
    // Stop group of that name.
    const eventIds = new Set(hooksDoc.hooks[event].filter(g => g && typeof g.id === 'string').map(g => g.id));

    // A group that claims one of our ids but runs someone else's script is a
    // collision, not our hook. The id is the merge key so it cannot survive
    // alongside ours — but it must not disappear silently. Report it; the
    // timestamped settings.json backup is the way back.
    for (const group of existing) {
      if (!group || typeof group.id !== 'string' || !eventIds.has(group.id)) continue;
      if (runsHarnessScript(group)) {
        if (hasForeignCommandAlongsideOurs(group)) summary.mixedGroups.push(`${event}:${group.id}`);
        continue;
      }
      summary.overwrittenUserGroups.push(`${event}:${group.id}`);
    }

    for (const group of hooksDoc.hooks[event]) {
      if (!group || typeof group.id !== 'string') continue;
      if (existingIds.has(group.id)) summary.replaced.push(group.id);
      else summary.added.push(group.id);
    }

    for (const group of existing) {
      if (!isHarnessGroup(group, eventIds)) {
        if (group && typeof group.id === 'string' && group.id) summary.preservedUserIds.push(group.id);
        continue;
      }
      if (!(group && typeof group.id === 'string' && eventIds.has(group.id))) {
        summary.swept.push(`${event}:${describeGroup(group)}`);
        if (hasForeignCommandAlongsideOurs(group)) summary.mixedGroups.push(`${event}:${describeGroup(group)}`);
      }
    }

    next.hooks[event] = mergeEvent(existing, hooksDoc.hooks[event], eventIds);
  }

  // Events not present in the merged doc can still hold retired harness groups.
  for (const event of Object.keys(next.hooks)) {
    if (hooksDoc.hooks[event]) continue;
    const existing = next.hooks[event] || [];
    for (const group of existing) {
      if (runsHarnessScript(group)) {
        summary.swept.push(`${event}:${describeGroup(group)}`);
        if (hasForeignCommandAlongsideOurs(group)) summary.mixedGroups.push(`${event}:${describeGroup(group)}`);
      }
    }
    const filtered = uninstallEvent(existing);
    if (filtered.length === 0) delete next.hooks[event];
    else next.hooks[event] = filtered;
  }

  return { next, summary };
}

function planUninstall(settings, _hooksDoc) {
  // No id set needed: ownership here is decided purely by the script a group runs,
  // so a foreign hook that borrowed a harness id is left alone.
  const next = JSON.parse(JSON.stringify(settings || {}));
  next.hooks = next.hooks || {};

  const summary = { removed: [], mixedGroups: [], preservedUserIds: [] };

  for (const event of Object.keys(next.hooks)) {
    const existing = next.hooks[event] || [];
    for (const group of existing) {
      if (runsHarnessScript(group)) {
        summary.removed.push(`${event}:${describeGroup(group)}`);
        if (hasForeignCommandAlongsideOurs(group)) summary.mixedGroups.push(`${event}:${describeGroup(group)}`);
      } else if (group && typeof group.id === 'string' && group.id) {
        summary.preservedUserIds.push(group.id);
      }
    }
    const filtered = uninstallEvent(existing);
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

  if (summary.mixedGroups && summary.mixedGroups.length) {
    console.log(
      `\n  WARNING: ${summary.mixedGroups.length} group(s) mix a harness command with another one:` +
        `\n    ${summary.mixedGroups.join(', ')}` +
        '\n  Removing/replacing the group drops the other entry (one id cannot hold two groups).' +
        '\n  Move it to its own group with a distinct id, then re-run. Backup is written below.'
    );
  }

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
  runsHarnessScript,
  isLegacyHarnessGroup,
  referencesHarnessScript,
};
