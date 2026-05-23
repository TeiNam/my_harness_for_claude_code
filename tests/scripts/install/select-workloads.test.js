/**
 * Tests for scripts/install/select-workloads.js — 메뉴 + CLI 플래그 진입점.
 *
 * 대화형 readline 경로는 통합 테스트가 어려워, CLI 모드 (비대화형) 의
 * 실제 노드 호출 결과만 비교한다.
 */

'use strict';

const assert = require('assert');
const { execFileSync } = require('child_process');
const path = require('path');

const SCRIPT = path.resolve(__dirname, '../../../scripts/install/select-workloads.js');

function run(args) {
  return execFileSync('node', [SCRIPT, ...args], { encoding: 'utf8' }).trim();
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
  console.log('\n=== Testing scripts/install/select-workloads.js ===\n');
  let passed = 0;
  let failed = 0;

  if (test('--all enables every workload (sorted)', () => {
    const out = run(['--all']);
    const groups = out.split(',');
    assert.ok(groups.includes('core'));
    assert.ok(groups.includes('python-backend'));
    assert.ok(groups.includes('mysql'));
    assert.ok(groups.includes('writing'));
    // sorted output
    assert.deepStrictEqual(groups.slice().sort(), groups);
  })) passed++; else failed++;

  if (test('--non-interactive --backend=python yields core,python-backend', () => {
    const out = run(['--non-interactive', '--backend=python']);
    assert.strictEqual(out, 'core,python-backend');
  })) passed++; else failed++;

  if (test('--non-interactive --data-analysis=python avoids python-backend', () => {
    const out = run(['--non-interactive', '--data-analysis=python']);
    const groups = out.split(',');
    assert.ok(groups.includes('python-data'));
    assert.ok(groups.includes('ai'));
    assert.ok(!groups.includes('python-backend'));
  })) passed++; else failed++;

  if (test('--non-interactive --data-design=mysql excludes other DB engines', () => {
    const out = run(['--non-interactive', '--data-design=mysql']);
    assert.strictEqual(out, 'core,mysql');
  })) passed++; else failed++;

  if (test('multiple categories combine workloads', () => {
    const out = run(['--non-interactive', '--category=backend,writing', '--backend=python']);
    const groups = out.split(',');
    assert.ok(groups.includes('python-backend'));
    assert.ok(groups.includes('writing'));
    assert.ok(groups.includes('core'));
  })) passed++; else failed++;

  if (test('--non-interactive without flags falls back to --all', () => {
    const out = run(['--non-interactive']);
    const groups = out.split(',');
    assert.ok(groups.includes('mysql'));
    assert.ok(groups.includes('writing'));
    assert.ok(groups.includes('python-backend'));
  })) passed++; else failed++;

  if (test('unknown category fails with non-zero exit code', () => {
    let threw = false;
    try {
      run(['--non-interactive', '--category=imaginary']);
    } catch (e) {
      threw = true;
      assert.ok(/Unknown categories: imaginary/.test(e.stderr || e.message));
    }
    assert.ok(threw, 'expected failure for unknown category');
  })) passed++; else failed++;

  if (test('unknown sub-option fails with non-zero exit code', () => {
    let threw = false;
    try {
      run(['--non-interactive', '--backend=imaginary']);
    } catch (e) {
      threw = true;
      assert.ok(/Unknown sub-options: backend\.imaginary/.test(e.stderr || e.message));
    }
    assert.ok(threw, 'expected failure for unknown sub');
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
