/**
 * Tests for scripts/eval-skills.js — plugin wrapper and result summary.
 * The paid `claude plugin eval` run itself is not exercised here.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { buildPlugin, summarize, parseArgs } = require('../../scripts/eval-skills');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}\n    Error: ${e.message}`);
    failed++;
  }
}

test('buildPlugin wraps skills/ and evals/skills/ as a plugin', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-skills-repo-'));
  fs.mkdirSync(path.join(repo, 'skills', 'demo'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'skills', 'demo', 'SKILL.md'), '---\nname: demo\n---\n');
  fs.mkdirSync(path.join(repo, 'evals', 'skills', 'case-a', 'graders'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'evals', 'skills', 'case-a', 'prompt.md'), 'hi');

  const out = buildPlugin(repo, path.join(repo, 'out'));
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(out, '.claude-plugin', 'plugin.json'), 'utf8')).name, 'harness-skills');
  assert.ok(fs.existsSync(path.join(out, 'skills', 'demo', 'SKILL.md')));
  assert.ok(fs.existsSync(path.join(out, 'evals', 'case-a', 'prompt.md')));
  fs.rmSync(repo, { recursive: true, force: true });
});

test('summarize shows per-arm scores and whether the skill fired', () => {
  const run = (score, fired) => ({ score, graders: [{ name: 'criteria', passed: !!score }, { name: 'fired', passed: fired }] });
  const text = summarize({
    costUsd: 0.5,
    aggregates: { meanDelta: 1 },
    cases: [{ name: 'docker-volume', arms: { with: [run(1, true)], without: [{ score: 0, graders: [{ name: 'criteria', passed: false }] }] } }]
  });
  assert.ok(text.includes('cost $0.50'));
  assert.ok(/docker-volume\s+with: 1\(fired\)\s+without: 0/.test(text), text);
});

test('parseArgs keeps defaults and reads overrides', () => {
  assert.deepStrictEqual(parseArgs([]), { model: 'sonnet', runs: '2', maxCost: '6', caseGlob: null });
  const o = parseArgs(['--model', 'haiku', '--case', 'redis-flush']);
  assert.strictEqual(o.model, 'haiku');
  assert.strictEqual(o.caseGlob, 'redis-flush');
});

console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
