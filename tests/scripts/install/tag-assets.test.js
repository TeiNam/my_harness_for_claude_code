/**
 * Tests for scripts/install/tag-assets.js — heuristic frontmatter writer.
 */

'use strict';

const assert = require('assert');

const {
  findFrontmatter,
  hasWorkloadsKey,
  applyWorkloads,
} = require('../../../scripts/install/tag-assets');

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
  console.log('\n=== Testing scripts/install/tag-assets.js ===\n');
  let passed = 0;
  let failed = 0;

  if (test('findFrontmatter returns null when there is no leading ---', () => {
    assert.strictEqual(findFrontmatter('no fm here\n# title\n'), null);
    assert.strictEqual(findFrontmatter('---\nopen but never closed\n'), null);
  })) passed++; else failed++;

  if (test('findFrontmatter locates start/end and exposes the body', () => {
    const fm = findFrontmatter('---\nname: x\ndescription: y\n---\nbody\n');
    assert.ok(fm);
    assert.strictEqual(fm.startLine, 0);
    assert.strictEqual(fm.endLine, 3);
    assert.deepStrictEqual(fm.body, ['name: x', 'description: y']);
  })) passed++; else failed++;

  if (test('hasWorkloadsKey detects existing key', () => {
    assert.strictEqual(hasWorkloadsKey(['name: x', 'workloads: [a]']), true);
    assert.strictEqual(hasWorkloadsKey(['name: x', '  workloads: nested']), false);
    assert.strictEqual(hasWorkloadsKey(['name: x', 'description: y']), false);
  })) passed++; else failed++;

  if (test('applyWorkloads adds the line just before closing ---', () => {
    const input = '---\nname: agent\ndescription: desc\n---\n# Body\n';
    const { changed, reason, text } = applyWorkloads(input, ['python'], { force: false });
    assert.strictEqual(changed, true);
    assert.strictEqual(reason, 'added');
    assert.ok(/\nworkloads: \[python\]\n---\n/.test(text), `did not insert before fence: ${text}`);
    // existing keys are preserved in order
    const idxName = text.indexOf('name: agent');
    const idxWorkloads = text.indexOf('workloads:');
    assert.ok(idxName < idxWorkloads, 'workloads should land below name');
  })) passed++; else failed++;

  if (test('applyWorkloads skips when key already present and !force', () => {
    const input = '---\nname: agent\nworkloads: [rust]\n---\n# Body\n';
    const r = applyWorkloads(input, ['python'], { force: false });
    assert.strictEqual(r.changed, false);
    assert.strictEqual(r.reason, 'has-workloads');
    assert.strictEqual(r.text, input);
  })) passed++; else failed++;

  if (test('applyWorkloads with --force replaces the existing line', () => {
    const input = '---\nname: agent\nworkloads: [rust]\nother: 1\n---\n';
    const r = applyWorkloads(input, ['python', 'ai'], { force: true });
    assert.strictEqual(r.changed, true);
    assert.strictEqual(r.reason, 'replaced');
    assert.ok(r.text.includes('workloads: [python, ai]'));
    assert.ok(!r.text.includes('[rust]'));
    assert.ok(r.text.includes('other: 1'), 'sibling keys preserved');
  })) passed++; else failed++;

  if (test('applyWorkloads --force is a noop when value already matches', () => {
    const input = '---\nname: agent\nworkloads: [python]\n---\n';
    const r = applyWorkloads(input, ['python'], { force: true });
    assert.strictEqual(r.changed, false);
    assert.strictEqual(r.reason, 'noop');
    assert.strictEqual(r.text, input);
  })) passed++; else failed++;

  if (test('applyWorkloads reports no-frontmatter when there is no fence', () => {
    const r = applyWorkloads('plain markdown\n# title\n', ['python'], { force: false });
    assert.strictEqual(r.changed, false);
    assert.strictEqual(r.reason, 'no-frontmatter');
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
