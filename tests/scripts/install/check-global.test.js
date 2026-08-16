/**
 * Tests for scripts/install/check-global.js — baseline 설치 상태 판정.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { evaluate } = require('../../../scripts/install/check-global');
const { writeManifest } = require('../../../scripts/install/manifest');

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

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'harness-checkglobal-'));
}

/** repo 루트를 흉내: VERSION 파일만 있는 임시 디렉터리. */
function fakeRoot(version) {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'VERSION'), version + '\n');
  return dir;
}

/** _harness 루트 링크를 만들어 baseline 이 깔린 것처럼 보이게 한다. */
function linkHarness(claudeHome, target) {
  fs.symlinkSync(target, path.join(claudeHome, '_harness'));
}

function runTests() {
  console.log('\n=== Testing scripts/install/check-global.js ===\n');
  let passed = 0;
  let failed = 0;

  if (test('absent when manifest missing', () => {
    const home = tmpDir();
    const root = fakeRoot('0.1.0');
    linkHarness(home, root); // 링크는 있지만 매니페스트 없음
    const r = evaluate({ claudeHome: home, root });
    assert.strictEqual(r.state, 'absent');
    assert.strictEqual(r.installedVersion, null);
    assert.strictEqual(r.repoVersion, '0.1.0');
  })) passed++; else failed++;

  if (test('absent when _harness root link missing', () => {
    const home = tmpDir();
    const root = fakeRoot('0.1.0');
    writeManifest(home, { version: '0.1.0', workloads: ['core'], installedAt: 'x' });
    // 링크 없음
    const r = evaluate({ claudeHome: home, root });
    assert.strictEqual(r.state, 'absent');
  })) passed++; else failed++;

  if (test('outdated when manifest version < repo VERSION', () => {
    const home = tmpDir();
    const root = fakeRoot('0.2.0');
    linkHarness(home, root);
    writeManifest(home, { version: '0.1.0', workloads: ['core', 'mongodb'], installedAt: 'x' });
    const r = evaluate({ claudeHome: home, root });
    assert.strictEqual(r.state, 'outdated');
    assert.strictEqual(r.installedVersion, '0.1.0');
    assert.strictEqual(r.repoVersion, '0.2.0');
    assert.deepStrictEqual(r.workloads, ['core', 'mongodb']);
  })) passed++; else failed++;

  if (test('current when versions match and link present', () => {
    const home = tmpDir();
    const root = fakeRoot('0.1.0');
    linkHarness(home, root);
    writeManifest(home, { version: '0.1.0', workloads: ['core'], installedAt: 'x' });
    const r = evaluate({ claudeHome: home, root });
    assert.strictEqual(r.state, 'current');
  })) passed++; else failed++;

  if (test('current when installed version newer than repo (no downgrade prompt)', () => {
    const home = tmpDir();
    const root = fakeRoot('0.1.0');
    linkHarness(home, root);
    writeManifest(home, { version: '0.9.0', workloads: ['core'], installedAt: 'x' });
    const r = evaluate({ claudeHome: home, root });
    assert.strictEqual(r.state, 'current');
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
