/**
 * Tests for scripts/install/checkbox-prompt.js — 방향키 체크박스 프롬프트.
 *
 * 순수 리듀서(applyKey/selectedIds/normalizeKey)는 직접 검증하고,
 * checkboxPrompt 통합은 fake stdin(EventEmitter)으로 keypress 를 주입한다.
 */

'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');

const {
  createState,
  applyKey,
  selectedIds,
  normalizeKey,
  checkboxPrompt,
} = require('../../../scripts/install/checkbox-prompt');

function test(name, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') return r.then(
      () => { console.log(`  ✓ ${name}`); return true; },
      e => { console.log(`  ✗ ${name}\n    Error: ${e.message}`); return false; },
    );
    console.log(`  ✓ ${name}`);
    return true;
  } catch (e) {
    console.log(`  ✗ ${name}\n    Error: ${e.message}`);
    return false;
  }
}

const OPTS = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
  { id: 'c', label: 'Gamma' },
];

/** 정규화된 키 이름 배열을 순차 적용, 최종 selectedIds 반환 (enter 전까지). */
function drive(keys, preselected = []) {
  let state = createState(OPTS, preselected);
  for (const k of keys) {
    const res = applyKey(state, k);
    state = res.state;
    if (res.done) break;
  }
  return selectedIds(state);
}

async function runTests() {
  console.log('\n=== Testing scripts/install/checkbox-prompt.js ===\n');
  let passed = 0;
  let failed = 0;
  const track = async (name, fn) => { (await test(name, fn)) ? passed++ : failed++; };

  await track('down/space sequence selects the right options', () => {
    // 커서 0(a) → space 체크 → down(b) → space 체크 → [a,b]
    assert.deepStrictEqual(drive(['space', 'down', 'space']), ['a', 'b']);
  });

  await track('space toggles off when already checked', () => {
    assert.deepStrictEqual(drive(['space', 'space']), []);
  });

  await track('cursor wraps around top and bottom', () => {
    // up 에서 0→마지막(c) 로 랩, space → [c]
    assert.deepStrictEqual(drive(['up', 'space']), ['c']);
    // down×3 → 0 으로 랩백, space → [a]
    assert.deepStrictEqual(drive(['down', 'down', 'down', 'space']), ['a']);
  });

  await track('a selects all, then a again clears all', () => {
    assert.deepStrictEqual(drive(['all']), ['a', 'b', 'c']);
    assert.deepStrictEqual(drive(['all', 'all']), []);
  });

  await track('a clears-then-selects when partially checked', () => {
    // a 하나만 체크된 상태에서 'all' → 전부 선택 (부분 상태는 전체 선택으로 간주)
    assert.deepStrictEqual(drive(['space', 'all']), ['a', 'b', 'c']);
  });

  await track('selectedIds preserves option definition order', () => {
    // c 먼저(위로 랩), a 나중에 체크해도 정의 순서(a,c)로 반환
    assert.deepStrictEqual(drive(['up', 'space', 'down', 'space']), ['a', 'c']);
  });

  await track('preselected ids start checked', () => {
    assert.deepStrictEqual(drive([], ['b']), ['b']);
  });

  await track('normalizeKey maps raw keypress to canonical names', () => {
    assert.strictEqual(normalizeKey(' ', { name: 'space' }), 'space');
    assert.strictEqual(normalizeKey(null, { name: 'up' }), 'up');
    assert.strictEqual(normalizeKey(null, { name: 'k' }), 'up');
    assert.strictEqual(normalizeKey(null, { name: 'down' }), 'down');
    assert.strictEqual(normalizeKey(null, { name: 'return' }), 'enter');
    assert.strictEqual(normalizeKey('a', { name: 'a' }), 'all');
    assert.strictEqual(normalizeKey(null, { name: 'c', ctrl: true }), 'abort');
    assert.strictEqual(normalizeKey(null, { name: 'escape' }), 'abort');
    assert.strictEqual(normalizeKey('x', { name: 'x' }), null);
  });

  // -- 통합: fake stdin 으로 checkboxPrompt end-to-end -------------------
  function fakeStdin() {
    const s = new EventEmitter();
    s.isRaw = false;
    s.setRawMode = function (v) { this.isRaw = v; return this; };
    s.resume = function () { return this; };
    s.pause = function () { return this; };
    return s;
  }
  function sink() {
    return { writes: [], write(s) { this.writes.push(s); return true; } };
  }

  await track('checkboxPrompt resolves with selection on enter', async () => {
    const input = fakeStdin();
    const output = sink();
    const p = checkboxPrompt({ title: 'pick', options: OPTS, input, output });
    // space(a) → down → space(b) → enter
    input.emit('keypress', ' ', { name: 'space' });
    input.emit('keypress', null, { name: 'down' });
    input.emit('keypress', ' ', { name: 'space' });
    input.emit('keypress', null, { name: 'return' });
    const result = await p;
    assert.deepStrictEqual(result, ['a', 'b']);
    assert.strictEqual(input.isRaw, false, 'raw mode restored on cleanup');
  });

  await track('checkboxPrompt rejects on ctrl-c', async () => {
    const input = fakeStdin();
    const output = sink();
    const p = checkboxPrompt({ title: 'pick', options: OPTS, input, output });
    input.emit('keypress', null, { name: 'c', ctrl: true });
    await assert.rejects(p, /cancelled/);
  });

  await track('checkboxPrompt returns [] for empty options without I/O', async () => {
    const result = await checkboxPrompt({ title: 'x', options: [] });
    assert.deepStrictEqual(result, []);
  });

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
