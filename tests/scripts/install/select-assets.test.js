/**
 * Tests for scripts/install/select-assets.js — workload-aware install
 * filter that drives install.sh / install.ps1.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  GROUPS,
  parseInlineList,
  readWorkloads,
  selectGroups,
  selectAssets,
} = require('../../../scripts/install/select-assets');

function tmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `harness-select-${prefix}-`));
}

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, 'utf8');
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

/**
 * Build a small fake harness on disk (just enough surface area for the
 * selector). Returns the temp root.
 */
function buildFixture() {
  const root = tmp('fixture');

  writeFile(path.join(root, 'agents/python-reviewer.md'),
    '---\nname: python-reviewer\nworkloads: [python-backend, python-data]\n---\nbody\n');
  writeFile(path.join(root, 'agents/planner.md'),
    '---\nname: planner\n---\nbody\n');  // no workloads → falls back to heuristic (core)
  writeFile(path.join(root, 'agents/aws-helper.md'),
    '---\nname: aws-helper\nworkloads: [cloud, ai]\n---\nbody\n');

  writeFile(path.join(root, 'commands/python-review.md'),
    '---\ndescription: x\nworkloads: [python-backend]\n---\n');

  writeFile(path.join(root, 'skills/python-patterns/SKILL.md'),
    '---\nname: python-patterns\nworkloads: [python-backend, python-data]\n---\n');
  writeFile(path.join(root, 'skills/planner-skill/SKILL.md'),
    '---\nname: planner-skill\n---\n');  // no workloads → core fallback

  writeFile(path.join(root, 'rules/python/security.md'),
    '---\nworkloads: [python-backend, python-data]\n---\n');
  writeFile(path.join(root, 'rules/common/git-workflow.md'),
    'no frontmatter at all\n');  // no fm → folder-based fallback (core)

  return root;
}

function runTests() {
  console.log('\n=== Testing scripts/install/select-assets.js ===\n');
  let passed = 0;
  let failed = 0;

  if (test('parseInlineList parses inline YAML sequences', () => {
    assert.deepStrictEqual(parseInlineList('[a, b]'), ['a', 'b']);
    assert.deepStrictEqual(parseInlineList('["a", \'b\']'), ['a', 'b']);
    assert.deepStrictEqual(parseInlineList('[]'), []);
    assert.deepStrictEqual(parseInlineList('not-a-list'), []);
    assert.deepStrictEqual(parseInlineList(undefined), []);
  })) passed++; else failed++;

  if (test('readWorkloads prefers frontmatter, otherwise fallback', () => {
    const root = tmp('rw');
    const file = path.join(root, 'a.md');
    writeFile(file, '---\nname: x\nworkloads: [rust, ai]\n---\nbody\n');
    assert.deepStrictEqual(readWorkloads(file, ['core']), ['rust', 'ai']);

    const file2 = path.join(root, 'b.md');
    writeFile(file2, '---\nname: x\n---\nbody\n');
    assert.deepStrictEqual(readWorkloads(file2, ['core']), ['core']);

    fs.rmSync(root, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('selectGroups: default is every group', () => {
    assert.deepStrictEqual(selectGroups({}), GROUPS);
  })) passed++; else failed++;

  if (test('selectGroups: --workload limits, --skip-workload subtracts', () => {
    assert.deepStrictEqual(
      selectGroups({ workload: ['python-backend', 'frontend'] }),
      ['python-backend', 'frontend']
    );
    assert.deepStrictEqual(
      selectGroups({ skipWorkload: ['ai', 'nodejs'] }),
      GROUPS.filter(g => g !== 'ai' && g !== 'nodejs')
    );
  })) passed++; else failed++;

  if (test('selectGroups rejects unknown groups', () => {
    assert.throws(() => selectGroups({ workload: ['bogus'] }), /Unknown --workload/);
    assert.throws(() => selectGroups({ skipWorkload: ['bogus'] }), /Unknown --skip-workload/);
    // 옛 'python' 키는 이제 unknown
    assert.throws(() => selectGroups({ workload: ['python'] }), /Unknown --workload/);
  })) passed++; else failed++;

  if (test('selectAssets returns intersection-matching assets', () => {
    const root = buildFixture();

    const backendOnly = selectAssets({ root, workload: ['python-backend'] });
    const ids = backendOnly.selected.map(a => a.sourceRel).sort();
    // python-backend 는 모든 python 자산(둘 다 태그)을 끌어온다.
    assert.deepStrictEqual(ids, [
      'agents/python-reviewer.md',
      'commands/python-review.md',
      'rules/python/security.md',
      'skills/python-patterns',
    ].sort());

    // python-data 만 골라도 python-data 태그가 붙은 자산은 다 들어옴.
    // (commands/python-review.md 는 backend-only 라 빠진다.)
    const dataOnly = selectAssets({ root, workload: ['python-data'] });
    const dataIds = dataOnly.selected.map(a => a.sourceRel).sort();
    assert.deepStrictEqual(dataIds, [
      'agents/python-reviewer.md',
      'rules/python/security.md',
      'skills/python-patterns',
    ].sort());

    fs.rmSync(root, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('selectAssets respects multi-tag assets', () => {
    const root = buildFixture();

    const cloudOnly = selectAssets({ root, workload: ['cloud'] });
    const ids = cloudOnly.selected.map(a => a.sourceRel);
    assert.ok(ids.includes('agents/aws-helper.md'),
      'aws-helper carries [cloud, ai] and should match cloud');
    assert.ok(!ids.includes('agents/python-reviewer.md'));

    const aiOnly = selectAssets({ root, workload: ['ai'] });
    const aiIds = aiOnly.selected.map(a => a.sourceRel);
    assert.ok(aiIds.includes('agents/aws-helper.md'),
      'aws-helper should also match ai');

    fs.rmSync(root, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('selectAssets falls back to heuristics when frontmatter is absent', () => {
    const root = buildFixture();

    const coreOnly = selectAssets({ root, workload: ['core'] });
    const ids = coreOnly.selected.map(a => a.sourceRel);
    // planner.md and planner-skill have no workloads:, identifier-based
    // heuristic returns ["core"]. rules/common/git-workflow.md has no
    // frontmatter at all, the folder fallback returns ["core"].
    assert.ok(ids.includes('agents/planner.md'));
    assert.ok(ids.includes('skills/planner-skill'));
    assert.ok(ids.includes('rules/common/git-workflow.md'));

    fs.rmSync(root, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('selectAssets target paths land under <kind>/_harness/', () => {
    const root = buildFixture();
    const all = selectAssets({ root });
    for (const a of all.selected) {
      assert.ok(
        a.targetRel.startsWith(`${a.kind === 'rule' ? 'rules' : a.kind + 's'}/_harness/`)
        || (a.kind === 'rule' && a.targetRel.startsWith('rules/_harness/')),
        `unexpected targetRel: ${a.kind} → ${a.targetRel}`
      );
    }
    fs.rmSync(root, { recursive: true, force: true });
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
