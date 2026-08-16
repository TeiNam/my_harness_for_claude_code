/**
 * Smoke test for scripts/hooks/stop-format-typecheck.js.
 *
 * This hook replaced the per-edit pair post-edit-format.js / post-edit-typecheck.js
 * (deleted 2026-08-16), which carried 49 tests between them. Those tests all
 * asserted the same contract, so it is kept here against the live script: a Stop
 * hook must never block the user, and it must pass stdin through unchanged so the
 * next hook in the chain still sees the event.
 */

'use strict';

const assert = require('assert');
const path = require('path');
const { spawn } = require('child_process');

const SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'hooks', 'stop-format-typecheck.js');

function runScript(stdin) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [SCRIPT], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => (stdout += d));
    child.stderr.on('data', d => (stderr += d));
    child.on('close', code => resolve({ code, stdout, stderr }));
    child.stdin.end(stdin || '');
  });
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (e) {
    console.log(`  ✗ ${name}\n    Error: ${e.message}`);
    return false;
  }
}

async function runTests() {
  console.log('\n=== Testing scripts/hooks/stop-format-typecheck.js ===\n');
  let passed = 0;
  let failed = 0;

  if (await asyncTest('exits 0 on empty stdin', async () => {
    const r = await runScript('');
    assert.strictEqual(r.code, 0, `Stop hooks must not block; got ${r.code} / ${r.stderr}`);
  })) passed++; else failed++;

  if (await asyncTest('exits 0 and passes stdin through on malformed JSON', async () => {
    const r = await runScript('not json at all');
    assert.strictEqual(r.code, 0, r.stderr);
    assert.ok(r.stdout.includes('not json at all'), `stdin should pass through, got: ${r.stdout}`);
  })) passed++; else failed++;

  if (await asyncTest('exits 0 and passes stdin through on a well-formed event', async () => {
    const payload = JSON.stringify({ session_id: 'test-session', transcript_path: '/nonexistent.jsonl' });
    const r = await runScript(payload);
    assert.strictEqual(r.code, 0, r.stderr);
    assert.ok(r.stdout.includes('test-session'), `stdin should pass through, got: ${r.stdout}`);
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  return failed === 0;
}

if (require.main === module) {
  runTests().then(ok => process.exit(ok ? 0 : 1));
}

module.exports = { runTests };
