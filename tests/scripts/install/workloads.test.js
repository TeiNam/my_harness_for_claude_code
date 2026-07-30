/**
 * Tests for scripts/install/workloads.js — heuristic asset → workload classifier.
 */

'use strict';

const assert = require('assert');

const { GROUPS, classify, classifyIdentifier, classifyRulePath, identifierOf, isKnownGroup, validateGroups, expandAliases } = require('../../../scripts/install/workloads');

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
  console.log('\n=== Testing scripts/install/workloads.js ===\n');
  let passed = 0;
  let failed = 0;

  if (
    test('GROUPS catalog reflects the 3-tier menu (social 3분할)', () => {
      // 메뉴 sub-옵션·상세와 매칭되는 정밀 키 + core 베이스라인.
      assert.deepStrictEqual(GROUPS.slice().sort(), [
        'ai',
        'aws-rds',
        'cloud',
        'core',
        'data-analysis',
        'devops',
        'dynamodb',
        'finops',
        'frontend',
        'integration',
        'lab',
        'mongodb',
        'mysql',
        'nodejs',
        'obsidian',
        'plugin-chrome',
        'plugin-claude',
        'postgres',
        'python-backend',
        'python-data',
        'report',
        'research',
        'rust',
        'social-content',
        'social-visual',
        'social-voice',
        'writing'
      ]);
    })
  )
    passed++;
  else failed++;

  if (
    test('identifierOf strips path and .md extension', () => {
      assert.strictEqual(identifierOf('agents/python-reviewer.md'), 'python-reviewer');
      assert.strictEqual(identifierOf('postgres-guideline'), 'postgres-guideline');
    })
  )
    passed++;
  else failed++;

  if (
    test('classifyIdentifier routes language reviewers to per-language keys', () => {
      assert.deepStrictEqual(classifyIdentifier('rust-reviewer', 'agent'), ['rust']);
      assert.deepStrictEqual(classifyIdentifier('typescript-reviewer', 'agent'), ['frontend']);
      // python-reviewer is both backend and data analysis
      assert.deepStrictEqual(classifyIdentifier('python-reviewer', 'agent'), ['python-backend', 'python-data']);
      // fastapi-reviewer is backend-only
      assert.deepStrictEqual(classifyIdentifier('fastapi-reviewer', 'agent'), ['python-backend']);
    })
  )
    passed++;
  else failed++;

  if (
    test('classifyIdentifier separates python-backend from python-data', () => {
      assert.deepStrictEqual(classifyIdentifier('fastapi-patterns', 'skill'), ['python-backend']);
      assert.deepStrictEqual(classifyIdentifier('python-data-analysis', 'skill'), ['python-data']);
      assert.deepStrictEqual(classifyIdentifier('duckdb-patterns', 'skill'), ['python-data']);
      // Shared lib applies to both flavours.
      assert.deepStrictEqual(classifyIdentifier('python-patterns', 'skill'), ['python-backend', 'python-data']);
    })
  )
    passed++;
  else failed++;

  if (
    test('classifyIdentifier splits RDBMS / NoSQL into engine-specific keys', () => {
      assert.deepStrictEqual(classifyIdentifier('mysql-guideline', 'skill'), ['mysql']);
      assert.deepStrictEqual(classifyIdentifier('postgres-guideline', 'skill'), ['postgres']);
      assert.deepStrictEqual(classifyIdentifier('mongodb-guideline', 'skill'), ['mongodb']);
      assert.deepStrictEqual(classifyIdentifier('dynamodb-guideline', 'skill'), ['dynamodb']);
    })
  )
    passed++;
  else failed++;

  if (
    test('classifyIdentifier handles cross-cutting cases additively', () => {
      // obsidian skill is both frontend and obsidian
      assert.deepStrictEqual(classifyIdentifier('obsidian-plugin-develop', 'skill'), ['frontend', 'obsidian']);
      // AWS Bedrock is ai + cloud
      assert.deepStrictEqual(classifyIdentifier('aws-bedrock', 'skill'), ['ai', 'cloud']);
      // pytorch is now ai + python-data (was ai + python)
      assert.deepStrictEqual(classifyIdentifier('pytorch-build-resolver', 'agent'), ['ai', 'python-data']);
    })
  )
    passed++;
  else failed++;

  if (
    test('classifyIdentifier falls back to core', () => {
      assert.deepStrictEqual(classifyIdentifier('planner', 'agent'), ['core']);
      assert.deepStrictEqual(classifyIdentifier('git-workflow', 'skill'), ['core']);
    })
  )
    passed++;
  else failed++;

  if (
    test('classifyRulePath uses parent folder, with python split', () => {
      // rules/python/* → python-backend + python-data, except fastapi.md (backend only)
      assert.deepStrictEqual(classifyRulePath('rules/python/security.md'), ['python-backend', 'python-data']);
      assert.deepStrictEqual(classifyRulePath('rules/python/fastapi.md'), ['python-backend']);
      assert.deepStrictEqual(classifyRulePath('rules/rust/coding-style.md'), ['rust']);
      assert.deepStrictEqual(classifyRulePath('rules/typescript/patterns.md'), ['frontend']);
      assert.deepStrictEqual(classifyRulePath('rules/web/performance.md'), ['frontend']);
      assert.deepStrictEqual(classifyRulePath('rules/common/agents.md'), ['core']);
      assert.deepStrictEqual(classifyRulePath('rules/unknown/foo.md'), ['core']);
    })
  )
    passed++;
  else failed++;

  if (
    test('classify routes rules through path, others through identifier', () => {
      assert.deepStrictEqual(classify({ kind: 'rule', identifier: 'security', relativePath: 'rules/python/security.md' }), ['python-backend', 'python-data']);
      assert.deepStrictEqual(classify({ kind: 'agent', identifier: 'fastapi-reviewer' }), ['python-backend']);
    })
  )
    passed++;
  else failed++;

  if (
    test('isKnownGroup distinguishes valid vs unknown', () => {
      assert.strictEqual(isKnownGroup('python-backend'), true);
      assert.strictEqual(isKnownGroup('mysql'), true);
      assert.strictEqual(isKnownGroup('python'), false); // 옛 키는 더 이상 유효하지 않음
      assert.strictEqual(isKnownGroup('bogus'), false);
    })
  )
    passed++;
  else failed++;

  if (
    test('validateGroups throws on unknown ids', () => {
      assert.doesNotThrow(() => validateGroups(['python-backend', 'rust', 'mysql']));
      assert.throws(() => validateGroups(['python-backend', 'made-up']), /Unknown groups: made-up/);
      // 옛 'python' 키도 이제 unknown
      assert.throws(() => validateGroups(['python']), /Unknown groups: python/);
    })
  )
    passed++;
  else failed++;

  // -- social 3분할 분류 --------------------------------------------------
  if (
    test('social classification never double-tags (subdivision holds)', () => {
      // 넓은 폴백이 없으므로 각 social 스킬은 정확히 1개 그룹.
      for (const id of ['voice-builder', 'post-writer', 'graphic-designer', 'gemini-carousel']) {
        assert.strictEqual(classifyIdentifier(id, 'skill').length, 1, `${id} should map to exactly one group`);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('social skills classify into voice/content/visual groups', () => {
      assert.deepStrictEqual(classifyIdentifier('voice-builder', 'skill'), ['social-voice']);
      assert.deepStrictEqual(classifyIdentifier('newsletter-voice', 'skill'), ['social-voice']);
      assert.deepStrictEqual(classifyIdentifier('post-writer', 'skill'), ['social-content']);
      assert.deepStrictEqual(classifyIdentifier('graphic-designer', 'skill'), ['social-visual']);
      assert.deepStrictEqual(classifyIdentifier('gemini-carousel', 'skill'), ['social-visual']);
    })
  )
    passed++;
  else failed++;

  // -- 별칭 확장 ----------------------------------------------------------
  // ALIASES 는 현재 비어 있다(apple 3분할 키 제거로 마지막 별칭이 사라짐).
  // expandAliases 는 여전히 select-assets 경로에 있으므로 통과 동작을 고정해 둔다.
  if (
    test('expandAliases passes non-alias keys through untouched', () => {
      assert.deepStrictEqual(expandAliases(['mysql', 'rust']), ['mysql', 'rust']);
      assert.deepStrictEqual(expandAliases(['core']), ['core']);
      assert.deepStrictEqual(expandAliases([]), []);
    })
  )
    passed++;
  else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
