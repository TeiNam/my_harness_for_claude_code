/**
 * Tests for install.sh — shell-compat smoke checks.
 *
 * macOS ships bash 3.2, where `set -u` treats `"${arr[@]}"` on an EMPTY array as
 * an unbound variable. That bit us twice: once in resolve_workloads (argument-less
 * install died outright) and once in unlink_orphans (the failure was swallowed by
 * a process substitution, so the orphan scan silently found nothing). Both are
 * invisible to a `bash -n` syntax check and to any run that happens to pass
 * arguments, so exercise the argument-less paths against /bin/bash directly.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const INSTALL_SH = path.join(REPO_ROOT, 'install.sh');
const SYSTEM_BASH = '/bin/bash';

function tmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `harness-install-sh-${prefix}-`));
}

/** Run install.sh under the system bash, isolated to a throwaway CLAUDE_HOME. */
function runInstall(args, claudeHome) {
  return spawnSync(SYSTEM_BASH, [INSTALL_SH, ...args], {
    encoding: 'utf8',
    input: '', // never block on the interactive menu
    env: { ...process.env, CLAUDE_HOME: claudeHome, HARNESS_HOOK_PROFILE: 'minimal' }
  });
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
  console.log('\n=== Testing install.sh (shell compat) ===\n');
  let passed = 0;
  let failed = 0;

  if (!fs.existsSync(SYSTEM_BASH)) {
    console.log(`  - skipped: ${SYSTEM_BASH} not present`);
    console.log('\nResults: Passed: 0, Failed: 0');
    return true;
  }

  if (test('parses under the system bash', () => {
    execFileSync(SYSTEM_BASH, ['-n', INSTALL_SH], { stdio: 'pipe' });
  })) passed++; else failed++;

  if (test('argument-less --dry-run survives empty-array expansion', () => {
    const home = tmp('noargs');
    const r = runInstall(['--dry-run'], home);
    assert.ok(!/unbound variable/.test(r.stderr), `unbound variable: ${r.stderr}`);
    assert.strictEqual(r.status, 0, r.stderr || r.stdout);
    fs.rmSync(home, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('--uninstall --dry-run survives empty-array expansion and stays read-only', () => {
    const home = tmp('uninst');
    // A harness-owned link that no workload declares: the orphan path must reach it.
    fs.mkdirSync(path.join(home, 'rules', '_harness', 'common'), { recursive: true });
    const orphan = path.join(home, 'rules', '_harness', 'common', 'retired.md');
    fs.symlinkSync(path.join(REPO_ROOT, 'docs', 'rules-reference', 'testing.md'), orphan);

    const r = runInstall(['--uninstall', '--dry-run'], home);
    assert.ok(!/unbound variable/.test(r.stderr), `unbound variable: ${r.stderr}`);
    assert.strictEqual(r.status, 0, r.stderr || r.stdout);
    assert.ok(r.stdout.includes('retired.md'), `orphan scan did not reach the link:\n${r.stdout}`);
    assert.ok(fs.lstatSync(orphan).isSymbolicLink(), 'dry-run must not delete anything');
    fs.rmSync(home, { recursive: true, force: true });
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  return failed === 0;
}

if (require.main === module) {
  process.exit(runTests() ? 0 : 1);
}

module.exports = { runTests };
