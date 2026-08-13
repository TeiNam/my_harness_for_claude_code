/**
 * Tests for scripts/install/check-drift.js — orphan detection in particular.
 *
 * Orphans are the failure mode the selection-driven check cannot see: an asset
 * the repo no longer declares, whose link survives in $CLAUDE_HOME. A stale rule
 * link that still resolves keeps loading into every session, so drift must be
 * non-zero when one exists.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', '..', '..', 'scripts', 'install', 'check-drift.js');
const REPO_ROOT = path.join(__dirname, '..', '..', '..');

function tmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `harness-check-drift-${prefix}-`));
}

function run(args) {
  try {
    const stdout = execFileSync('node', [SCRIPT, ...args], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.status || 1, stdout: e.stdout || '', stderr: e.stderr || '' };
  }
}

/** Link every selected asset for a workload so the baseline is drift-free. */
function installLinks(claudeHome, workload) {
  const { selectAssets } = require('../../../scripts/install/select-assets');
  const { selected } = selectAssets({ root: REPO_ROOT, workload });
  for (const a of selected) {
    const target = path.join(claudeHome, a.targetRel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.symlinkSync(path.join(REPO_ROOT, a.sourceRel), target);
  }
  return selected.length;
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

function runTests() {
  console.log('\n=== Testing scripts/install/check-drift.js ===\n');
  let passed = 0;
  let failed = 0;

  if (test('reports no drift when every selected asset is linked', () => {
    const home = tmp('clean');
    const count = installLinks(home, ['core']);
    assert.ok(count > 0, 'core should select at least one asset');
    const r = run([`--claude-home=${home}`, '--workload=core', '--json']);
    const out = JSON.parse(r.stdout);
    assert.strictEqual(out.drift, 0, JSON.stringify(out.buckets));
    assert.strictEqual(r.code, 0);
    fs.rmSync(home, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('flags an orphan link the repo no longer declares', () => {
    const home = tmp('orphan');
    installLinks(home, ['core']);
    // A rule that used to live in rules/common but has since moved to docs/.
    const orphan = path.join(home, 'rules', '_harness', 'common', 'retired-rule.md');
    fs.mkdirSync(path.dirname(orphan), { recursive: true });
    fs.symlinkSync(path.join(REPO_ROOT, 'docs', 'rules-reference', 'testing.md'), orphan);

    const r = run([`--claude-home=${home}`, '--workload=core', '--json']);
    const out = JSON.parse(r.stdout);
    assert.deepStrictEqual(out.buckets.orphan, ['rules/_harness/common/retired-rule.md']);
    assert.strictEqual(out.drift, 1);
    assert.strictEqual(r.code, 1, 'orphans must fail the check');
    fs.rmSync(home, { recursive: true, force: true });
  })) passed++; else failed++;

  // Skills install as skills/<name>, not under _harness/ — a namespace-only scan
  // misses them entirely, which is how five deleted skills stayed linked for weeks.
  if (test('flags a deleted skill link that lives outside _harness', () => {
    const home = tmp('orphan-skill');
    installLinks(home, ['core']);
    const orphan = path.join(home, 'skills', 'deleted-skill');
    fs.symlinkSync(path.join(REPO_ROOT, 'skills', 'deleted-skill'), orphan); // dangling on purpose

    const out = JSON.parse(run([`--claude-home=${home}`, '--workload=core', '--json']).stdout);
    assert.deepStrictEqual(out.buckets.orphan, ['skills/deleted-skill']);
    fs.rmSync(home, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('ignores links a user placed inside their own skill', () => {
    // Only the shapes the installer creates are ours: <kind>/_harness/** and a
    // direct <kind>/<name>. Recursing into user skills would make uninstall
    // delete their links.
    const home = tmp('user-inner');
    installLinks(home, ['core']);
    const inner = path.join(home, 'skills', 'my-own-skill', 'refs');
    fs.mkdirSync(inner, { recursive: true });
    fs.symlinkSync(path.join(REPO_ROOT, 'CLAUDE.md'), path.join(inner, 'harness-notes.md'));

    const out = JSON.parse(run([`--claude-home=${home}`, '--workload=core', '--json']).stdout);
    assert.deepStrictEqual(out.buckets.orphan, [], 'a link nested in a user skill is not ours');
    fs.rmSync(home, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('ignores a user link at the top of agents/ (only skills install there)', () => {
    // agents, commands and rules install exclusively under _harness/, so their
    // top level is user territory.
    const home = tmp('user-top');
    installLinks(home, ['core']);
    fs.symlinkSync(path.join(REPO_ROOT, 'CLAUDE.md'), path.join(home, 'agents', 'my-manual-agent.md'));

    const out = JSON.parse(run([`--claude-home=${home}`, '--workload=core', '--json']).stdout);
    assert.deepStrictEqual(out.buckets.orphan, []);
    fs.rmSync(home, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('leaves links that point outside the repo alone', () => {
    const home = tmp('foreign');
    installLinks(home, ['core']);
    const foreign = path.join(home, 'skills', 'someone-elses-plugin');
    fs.symlinkSync(path.join(os.tmpdir(), 'not-this-repo'), foreign);

    const out = JSON.parse(run([`--claude-home=${home}`, '--workload=core', '--json']).stdout);
    assert.deepStrictEqual(out.buckets.orphan, [], 'third-party links must not be reported');
    fs.rmSync(home, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('checking one workload does not report other workloads as orphans', () => {
    const home = tmp('subset');
    // Install a wider set, then check a narrow one.
    installLinks(home, ['core', 'rust']);
    const out = JSON.parse(run([`--claude-home=${home}`, '--workload=core', '--json']).stdout);
    assert.deepStrictEqual(out.buckets.orphan, [], 'rust links are declared by the repo, not orphans');
    fs.rmSync(home, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('recovery commands carry the inspected CLAUDE_HOME', () => {
    // Without it the user would wipe the default ~/.claude instead of the
    // install they just checked.
    const home = tmp('custom-home');
    installLinks(home, ['core']);
    fs.symlinkSync(path.join(REPO_ROOT, 'skills', 'gone'), path.join(home, 'skills', 'stale-link'));

    const r = run([`--claude-home=${home}`, '--workload=core']);
    assert.strictEqual(r.code, 1);
    const lines = r.stdout.split('\n').filter(l => l.includes('./install.sh'));
    assert.ok(lines.length > 0, r.stdout);
    for (const line of lines) {
      assert.ok(line.includes(`CLAUDE_HOME="${home}"`), `missing quoted CLAUDE_HOME in: ${line}`);
    }
    assert.ok(r.stdout.includes(`CLAUDE_HOME="${home}" node scripts/install/merge-hooks.js --optional`));
    fs.rmSync(home, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('orphan report tells the user --force will not clear it', () => {
    const home = tmp('orphan-msg');
    installLinks(home, ['core']);
    const orphan = path.join(home, 'commands', '_harness', 'retired-command.md');
    fs.mkdirSync(path.dirname(orphan), { recursive: true });
    fs.symlinkSync(path.join(REPO_ROOT, 'CLAUDE.md'), orphan);

    const r = run([`--claude-home=${home}`, '--workload=core']);
    assert.strictEqual(r.code, 1);
    assert.ok(r.stdout.includes('orphan (1)'), r.stdout);
    assert.ok(r.stdout.includes('--uninstall'), 'must point at the command that actually clears orphans');
    fs.rmSync(home, { recursive: true, force: true });
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  return failed === 0;
}

if (require.main === module) {
  process.exit(runTests() ? 0 : 1);
}

module.exports = { runTests };
