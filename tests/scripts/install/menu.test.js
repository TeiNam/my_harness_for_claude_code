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

  if (test('CATEGORIES exposes the 6 user-facing top levels (도메인 축)', () => {
    assert.deepStrictEqual(CATEGORY_IDS, [
      'dev', 'cloud', 'ai', 'data', 'research', 'writing',
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
    assert.strictEqual(findCategory('dev').id, 'dev');
    assert.strictEqual(findCategory('writing').id, 'writing');
    assert.strictEqual(findCategory('made-up'), undefined);
  })) passed++; else failed++;

  if (test('resolveSelection always includes core', () => {
    const r = resolveSelection({ categories: [] });
    assert.ok(r.workloads.includes('core'));
  })) passed++; else failed++;

  if (test('resolveSelection: dev=python yields [core, python-backend]', () => {
    const r = resolveSelection({
      categories: ['dev'],
      subSelections: { dev: ['python'] },
    });
    assert.deepStrictEqual(r.workloads, ['core', 'python-backend']);
  })) passed++; else failed++;

  if (test('resolveSelection: data=python-data avoids backend python', () => {
    const r = resolveSelection({
      categories: ['data'],
      subSelections: { data: ['python-data'] },
    });
    // python-data + ai (분석에는 LLM 도 함께), python-backend 는 들어가면 안 됨.
    assert.ok(r.workloads.includes('python-data'));
    assert.ok(r.workloads.includes('ai'));
    assert.ok(!r.workloads.includes('python-backend'));
  })) passed++; else failed++;

  if (test('resolveSelection: data=mysql excludes other engines', () => {
    const r = resolveSelection({
      categories: ['data'],
      subSelections: { data: ['mysql'] },
    });
    assert.deepStrictEqual(r.workloads, ['core', 'mysql']);
  })) passed++; else failed++;

  if (test('resolveSelection: empty sub-selection means "all sub-options"', () => {
    const r = resolveSelection({
      categories: ['data'],
      subSelections: { data: [] },
    });
    // data 대분류 전체 = 분석(python-data·ai·data-analysis) + 설계(mysql·postgres·mongodb·dynamodb·aws-rds)
    assert.deepStrictEqual(r.workloads.sort(),
      ['ai', 'aws-rds', 'core', 'data-analysis', 'dynamodb', 'mongodb', 'mysql', 'postgres', 'python-data']);
  })) passed++; else failed++;

  if (test('resolveSelection: writing with no sub-selection means "all" (social 상세 전체 포함)', () => {
    const r = resolveSelection({ categories: ['writing'] });
    // writing(general) + social 상세 전체 3키.
    assert.deepStrictEqual(r.workloads,
      ['core', 'social-content', 'social-visual', 'social-voice', 'writing']);
  })) passed++; else failed++;

  if (test('resolveSelection: writing.general excludes all social keys', () => {
    const r = resolveSelection({
      categories: ['writing'],
      subSelections: { writing: ['general'] },
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

  if (test('resolveSelection: dev.apple (sub-level detail) with no detail = all 3 apple keys', () => {
    const r = resolveSelection({
      categories: ['dev'],
      subSelections: { dev: ['apple'] },
    });
    assert.deepStrictEqual(r.workloads,
      ['apple-core', 'apple-platform', 'apple-product', 'core']);
  })) passed++; else failed++;

  if (test('resolveSelection: dev.apple detail picks specific areas', () => {
    const r = resolveSelection({
      categories: ['dev'],
      subSelections: { dev: ['apple'] },
      detailSelections: { 'dev.apple': ['core', 'product'] },
    });
    assert.deepStrictEqual(r.workloads, ['apple-core', 'apple-product', 'core']);
  })) passed++; else failed++;

  if (test('resolveSelection: unknown detail reported separately', () => {
    const r = resolveSelection({
      categories: ['dev'],
      subSelections: { dev: ['apple'] },
      detailSelections: { 'dev.apple': ['core', 'bogus'] },
    });
    assert.deepStrictEqual(r.unknownDetails, ['dev.apple.bogus']);
    assert.ok(r.workloads.includes('apple-core'));
  })) passed++; else failed++;

  if (test('resolveSelection: non-detail leaves (mysql/rust) unchanged — 회귀', () => {
    const r = resolveSelection({
      categories: ['data', 'dev'],
      subSelections: { data: ['mysql'], dev: ['rust'] },
    });
    assert.deepStrictEqual(r.workloads, ['core', 'mysql', 'rust']);
  })) passed++; else failed++;

  if (test('resolveSelection: dev=obsidian also drags frontend', () => {
    const r = resolveSelection({
      categories: ['dev'],
      subSelections: { dev: ['obsidian'] },
    });
    assert.ok(r.workloads.includes('obsidian'));
    assert.ok(r.workloads.includes('frontend'));
  })) passed++; else failed++;

  if (test('resolveSelection reports unknown categories and subs separately', () => {
    const r = resolveSelection({
      categories: ['dev', 'imaginary'],
      subSelections: { dev: ['python', 'made-up'] },
    });
    assert.deepStrictEqual(r.unknownCategories, ['imaginary']);
    assert.deepStrictEqual(r.unknownSubs, ['dev.made-up']);
  })) passed++; else failed++;

  if (test('parseCliFlags treats sub-option flag as auto-including its category', () => {
    const { categories, subSelections } = parseCliFlags({
      dev: 'python,rust',
    });
    assert.deepStrictEqual(categories, ['dev']);
    assert.deepStrictEqual(subSelections, { dev: ['python', 'rust'] });
  })) passed++; else failed++;

  if (test('parseCliFlags accepts comma-string and array equivalently', () => {
    const a = parseCliFlags({ category: 'dev,writing', dev: 'python' });
    const b = parseCliFlags({ category: ['dev', 'writing'], dev: ['python'] });
    assert.deepStrictEqual(a, b);
  })) passed++; else failed++;

  if (test('parseCliFlags: --dev-apple=core,platform routes to sub-level detail + auto sub', () => {
    const { categories, subSelections, detailSelections } = parseCliFlags({ 'dev-apple': 'core,platform' });
    assert.deepStrictEqual(categories, ['dev']);
    assert.deepStrictEqual(subSelections, { dev: ['apple'] });
    assert.deepStrictEqual(detailSelections, { 'dev.apple': ['core', 'platform'] });
  })) passed++; else failed++;

  if (test('parseCliFlags: --dev-apple=core resolves to apple-core only', () => {
    const { categories, subSelections, detailSelections } = parseCliFlags({ 'dev-apple': 'core' });
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
