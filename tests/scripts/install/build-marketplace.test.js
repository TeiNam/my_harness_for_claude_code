/**
 * Tests for scripts/install/build-marketplace.js — turns flat harness assets
 * into one `/plugin` per workload group.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildPlan,
  marketplaceJson,
  pluginJson,
  pluginName,
  generate,
  check,
} = require('../../../scripts/install/build-marketplace');

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'harness-mp-'));
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

/** Minimal harness: a mysql agent, a frontend skill, a core command, a rule. */
function buildFixture() {
  const root = tmp();
  writeFile(path.join(root, 'agents/rdbms-data-modeler.md'),
    '---\nname: rdbms-data-modeler\nworkloads: [mysql, postgres]\n---\nbody\n');
  writeFile(path.join(root, 'commands/plan.md'),
    '---\ndescription: x\nworkloads: [core]\n---\n');
  writeFile(path.join(root, 'skills/mysql-guideline/SKILL.md'),
    '---\nname: mysql-guideline\nworkloads: [mysql]\n---\n');
  writeFile(path.join(root, 'skills/frontend-patterns/SKILL.md'),
    '---\nname: frontend-patterns\nworkloads: [frontend]\n---\n');
  // rules are NOT plugin components — must be ignored by the generator.
  writeFile(path.join(root, 'rules/common/git.md'), '---\nworkloads: [core]\n---\n');
  // lab group must never become a plugin.
  writeFile(path.join(root, 'agents/lab-toy.md'),
    '---\nname: lab-toy\nworkloads: [lab]\n---\n');
  return root;
}

function runTests() {
  console.log('\n=== Testing scripts/install/build-marketplace.js ===\n');
  let passed = 0;
  let failed = 0;

  if (test('buildPlan buckets assets by group, skips rules and lab', () => {
    const root = buildFixture();
    const plan = buildPlan(root);

    // mysql plugin has the agent + the skill.
    assert.deepStrictEqual(
      plan.mysql.map(a => a.linkRel).sort(),
      ['agents/rdbms-data-modeler.md', 'skills/mysql-guideline']
    );
    // postgres shares the multi-tag agent.
    assert.deepStrictEqual(plan.postgres.map(a => a.linkRel), ['agents/rdbms-data-modeler.md']);
    // frontend has only the skill.
    assert.deepStrictEqual(plan.frontend.map(a => a.linkRel), ['skills/frontend-patterns']);
    // core has the command but NOT the rule (rules aren't plugin components).
    assert.deepStrictEqual(plan.core.map(a => a.linkRel), ['commands/plan.md']);
    // lab never appears.
    assert.ok(!('lab' in plan), 'lab must not become a plugin');

    fs.rmSync(root, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('marketplaceJson lists one entry per plan group with ./plugins source', () => {
    const root = buildFixture();
    const plan = buildPlan(root);
    const mp = marketplaceJson(plan);
    assert.strictEqual(mp.name, 'harness');
    const names = mp.plugins.map(p => p.name).sort();
    assert.deepStrictEqual(names, ['harness-core', 'harness-frontend', 'harness-mysql', 'harness-postgres']);
    for (const p of mp.plugins) {
      assert.strictEqual(p.source, `./plugins/${p.name}`);
    }
    fs.rmSync(root, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('pluginJson carries name, version, author', () => {
    const pj = pluginJson('mysql');
    assert.strictEqual(pj.name, 'harness-mysql');
    assert.ok(pj.version, 'version present');
    assert.ok(pj.author && pj.author.name, 'author present');
  })) passed++; else failed++;

  if (test('generate symlinks skills (dir) but copies agents (file)', () => {
    const root = buildFixture();
    const plan = buildPlan(root);
    generate(root, plan, false);

    const mysqlDir = path.join(root, 'plugins', pluginName('mysql'));
    // skill is a symlink (zero duplication).
    const skillLink = path.join(mysqlDir, 'skills/mysql-guideline');
    assert.ok(fs.lstatSync(skillLink).isSymbolicLink(), 'skill should be a symlink');
    // agent is a real file (plugin discovery ignores file symlinks).
    const agentFile = path.join(mysqlDir, 'agents/rdbms-data-modeler.md');
    assert.ok(!fs.lstatSync(agentFile).isSymbolicLink(), 'agent must be a real copy');
    assert.ok(fs.readFileSync(agentFile, 'utf8').includes('rdbms-data-modeler'));
    // plugin.json written.
    assert.ok(fs.existsSync(path.join(mysqlDir, '.claude-plugin/plugin.json')));
    // marketplace.json written.
    assert.ok(fs.existsSync(path.join(root, '.claude-plugin/marketplace.json')));

    fs.rmSync(root, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('--copy materialises skills as real dirs too', () => {
    const root = buildFixture();
    const plan = buildPlan(root);
    generate(root, plan, true);
    const skillEntry = path.join(root, 'plugins', pluginName('mysql'), 'skills/mysql-guideline');
    assert.ok(!fs.lstatSync(skillEntry).isSymbolicLink(), 'skill should be a real dir under --copy');
    assert.ok(fs.existsSync(path.join(skillEntry, 'SKILL.md')));
    fs.rmSync(root, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('check is clean right after generate, detects stale copied agent', () => {
    const root = buildFixture();
    const plan = buildPlan(root);
    generate(root, plan, false);
    assert.deepStrictEqual(check(root, plan), [], 'fresh output should be clean');

    // Edit a source agent without regenerating → drift.
    writeFile(path.join(root, 'agents/rdbms-data-modeler.md'),
      '---\nname: rdbms-data-modeler\nworkloads: [mysql, postgres]\n---\nCHANGED\n');
    const planAfter = buildPlan(root);
    const problems = check(root, planAfter);
    assert.ok(problems.some(p => /stale/.test(p)), `expected a stale report, got: ${problems.join('; ')}`);

    fs.rmSync(root, { recursive: true, force: true });
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
