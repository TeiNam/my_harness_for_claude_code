/**
 * Tests for scripts/install/manifest.js — 설치 매니페스트 read/write + 버전 비교.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  MANIFEST_NAME,
  readManifest,
  writeManifest,
  repoVersion,
  compareVersion,
} = require('../../../scripts/install/manifest');

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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'harness-manifest-'));
}

function runTests() {
  console.log('\n=== Testing scripts/install/manifest.js ===\n');
  let passed = 0;
  let failed = 0;

  if (test('compareVersion orders major.minor.patch numerically', () => {
    assert.strictEqual(compareVersion('0.1.0', '0.2.0'), -1);
    assert.strictEqual(compareVersion('0.1.0', '0.1.0'), 0);
    assert.strictEqual(compareVersion('0.2.0', '0.1.0'), 1);
    // 문자열 정렬이면 틀리는 케이스: 0.10.0 > 0.9.0
    assert.strictEqual(compareVersion('0.10.0', '0.9.0'), 1);
    // 세그먼트 누락은 0 취급
    assert.strictEqual(compareVersion('1', '1.0.0'), 0);
    assert.strictEqual(compareVersion('1.2', '1.2.3'), -1);
  })) passed++; else failed++;

  if (test('readManifest returns null when absent', () => {
    const dir = tmpDir();
    assert.strictEqual(readManifest(dir), null);
  })) passed++; else failed++;

  if (test('readManifest returns null on corrupt JSON (no throw)', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, MANIFEST_NAME), '{ not valid json');
    assert.strictEqual(readManifest(dir), null);
  })) passed++; else failed++;

  if (test('writeManifest → readManifest round-trips and sorts workloads', () => {
    const dir = tmpDir();
    writeManifest(dir, { version: '0.1.0', workloads: ['mysql', 'core'], installedAt: '2026-07-11T00:00:00Z' });
    const back = readManifest(dir);
    assert.strictEqual(back.version, '0.1.0');
    assert.deepStrictEqual(back.workloads, ['core', 'mysql']); // 정렬됨
    assert.strictEqual(back.installedAt, '2026-07-11T00:00:00Z');
  })) passed++; else failed++;

  if (test('repoVersion reads the repo VERSION file', () => {
    const root = path.resolve(__dirname, '..', '..', '..');
    const v = repoVersion(root);
    assert.ok(/^\d+\.\d+\.\d+/.test(v), `expected semver-like, got ${v}`);
  })) passed++; else failed++;

  if (test('repoVersion returns null when VERSION missing', () => {
    const dir = tmpDir();
    assert.strictEqual(repoVersion(dir), null);
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
