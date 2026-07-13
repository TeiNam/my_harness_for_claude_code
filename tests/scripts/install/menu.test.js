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

  if (test('CATEGORIES exposes the 7 user-facing top levels', () => {
    assert.deepStrictEqual(CATEGORY_IDS, [
      'backend', 'frontend', 'plugin',
      'data-analysis', 'data-design', 'writing', 'apple',
    ]);
  })) passed++; else failed++;

  if (test('every leaf node references workloads OR has detailOptions', () => {
    const hasWorkloads = n => Array.isArray(n.workloads) && n.workloads.length > 0;
    const hasDetails = n => Array.isArray(n.detailOptions) && n.detailOptions.length > 0;
    for (const cat of CATEGORIES) {
      if (cat.subOptions) {
        for (const sub of cat.subOptions) {
          assert.ok(hasWorkloads(sub) || hasDetails(sub),
            `sub-option ${cat.id}.${sub.id} has neither workloads nor detailOptions`);
          // 상세를 가진 노드는 각 상세가 workloads 를 가져야 한다.
          for (const det of (sub.detailOptions || [])) {
            assert.ok(hasWorkloads(det), `detail ${cat.id}.${sub.id}.${det.id} has no workloads`);
          }
        }
      } else {
        // sub 없는 카테고리: 카테고리 자체가 workloads 또는 detailOptions 를 가져야.
        assert.ok(hasWorkloads(cat) || hasDetails(cat),
          `category ${cat.id} has neither workloads nor detailOptions`);
        for (const det of (cat.detailOptions || [])) {
          assert.ok(hasWorkloads(det), `detail ${cat.id}.${det.id} has no workloads`);
        }
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
      ['aws-rds', 'core', 'dynamodb', 'mongodb', 'mysql', 'postgres']);
  })) passed++; else failed++;

  if (test('resolveSelection: writing with no sub-selection means "all" (social 상세 전체 포함)', () => {
    const r = resolveSelection({ categories: ['writing'] });
    // writing(tech) + social 상세 전체 3키.
    assert.deepStrictEqual(r.workloads,
      ['core', 'social-content', 'social-visual', 'social-voice', 'writing']);
  })) passed++; else failed++;

  if (test('resolveSelection: writing.tech excludes all social keys', () => {
    const r = resolveSelection({
      categories: ['writing'],
      subSelections: { writing: ['tech'] },
    });
    assert.deepStrictEqual(r.workloads, ['core', 'writing']);
  })) passed++; else failed++;

  if (test('resolveSelection: writing.social with no detail = all 3 social keys', () => {
    const r = resolveSelection({
      categories: ['writing'],
      subSelections: { writing: ['social'] },
    });
    assert.deepStrictEqual(r.workloads,
      ['core', 'social-content', 'social-visual', 'social-voice']);
  })) passed++; else failed++;

  if (test('resolveSelection: writing.social detail picks a single social group', () => {
    const r = resolveSelection({
      categories: ['writing'],
      subSelections: { writing: ['social'] },
      detailSelections: { 'writing.social': ['voice'] },
    });
    assert.deepStrictEqual(r.workloads, ['core', 'social-voice']);
  })) passed++; else failed++;

  if (test('resolveSelection: apple (category-level detail) with no detail = all 3 apple keys', () => {
    const r = resolveSelection({ categories: ['apple'] });
    assert.deepStrictEqual(r.workloads,
      ['apple-core', 'apple-platform', 'apple-product', 'core']);
  })) passed++; else failed++;

  if (test('resolveSelection: apple detail picks specific areas', () => {
    const r = resolveSelection({
      categories: ['apple'],
      detailSelections: { apple: ['core', 'product'] },
    });
    assert.deepStrictEqual(r.workloads, ['apple-core', 'apple-product', 'core']);
  })) passed++; else failed++;

  if (test('resolveSelection: unknown detail reported separately', () => {
    const r = resolveSelection({
      categories: ['apple'],
      detailSelections: { apple: ['core', 'bogus'] },
    });
    assert.deepStrictEqual(r.unknownDetails, ['apple.bogus']);
    assert.ok(r.workloads.includes('apple-core'));
  })) passed++; else failed++;

  if (test('resolveSelection: non-detail leaves (mysql/rust) unchanged — 회귀', () => {
    const r = resolveSelection({
      categories: ['data-design', 'backend'],
      subSelections: { 'data-design': ['mysql'], backend: ['rust'] },
    });
    assert.deepStrictEqual(r.workloads, ['core', 'mysql', 'rust']);
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

  if (test('parseCliFlags: --apple=core,platform routes to category-level detail', () => {
    const { categories, detailSelections } = parseCliFlags({ apple: 'core,platform' });
    assert.deepStrictEqual(categories, ['apple']);
    assert.deepStrictEqual(detailSelections, { apple: ['core', 'platform'] });
  })) passed++; else failed++;

  if (test('parseCliFlags: --apple=core resolves to apple-core only', () => {
    const { categories, subSelections, detailSelections } = parseCliFlags({ apple: 'core' });
    const r = resolveSelection({ categories, subSelections, detailSelections });
    assert.deepStrictEqual(r.workloads, ['apple-core', 'core']);
  })) passed++; else failed++;

  if (test('parseCliFlags: --writing-social=voice routes to sub-level detail + auto sub', () => {
    const { categories, subSelections, detailSelections } = parseCliFlags({ 'writing-social': 'voice' });
    assert.deepStrictEqual(categories, ['writing']);
    assert.deepStrictEqual(subSelections, { writing: ['social'] });
    assert.deepStrictEqual(detailSelections, { 'writing.social': ['voice'] });
    const r = resolveSelection({ categories, subSelections, detailSelections });
    assert.deepStrictEqual(r.workloads, ['core', 'social-voice']);
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
