/**
 * Tests for scripts/install/merge-hooks.js
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', '..', '..', 'scripts', 'install', 'merge-hooks.js');
const REAL_HOOKS = path.join(__dirname, '..', '..', '..', 'hooks', 'hooks.json');

const {
  collectHarnessIds,
  loadHooksDocs,
  planMerge,
  planUninstall,
  looksLikeHarnessId,
  isLegacyHarnessGroup,
  referencesHarnessScript,
} = require('../../../scripts/install/merge-hooks');

function tmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `harness-merge-hooks-${prefix}-`));
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function run(args = []) {
  try {
    const stdout = execFileSync('node', [SCRIPT, ...args], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { code: 0, stdout, stderr: '' };
  } catch (e) {
    return { code: e.status || 1, stdout: e.stdout || '', stderr: e.stderr || '' };
  }
}

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (e) {
    console.log(`  ✗ ${name}\n    Error: ${e.message}`);
    return false;
  }
}

const SAMPLE_HOOKS = {
  hooks: {
    PreToolUse: [
      { matcher: 'Bash', id: 'pre:bash:dispatcher', hooks: [{ type: 'command', command: 'echo a' }] },
      { matcher: 'Write', id: 'pre:write:doc-warn', hooks: [{ type: 'command', command: 'echo b' }] },
    ],
    Stop: [
      { matcher: '*', id: 'stop:cost-tracker', hooks: [{ type: 'command', command: 'echo c' }] },
    ],
  },
};

function runTests() {
  console.log('\n=== Testing scripts/install/merge-hooks.js ===\n');
  let passed = 0;
  let failed = 0;

  if (test('looksLikeHarnessId recognises the id convention (reporting only)', () => {
    assert.strictEqual(looksLikeHarnessId('pre:bash:dispatcher'), true);
    assert.strictEqual(looksLikeHarnessId('stop:cost-tracker'), true);
    assert.strictEqual(looksLikeHarnessId('user-custom-hook'), false);
    assert.strictEqual(looksLikeHarnessId(''), false);
    assert.strictEqual(looksLikeHarnessId(null), false);
  })) passed++; else failed++;

  if (test('referencesHarnessScript needs a shipped script AND our launcher', () => {
    // The launcher marker must be one of ours, not a generic env var.
    const boot = 'node -e "plugin-hook-bootstrap.js"';
    assert.ok(referencesHarnessScript(`node -e "${boot}" node scripts/hooks/pre-bash-dispatcher.js`));
    assert.ok(referencesHarnessScript(`${boot} path.join('scripts','hooks','subagent-budget.js')`));
    // spaced path.join() variant
    assert.ok(referencesHarnessScript(`${boot} path.join('scripts', 'hooks', 'session-end.js')`));
    // windows separators
    assert.ok(referencesHarnessScript(`${boot} node scripts\\hooks\\cost-tracker.js`));
    // array-form command (settings.json ships strings, but be tolerant)
    assert.ok(referencesHarnessScript(['node', '-e', `${boot} scripts/hooks/session-end.js`]));
    // a vendor file that merely shares our basename must NOT match
    assert.strictEqual(referencesHarnessScript('node /vendor/scripts/hooks/cost-tracker.js'), false);
    // our launcher but a basename we don't ship
    assert.strictEqual(referencesHarnessScript(`${boot} node scripts/hooks/security.js`), false);
    // a generic CLAUDE_PLUGIN_ROOT is NOT a harness fingerprint — every plugin has it
    assert.strictEqual(referencesHarnessScript('CLAUDE_PLUGIN_ROOT node scripts/hooks/session-end.js'), false);
    assert.strictEqual(referencesHarnessScript('sh ~/.orca/agent-hooks/claude-hook.sh'), false);
    assert.strictEqual(referencesHarnessScript(''), false);
    assert.strictEqual(referencesHarnessScript(null), false);
  })) passed++; else failed++;

  if (test('every group in the shipped hook files is recognised as ours', () => {
    // A false negative here means a re-merge appends a duplicate instead of
    // replacing, so the hook runs twice. Guard both files.
    for (const flags of [{}, { optional: true }]) {
      const { doc } = loadHooksDocs(REAL_HOOKS, flags);
      for (const [event, groups] of Object.entries(doc.hooks)) {
        for (const group of groups) {
          const detected = (group.hooks || []).some(h => referencesHarnessScript(h.command));
          assert.ok(detected, `${event}:${group.id} not recognised as harness-owned`);
        }
      }
    }
  })) passed++; else failed++;

  if (test('a foreign group claiming a harness id is reported, not silently dropped', () => {
    const settings = {
      hooks: {
        Stop: [
          { matcher: '*', id: 'stop:cost-tracker', hooks: [{ type: 'command', command: 'node /opt/vendor/tracker.js' }] },
        ],
      },
    };
    const { next, summary } = planMerge(settings, SAMPLE_HOOKS);
    assert.deepStrictEqual(summary.overwrittenUserGroups, ['Stop:stop:cost-tracker']);
    // The id is the merge key, so only ours remains — but the user was told.
    assert.strictEqual(next.hooks.Stop.length, 1);
    assert.strictEqual(next.hooks.Stop[0].hooks[0].command, 'echo c');
  })) passed++; else failed++;

  if (test('our own hooks are not reported as overwritten user groups', () => {
    const boot = 'node -e "plugin-hook-bootstrap.js"';
    const settings = {
      hooks: {
        Stop: [
          { matcher: '*', id: 'stop:cost-tracker', hooks: [{ type: 'command', command: `${boot} node scripts/hooks/cost-tracker.js` }] },
        ],
      },
    };
    const { summary } = planMerge(settings, SAMPLE_HOOKS);
    assert.deepStrictEqual(summary.overwrittenUserGroups, []);
  })) passed++; else failed++;

  if (test('a harness id used under a different event is not a collision', () => {
    // Ids are scoped per event. Our sample only declares stop:cost-tracker under
    // Stop, so a PreToolUse group of that name contends with nothing.
    const settings = {
      hooks: {
        PreToolUse: [
          { matcher: 'Bash', id: 'stop:cost-tracker', hooks: [{ type: 'command', command: 'node /opt/vendor/x.js' }] },
        ],
      },
    };
    const { next, summary } = planMerge(settings, SAMPLE_HOOKS);
    assert.ok(next.hooks.PreToolUse.some(g => g.id === 'stop:cost-tracker'), 'must survive');
    assert.deepStrictEqual(summary.swept, []);
    assert.deepStrictEqual(summary.overwrittenUserGroups, []);
  })) passed++; else failed++;

  if (test('a group mixing our command with another one is reported', () => {
    // Splitting it would need two groups under one id, which the merge key
    // forbids — so ours wins and the loss is announced instead of silent.
    const boot = 'node -e "plugin-hook-bootstrap.js"';
    const settings = {
      hooks: {
        Stop: [
          {
            matcher: '*',
            id: 'stop:cost-tracker',
            hooks: [
              { type: 'command', command: `${boot} node scripts/hooks/cost-tracker.js` },
              { type: 'command', command: 'my own extra check' }
            ]
          }
        ]
      }
    };
    const { summary } = planMerge(settings, SAMPLE_HOOKS);
    assert.deepStrictEqual(summary.mixedGroups, ['Stop:stop:cost-tracker']);
    assert.deepStrictEqual(summary.overwrittenUserGroups, [], 'it is our group, just contaminated');

    // Non-command entries (http, prompt, …) count as foreign too.
    const httpMix = {
      hooks: {
        Stop: [
          {
            matcher: '*',
            id: 'stop:cost-tracker',
            hooks: [
              { type: 'command', command: `${boot} node scripts/hooks/cost-tracker.js` },
              { type: 'http', url: 'https://example.test/hook' }
            ]
          }
        ]
      }
    };
    assert.deepStrictEqual(planMerge(httpMix, SAMPLE_HOOKS).summary.mixedGroups, ['Stop:stop:cost-tracker']);
    // The sweep and uninstall paths drop the group too, so they must warn as well.
    assert.deepStrictEqual(planUninstall(httpMix, SAMPLE_HOOKS).summary.mixedGroups, ['Stop:stop:cost-tracker']);
    const retired = {
      hooks: {
        PostToolUse: [
          {
            matcher: '*',
            id: 'post:harness-metrics-bridge',
            hooks: [
              { type: 'command', command: `${boot} node scripts/hooks/harness-metrics-bridge.js` },
              { type: 'command', command: 'my own check' }
            ]
          }
        ]
      }
    };
    assert.deepStrictEqual(
      planMerge(retired, SAMPLE_HOOKS).summary.mixedGroups,
      ['PostToolUse:post:harness-metrics-bridge'],
      'a retired group being swept can also be mixed'
    );

    // A clean harness group must not be flagged.
    const clean = {
      hooks: {
        Stop: [
          { matcher: '*', id: 'stop:cost-tracker', hooks: [{ type: 'command', command: `${boot} node scripts/hooks/cost-tracker.js` }] }
        ]
      }
    };
    assert.deepStrictEqual(planMerge(clean, SAMPLE_HOOKS).summary.mixedGroups, []);
  })) passed++; else failed++;

  if (test('third-party hooks survive even with a harness-shaped id', () => {
    const settings = {
      hooks: {
        PreToolUse: [
          // harness-shaped id, but runs a vendor script → not ours to delete
          { matcher: 'Bash', id: 'pre:vendor-security', hooks: [{ type: 'command', command: 'node /opt/vendor/scripts/hooks/security.js' }] },
        ],
      },
    };
    const { next, summary } = planMerge(settings, SAMPLE_HOOKS);
    assert.ok(next.hooks.PreToolUse.some(g => g.id === 'pre:vendor-security'), 'vendor hook must be preserved');
    assert.ok(summary.preservedUserIds.includes('pre:vendor-security'));
    assert.deepStrictEqual(summary.swept, []);
  })) passed++; else failed++;

  if (test('--optional with a missing hooks-optional.json throws instead of sweeping', () => {
    const dir = tmp('opt-missing');
    const corePath = path.join(dir, 'hooks.json');
    writeJson(corePath, SAMPLE_HOOKS);
    assert.throws(() => loadHooksDocs(corePath, { optional: true }), /hooks-optional\.json missing or invalid/);
    // without --optional the same layout is fine
    assert.strictEqual(loadHooksDocs(corePath, {}).sources.length, 1);
  })) passed++; else failed++;

  if (test('collectHarnessIds extracts every group id', () => {
    const ids = collectHarnessIds(SAMPLE_HOOKS);
    assert.deepStrictEqual(
      [...ids].sort(),
      ['pre:bash:dispatcher', 'pre:write:doc-warn', 'stop:cost-tracker'].sort()
    );
  })) passed++; else failed++;

  if (test('planMerge into empty settings adds every entry', () => {
    const { next, summary } = planMerge({}, SAMPLE_HOOKS);
    assert.deepStrictEqual(summary.added.sort(), ['pre:bash:dispatcher', 'pre:write:doc-warn', 'stop:cost-tracker'].sort());
    assert.deepStrictEqual(summary.replaced, []);
    assert.deepStrictEqual(summary.preservedUserIds, []);
    assert.strictEqual(next.hooks.PreToolUse.length, 2);
    assert.strictEqual(next.hooks.Stop.length, 1);
  })) passed++; else failed++;

  if (test('planMerge replaces existing same-id and preserves user-owned ids', () => {
    const settings = {
      hooks: {
        PreToolUse: [
          { matcher: 'Bash', id: 'pre:bash:dispatcher', hooks: [{ type: 'command', command: 'OLD' }] },
          { matcher: 'Bash', id: 'user-custom', hooks: [{ type: 'command', command: 'mine' }] },
        ],
      },
      otherSetting: 42,
    };
    const { next, summary } = planMerge(settings, SAMPLE_HOOKS);

    // user-custom must survive, harness id must be replaced (one entry per id, not duplicated)
    const ids = next.hooks.PreToolUse.map(g => g.id);
    assert.deepStrictEqual(ids, ['user-custom', 'pre:bash:dispatcher', 'pre:write:doc-warn']);

    // The replaced harness command is the new one, not OLD
    const dispatcher = next.hooks.PreToolUse.find(g => g.id === 'pre:bash:dispatcher');
    assert.strictEqual(dispatcher.hooks[0].command, 'echo a');

    assert.deepStrictEqual(summary.replaced, ['pre:bash:dispatcher']);
    assert.deepStrictEqual(summary.added.sort(), ['pre:write:doc-warn', 'stop:cost-tracker'].sort());
    assert.ok(summary.preservedUserIds.includes('user-custom'));

    // Unrelated settings keys must remain
    assert.strictEqual(next.otherSetting, 42);
  })) passed++; else failed++;

  if (test('planUninstall removes groups running our scripts and prunes empty events', () => {
    // Ownership on the uninstall path is decided by the script, not the id —
    // there is no merge key to resolve, so a borrowed id must survive.
    const boot = 'node -e "plugin-hook-bootstrap.js"';
    const settings = {
      hooks: {
        PreToolUse: [
          { matcher: 'Bash', id: 'pre:bash:dispatcher', hooks: [{ type: 'command', command: `${boot} node scripts/hooks/pre-bash-dispatcher.js` }] },
          { matcher: 'Bash', id: 'user-custom', hooks: [{ type: 'command', command: 'mine' }] },
        ],
        Stop: [
          { matcher: '*', id: 'stop:cost-tracker', hooks: [{ type: 'command', command: `${boot} node scripts/hooks/cost-tracker.js` }] },
        ],
      },
    };
    const { next, summary } = planUninstall(settings, SAMPLE_HOOKS);
    assert.deepStrictEqual(
      summary.removed.sort(),
      ['PreToolUse:pre:bash:dispatcher', 'Stop:stop:cost-tracker'].sort()
    );
    assert.ok(summary.preservedUserIds.includes('user-custom'));
    assert.strictEqual(next.hooks.PreToolUse.length, 1);
    assert.strictEqual(next.hooks.PreToolUse[0].id, 'user-custom');
    assert.ok(!('Stop' in next.hooks)); // pruned because it became empty
  })) passed++; else failed++;

  if (test('uninstall keeps a foreign group that borrowed a harness id', () => {
    const settings = {
      hooks: {
        Stop: [
          { matcher: '*', id: 'stop:cost-tracker', hooks: [{ type: 'command', command: 'node /opt/vendor/tracker.js' }] },
        ],
      },
    };
    const { next, summary } = planUninstall(settings, SAMPLE_HOOKS);
    assert.deepStrictEqual(summary.removed, [], 'nothing of ours is present');
    assert.strictEqual(next.hooks.Stop.length, 1, 'the vendor hook must survive uninstall');
  })) passed++; else failed++;

  if (test('planMerge sweeps legacy id-less harness groups but keeps third-party ones', () => {
    const orcaCommand = "if [ -f '/Users/x/.orca/agent-hooks/claude-hook.sh' ]; then exec sh; fi";
    // Real harness commands always go through the inline bootstrapper.
    const boot = 'node -e "plugin-hook-bootstrap.js"';
    const settings = {
      hooks: {
        PreToolUse: [
          { matcher: 'Bash', hooks: [{ type: 'command', command: `${boot} node scripts/hooks/pre-bash-dispatcher.js` }] },
          { matcher: '*', hooks: [{ type: 'command', command: orcaCommand }] },
        ],
        SubagentStart: [
          // inline bootstrapper spelling the path via path.join()
          { matcher: '*', hooks: [{ type: 'command', command: `${boot} path.join('scripts','hooks','subagent-budget.js')` }] },
        ],
      },
    };
    const { next, summary } = planMerge(settings, SAMPLE_HOOKS);
    assert.strictEqual(summary.swept.length, 2, `swept: ${JSON.stringify(summary.swept)}`);
    assert.strictEqual(next.hooks.PreToolUse.length, 3); // orca kept + 2 harness groups
    assert.ok(next.hooks.PreToolUse.some(g => g.hooks[0].command === orcaCommand));
    assert.ok(!('SubagentStart' in next.hooks)); // legacy-only event pruned
    assert.ok(isLegacyHarnessGroup({ hooks: [{ command: `${boot} node scripts/hooks/cost-tracker.js` }] }));
    assert.ok(!isLegacyHarnessGroup({ hooks: [{ command: orcaCommand }] }));
    // id present → not "legacy", even though the script is ours
    assert.ok(!isLegacyHarnessGroup({ id: 'stop:cost-tracker', hooks: [{ command: `${boot} node scripts/hooks/cost-tracker.js` }] }));
  })) passed++; else failed++;

  if (test('planMerge removes retired harness ids no longer in hooks.json', () => {
    const settings = {
      hooks: {
        PostToolUse: [
          {
            matcher: '*',
            id: 'post:harness-metrics-bridge',
            // a real retired group still invokes the harness script through our launcher
            hooks: [{ type: 'command', command: 'node -e "plugin-hook-bootstrap.js" node scripts/hooks/harness-metrics-bridge.js' }],
          },
        ],
      },
    };
    const { next, summary } = planMerge(settings, SAMPLE_HOOKS);
    assert.ok(summary.swept.some(s => s.includes('post:harness-metrics-bridge')));
    assert.ok(!('PostToolUse' in next.hooks));
  })) passed++; else failed++;

  if (test('loadHooksDocs merges hooks-optional.json only with --optional', () => {
    const core = loadHooksDocs(REAL_HOOKS, {});
    const both = loadHooksDocs(REAL_HOOKS, { optional: true });
    const count = doc => Object.values(doc.hooks).reduce((a, b) => a + b.length, 0);
    assert.strictEqual(core.sources.length, 1);
    assert.strictEqual(both.sources.length, 2);
    assert.ok(count(both.doc) > count(core.doc), 'optional stack should add groups');
    // uninstall must see the optional ids too, or they would be orphaned
    const all = collectHarnessIds(loadHooksDocs(REAL_HOOKS, { uninstall: true }).doc);
    assert.ok(all.has('post:harness-metrics-bridge'));
  })) passed++; else failed++;

  if (test('end-to-end --dry-run does not write settings.json', () => {
    const home = tmp('e2e-dry');
    const settingsPath = path.join(home, '.claude', 'settings.json');
    writeJson(settingsPath, { hooks: { PreToolUse: [{ matcher: 'Bash', id: 'user-only', hooks: [{ type: 'command', command: 'x' }] }] } });
    const before = fs.readFileSync(settingsPath, 'utf8');

    const result = run(['--dry-run', '--hooks', REAL_HOOKS, '--settings', settingsPath]);
    assert.strictEqual(result.code, 0, result.stderr || result.stdout);
    assert.ok(result.stdout.includes('dry-run'));

    const after = fs.readFileSync(settingsPath, 'utf8');
    assert.strictEqual(before, after);

    fs.rmSync(home, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('end-to-end merge writes a backup and merged file', () => {
    const home = tmp('e2e-merge');
    const settingsPath = path.join(home, '.claude', 'settings.json');
    writeJson(settingsPath, { hooks: { PreToolUse: [{ matcher: 'Bash', id: 'user-only', hooks: [{ type: 'command', command: 'x' }] }] }, env: { FOO: 'BAR' } });

    const result = run(['--hooks', REAL_HOOKS, '--settings', settingsPath]);
    assert.strictEqual(result.code, 0, result.stderr || result.stdout);

    const merged = readJson(settingsPath);
    assert.strictEqual(merged.env.FOO, 'BAR'); // unrelated keys preserved
    const ids = (merged.hooks.PreToolUse || []).map(g => g.id);
    assert.ok(ids.includes('user-only'), 'user id preserved');
    assert.ok(ids.includes('pre:bash:dispatcher'), 'harness id added');

    // Backup created
    const backups = fs.readdirSync(path.dirname(settingsPath)).filter(f => f.startsWith('settings.json.bak.'));
    assert.strictEqual(backups.length, 1);

    fs.rmSync(home, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('end-to-end --uninstall keeps user ids and prunes harness ones', () => {
    const home = tmp('e2e-uninstall');
    const settingsPath = path.join(home, '.claude', 'settings.json');

    // Start by merging real hooks, plus a user-only entry.
    writeJson(settingsPath, { hooks: { PreToolUse: [{ matcher: 'Bash', id: 'user-only', hooks: [{ type: 'command', command: 'x' }] }] } });
    let r = run(['--hooks', REAL_HOOKS, '--settings', settingsPath]);
    assert.strictEqual(r.code, 0, r.stderr);

    r = run(['--uninstall', '--hooks', REAL_HOOKS, '--settings', settingsPath]);
    assert.strictEqual(r.code, 0, r.stderr);

    const after = readJson(settingsPath);
    const ids = (after.hooks?.PreToolUse || []).map(g => g.id);
    assert.deepStrictEqual(ids, ['user-only']);
    // No harness-prefixed ids anywhere
    for (const evt of Object.keys(after.hooks || {})) {
      for (const grp of after.hooks[evt]) {
        assert.ok(!looksLikeHarnessId(grp.id), `unexpected harness id remaining: ${grp.id}`);
      }
    }

    fs.rmSync(home, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('repeated merges are idempotent (no duplicate group ids)', () => {
    const home = tmp('e2e-idem');
    const settingsPath = path.join(home, '.claude', 'settings.json');
    writeJson(settingsPath, {});

    run(['--hooks', REAL_HOOKS, '--settings', settingsPath]);
    run(['--hooks', REAL_HOOKS, '--settings', settingsPath]);

    const merged = readJson(settingsPath);
    for (const evt of Object.keys(merged.hooks || {})) {
      const seen = new Set();
      for (const g of merged.hooks[evt]) {
        if (g.id) {
          assert.ok(!seen.has(g.id), `duplicate id after idempotent merge: ${evt}/${g.id}`);
          seen.add(g.id);
        }
      }
    }

    fs.rmSync(home, { recursive: true, force: true });
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
