/**
 * Tests for loop detection: hashToolCall (harness-metrics-bridge) feeding
 * detectLoop (harness-context-monitor).
 *
 * The property that matters is discrimination, not sensitivity. A detector that
 * fires on ordinary progress trains the reader to ignore it, which hides the
 * real loops — so false positives are the failure mode under test here.
 */

'use strict';

const assert = require('assert');

const { hashToolCall } = require('../../scripts/hooks/harness-metrics-bridge');
const monitor = require('../../scripts/hooks/harness-context-monitor');

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

const call = (tool, input) => ({ tool, hash: hashToolCall(tool, input) });

function runTests() {
  console.log('\n=== Testing loop detection (hash + detectLoop) ===\n');
  let passed = 0;
  let failed = 0;

  if (test('three different edits to one file are not a loop', () => {
    const file = '/repo/src/app.js';
    const recent = [
      call('Edit', { file_path: file, old_string: 'a', new_string: 'A' }),
      call('Edit', { file_path: file, old_string: 'b', new_string: 'B' }),
      call('Edit', { file_path: file, old_string: 'c', new_string: 'C' }),
    ];
    const hashes = new Set(recent.map(r => r.hash));
    assert.strictEqual(hashes.size, 3, 'each distinct edit needs its own signature');
    if (typeof monitor.detectLoop === 'function') {
      assert.strictEqual(monitor.detectLoop(recent).detected, false);
    }
  })) passed++; else failed++;

  if (test('re-applying the identical edit three times is a loop', () => {
    const input = { file_path: '/repo/src/app.js', old_string: 'a', new_string: 'A' };
    const recent = [call('Edit', input), call('Edit', input), call('Edit', input)];
    assert.strictEqual(new Set(recent.map(r => r.hash)).size, 1);
    if (typeof monitor.detectLoop === 'function') {
      const loop = monitor.detectLoop(recent);
      assert.strictEqual(loop.detected, true);
      assert.strictEqual(loop.tool, 'Edit');
      assert.strictEqual(loop.count, 3);
    }
  })) passed++; else failed++;

  if (test('reading the same file repeatedly still hashes identically', () => {
    // Read has no payload, so path alone remains the signature — repeated reads
    // of one file are a genuine loop signal.
    const a = hashToolCall('Read', { file_path: '/repo/README.md' });
    const b = hashToolCall('Read', { file_path: '/repo/README.md' });
    assert.strictEqual(a, b);
    assert.notStrictEqual(a, hashToolCall('Read', { file_path: '/repo/OTHER.md' }));
  })) passed++; else failed++;

  if (test('Write with different content to one path is not a loop', () => {
    const file = '/repo/notes.md';
    const first = hashToolCall('Write', { file_path: file, content: 'v1' });
    const second = hashToolCall('Write', { file_path: file, content: 'v2' });
    assert.notStrictEqual(first, second);
  })) passed++; else failed++;

  if (test('edits differing only past the old length cutoff still differ', () => {
    // The signature used to truncate at 2048 chars, so a long old_string could
    // swallow the new_string that actually distinguishes two edits.
    const file = '/repo/big.txt';
    const filler = 'x'.repeat(4000);
    const a = hashToolCall('Edit', { file_path: file, old_string: filler, new_string: 'A' });
    const b = hashToolCall('Edit', { file_path: file, old_string: filler, new_string: 'B' });
    assert.notStrictEqual(a, b);

    const long1 = hashToolCall('Write', { file_path: file, content: `${filler}tail-1` });
    const long2 = hashToolCall('Write', { file_path: file, content: `${filler}tail-2` });
    assert.notStrictEqual(long1, long2);
  })) passed++; else failed++;

  if (test('MultiEdit-shaped input (no top-level file_path) still discriminates', () => {
    // Each entry carries its own file_path, so the file_path branch is skipped —
    // the whole-input path must not truncate either.
    const filler = 'y'.repeat(4000);
    const mk = tail => ({
      edits: [{ file_path: '/repo/a.js', old_string: filler, new_string: tail }],
    });
    assert.notStrictEqual(hashToolCall('MultiEdit', mk('one')), hashToolCall('MultiEdit', mk('two')));
    assert.strictEqual(hashToolCall('MultiEdit', mk('one')), hashToolCall('MultiEdit', mk('one')));
  })) passed++; else failed++;

  if (test('long Bash commands differing only at the tail stay distinct', () => {
    const prefix = `echo ${'z'.repeat(400)}`;
    assert.notStrictEqual(
      hashToolCall('Bash', { command: `${prefix} && npm test` }),
      hashToolCall('Bash', { command: `${prefix} && npm run build` })
    );
  })) passed++; else failed++;

  if (test('distinct Bash commands stay distinct, identical ones collapse', () => {
    assert.notStrictEqual(
      hashToolCall('Bash', { command: 'npm test' }),
      hashToolCall('Bash', { command: 'npm run build' })
    );
    assert.strictEqual(
      hashToolCall('Bash', { command: 'npm test' }),
      hashToolCall('Bash', { command: 'npm test' })
    );
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  return failed === 0;
}

if (require.main === module) {
  process.exit(runTests() ? 0 : 1);
}

module.exports = { runTests };
