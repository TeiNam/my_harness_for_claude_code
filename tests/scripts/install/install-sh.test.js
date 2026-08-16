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

/** lstat 기반: dangling 심볼릭도 "링크로 존재"로 본다 (fs.existsSync 는 false 를 준다). */
function isLink(p) {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
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

  // 자산을 은퇴시키면 링크가 남아 스킬 목록에 죽은 이름이 계속 뜬다. 예전에는 그 정리에
  // `--uninstall && 재설치` 한 바퀴가 필요했다 — install 경로에서 dangling 만 걷는다.
  if (test('install prunes links whose repo target is gone, and only those', () => {
    const home = tmp('prune');
    runInstall(['--workload=core', '--no-extras'], home);

    const live = fs.readdirSync(path.join(home, 'skills'));
    assert.ok(live.length > 0, 'core should link at least one skill');

    const retired = path.join(home, 'skills', 'retired-asset');
    fs.symlinkSync(path.join(REPO_ROOT, 'skills', 'retired-asset'), retired); // 레포 안, 대상 없음
    const foreign = path.join(home, 'skills', 'someone-elses');
    fs.symlinkSync('/tmp/harness-test-not-here', foreign);                    // 레포 밖, 대상 없음

    const r = runInstall(['--workload=core', '--no-extras'], home);
    assert.strictEqual(r.status, 0, r.stderr || r.stdout);
    assert.ok(!fs.existsSync(retired) && !isLink(retired), `은퇴 링크가 남았다:\n${r.stdout}`);
    assert.ok(isLink(foreign), '레포 밖 dangling 은 우리 것이 아니므로 보존해야 한다');
    for (const name of live) {
      assert.ok(isLink(path.join(home, 'skills', name)), `살아있는 링크를 지웠다: ${name}`);
    }
    fs.rmSync(home, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('--dry-run reports dangling links without deleting them', () => {
    const home = tmp('prune-dry');
    runInstall(['--workload=core', '--no-extras'], home);
    const retired = path.join(home, 'skills', 'retired-asset');
    fs.symlinkSync(path.join(REPO_ROOT, 'skills', 'retired-asset'), retired);

    const r = runInstall(['--workload=core', '--no-extras', '--dry-run'], home);
    assert.ok(r.stdout.includes('retired-asset'), `dry-run 이 보고하지 않았다:\n${r.stdout}`);
    assert.ok(isLink(retired), 'dry-run 은 아무것도 지우지 않아야 한다');
    fs.rmSync(home, { recursive: true, force: true });
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  return failed === 0;
}

if (require.main === module) {
  process.exit(runTests() ? 0 : 1);
}

module.exports = { runTests };
