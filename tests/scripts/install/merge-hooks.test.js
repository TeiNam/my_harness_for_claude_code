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
  planMerge,
  planUninstall,
  isHarnessId,
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

  if (test('isHarnessId recognises harness prefixes', () => {
    assert.strictEqual(isHarnessId('pre:bash:dispatcher'), true);
    assert.strictEqual(isHarnessId('post:edit:format'), true);
    assert.strictEqual(isHarnessId('session:start'), true);
    assert.strictEqual(isHarnessId('stop:cost-tracker'), true);
    assert.strictEqual(isHarnessId('user-custom-hook'), false);
    assert.strictEqual(isHarnessId(''), false);
    assert.strictEqual(isHarnessId(null), false);
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

  if (test('planUninstall removes only harness ids and prunes empty events', () => {
    const settings = {
      hooks: {
        PreToolUse: [
          { matcher: 'Bash', id: 'pre:bash:dispatcher', hooks: [{ type: 'command', command: 'echo' }] },
          { matcher: 'Bash', id: 'user-custom', hooks: [{ type: 'command', command: 'mine' }] },
        ],
        Stop: [
          { matcher: '*', id: 'stop:cost-tracker', hooks: [{ type: 'command', command: 'echo' }] },
        ],
      },
    };
    const { next, summary } = planUninstall(settings, SAMPLE_HOOKS);
    assert.deepStrictEqual(summary.removed.sort(), ['pre:bash:dispatcher', 'stop:cost-tracker'].sort());
    assert.ok(summary.preservedUserIds.includes('user-custom'));
    assert.strictEqual(next.hooks.PreToolUse.length, 1);
    assert.strictEqual(next.hooks.PreToolUse[0].id, 'user-custom');
    assert.ok(!('Stop' in next.hooks)); // pruned because it became empty
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
        assert.ok(!isHarnessId(grp.id), `unexpected harness id remaining: ${grp.id}`);
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
