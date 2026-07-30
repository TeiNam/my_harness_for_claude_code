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

  if (
    test('--all enables every workload (sorted)', () => {
      const out = run(['--all']);
      const groups = out.split(',');
      assert.ok(groups.includes('core'));
      assert.ok(groups.includes('python-backend'));
      assert.ok(groups.includes('mysql'));
      assert.ok(groups.includes('writing'));
      // sorted output
      assert.deepStrictEqual(groups.slice().sort(), groups);
    })
  )
    passed++;
  else failed++;

  if (
    test('--non-interactive --dev=python yields core,python-backend', () => {
      const out = run(['--non-interactive', '--dev=python']);
      assert.strictEqual(out, 'core,python-backend');
    })
  )
    passed++;
  else failed++;

  if (
    test('--non-interactive --data=python-data avoids python-backend', () => {
      const out = run(['--non-interactive', '--data=python-data']);
      const groups = out.split(',');
      assert.ok(groups.includes('python-data'));
      assert.ok(groups.includes('ai'));
      assert.ok(!groups.includes('python-backend'));
    })
  )
    passed++;
  else failed++;

  if (
    test('--non-interactive --data=mysql excludes other DB engines', () => {
      const out = run(['--non-interactive', '--data=mysql']);
      assert.strictEqual(out, 'core,mysql');
    })
  )
    passed++;
  else failed++;

  if (
    test('multiple categories combine workloads', () => {
      const out = run(['--non-interactive', '--category=dev,writing', '--dev=python']);
      const groups = out.split(',');
      assert.ok(groups.includes('python-backend'));
      assert.ok(groups.includes('writing'));
      assert.ok(groups.includes('core'));
    })
  )
    passed++;
  else failed++;

  if (
    test('--non-interactive without flags falls back to --all', () => {
      const out = run(['--non-interactive']);
      const groups = out.split(',');
      assert.ok(groups.includes('mysql'));
      assert.ok(groups.includes('writing'));
      assert.ok(groups.includes('python-backend'));
    })
  )
    passed++;
  else failed++;

  if (
    test('--writing-social 상세 전부 나열 = 3키 모두', () => {
      const out = run(['--non-interactive', '--writing-social=voice,content,visual']);
      assert.strictEqual(out, 'core,social-content,social-visual,social-voice');
    })
  )
    passed++;
  else failed++;

  if (
    test('--writing-social=voice resolves sub-level detail', () => {
      const out = run(['--non-interactive', '--writing-social=voice']);
      assert.strictEqual(out, 'core,social-voice');
    })
  )
    passed++;
  else failed++;

  if (
    test('--writing=general excludes all social keys', () => {
      const out = run(['--non-interactive', '--writing=general']);
      assert.strictEqual(out, 'core,writing');
    })
  )
    passed++;
  else failed++;

  if (
    test('--research=report yields core,report (tech-writer)', () => {
      const out = run(['--non-interactive', '--research=report']);
      assert.strictEqual(out, 'core,report');
    })
  )
    passed++;
  else failed++;

  if (
    test('unknown detail option fails with non-zero exit code', () => {
      let threw = false;
      try {
        run(['--non-interactive', '--writing-social=bogus']);
      } catch (e) {
        threw = true;
        assert.ok(/Unknown detail options: writing\.social\.bogus/.test(e.stderr || e.message));
      }
      assert.ok(threw, 'expected failure for unknown detail');
    })
  )
    passed++;
  else failed++;

  if (
    test('옛/미지 플래그(--backend=)는 전체설치로 폴백하지 않고 실패한다', () => {
      let threw = false;
      try {
        run(['--non-interactive', '--backend=python']);
      } catch (e) {
        threw = true;
        assert.ok(/Unknown flags: --backend/.test(e.stderr || e.message));
      }
      assert.ok(threw, 'expected failure for old flag, not --all fallback');
    })
  )
    passed++;
  else failed++;

  if (
    test('--category=writing + --writing-social=voice 는 writing 전체 + social 은 voice 만 (좁혀지지 않음)', () => {
      const out = run(['--non-interactive', '--category=writing', '--writing-social=voice']);
      const groups = out.split(',');
      // writing 전체가 살아있어야: general sub 의 writing 키 포함
      assert.ok(groups.includes('writing'), 'writing 전체 유지 (general)');
      // social 은 voice 만: content·visual 은 없어야
      assert.ok(groups.includes('social-voice'), 'social-voice 포함');
      assert.ok(!groups.includes('social-content'), 'social-content 제외');
      assert.ok(!groups.includes('social-visual'), 'social-visual 제외');
    })
  )
    passed++;
  else failed++;

  if (
    test('unknown category fails with non-zero exit code', () => {
      let threw = false;
      try {
        run(['--non-interactive', '--category=imaginary']);
      } catch (e) {
        threw = true;
        assert.ok(/Unknown categories: imaginary/.test(e.stderr || e.message));
      }
      assert.ok(threw, 'expected failure for unknown category');
    })
  )
    passed++;
  else failed++;

  if (
    test('unknown sub-option fails with non-zero exit code', () => {
      let threw = false;
      try {
        run(['--non-interactive', '--dev=imaginary']);
      } catch (e) {
        threw = true;
        assert.ok(/Unknown sub-options: dev\.imaginary/.test(e.stderr || e.message));
      }
      assert.ok(threw, 'expected failure for unknown sub');
    })
  )
    passed++;
  else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
