/**
 * Tests for scripts/install/menu.js — 2-tier 메뉴 정의와 워크로드 변환.
 */

'use strict';

const assert = require('assert');

const {
  CATEGORIES,
  CATEGORY_IDS,
  findCategory,
  resolveSelection,
  parseCliFlags,
} = require('../../../scripts/install/menu');

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
  console.log('\n=== Testing scripts/install/menu.js ===\n');
  let passed = 0;
  let failed = 0;

  if (test('CATEGORIES exposes the 6 user-facing top levels', () => {
    assert.deepStrictEqual(CATEGORY_IDS, [
      'backend', 'frontend', 'plugin',
      'data-analysis', 'data-design', 'writing',
    ]);
  })) passed++; else failed++;

  if (test('every sub-option references at least one workload', () => {
    for (const cat of CATEGORIES) {
      if (!cat.subOptions) continue;
      for (const sub of cat.subOptions) {
        assert.ok(Array.isArray(sub.workloads) && sub.workloads.length > 0,
          `sub-option ${cat.id}.${sub.id} has no workloads`);
      }
    }
  })) passed++; else failed++;

  if (test('findCategory returns the right object or undefined', () => {
    assert.strictEqual(findCategory('backend').id, 'backend');
    assert.strictEqual(findCategory('writing').id, 'writing');
    assert.strictEqual(findCategory('made-up'), undefined);
  })) passed++; else failed++;

  if (test('resolveSelection always includes core', () => {
    const r = resolveSelection({ categories: [] });
    assert.ok(r.workloads.includes('core'));
  })) passed++; else failed++;

  if (test('resolveSelection: backend=python yields [core, python-backend]', () => {
    const r = resolveSelection({
      categories: ['backend'],
      subSelections: { backend: ['python'] },
    });
    assert.deepStrictEqual(r.workloads, ['core', 'python-backend']);
  })) passed++; else failed++;

  if (test('resolveSelection: data-analysis=python avoids backend python', () => {
    const r = resolveSelection({
      categories: ['data-analysis'],
      subSelections: { 'data-analysis': ['python'] },
    });
    // python-data + ai (분석에는 LLM 도 함께), python-backend 는 들어가면 안 됨.
    assert.ok(r.workloads.includes('python-data'));
    assert.ok(r.workloads.includes('ai'));
    assert.ok(!r.workloads.includes('python-backend'));
  })) passed++; else failed++;

  if (test('resolveSelection: data-design=mysql excludes other engines', () => {
    const r = resolveSelection({
      categories: ['data-design'],
      subSelections: { 'data-design': ['mysql'] },
    });
    assert.deepStrictEqual(r.workloads, ['core', 'mysql']);
  })) passed++; else failed++;

  if (test('resolveSelection: empty sub-selection means "all sub-options"', () => {
    const r = resolveSelection({
      categories: ['data-design'],
      subSelections: { 'data-design': [] },
    });
    assert.deepStrictEqual(r.workloads.sort(),
      ['core', 'dynamodb', 'mongodb', 'mysql', 'postgres']);
  })) passed++; else failed++;

  if (test('resolveSelection: writing has no sub-options and resolves directly', () => {
    const r = resolveSelection({ categories: ['writing'] });
    assert.deepStrictEqual(r.workloads, ['core', 'writing']);
  })) passed++; else failed++;

  if (test('resolveSelection: plugin=obsidian also drags frontend', () => {
    const r = resolveSelection({
      categories: ['plugin'],
      subSelections: { plugin: ['obsidian'] },
    });
    assert.ok(r.workloads.includes('obsidian'));
    assert.ok(r.workloads.includes('frontend'));
  })) passed++; else failed++;

  if (test('resolveSelection reports unknown categories and subs separately', () => {
    const r = resolveSelection({
      categories: ['backend', 'imaginary'],
      subSelections: { backend: ['python', 'made-up'] },
    });
    assert.deepStrictEqual(r.unknownCategories, ['imaginary']);
    assert.deepStrictEqual(r.unknownSubs, ['backend.made-up']);
  })) passed++; else failed++;

  if (test('parseCliFlags treats sub-option flag as auto-including its category', () => {
    const { categories, subSelections } = parseCliFlags({
      backend: 'python,cloud',
    });
    assert.deepStrictEqual(categories, ['backend']);
    assert.deepStrictEqual(subSelections, { backend: ['python', 'cloud'] });
  })) passed++; else failed++;

  if (test('parseCliFlags accepts comma-string and array equivalently', () => {
    const a = parseCliFlags({ category: 'backend,writing', backend: 'python' });
    const b = parseCliFlags({ category: ['backend', 'writing'], backend: ['python'] });
    assert.deepStrictEqual(a, b);
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
