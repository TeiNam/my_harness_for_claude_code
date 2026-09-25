/**
 * Tests for scripts/hooks/cost-tracker.js
 *
 * 핵심 계약: 모델 ID(Bedrock 접두 포함)가 세대별 요금으로 매칭된다.
 * Opus 5.5·Fable 5.1 은 캐시 읽기 배율이 달라(0.05x·0.025x) 한 줄 매칭으로는 틀린다.
 */

const assert = require('assert');

const { getRates, RATE_TABLE } = require('../../scripts/hooks/cost-tracker.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed += 1;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error.message}`);
    failed += 1;
  }
}

console.log('\n=== Testing cost-tracker.js ===\n');

const CASES = [
  ['global.anthropic.claude-opus-5-5', RATE_TABLE.opus],
  ['claude-opus-5', RATE_TABLE.opusLegacy],
  ['claude-opus-4-8', RATE_TABLE.opusLegacy],
  ['global.anthropic.claude-fable-5-1', RATE_TABLE.fable],
  ['claude-fable-5', RATE_TABLE.fableLegacy],
  ['global.anthropic.claude-sonnet-5', RATE_TABLE.sonnet],
  ['global.anthropic.claude-sonnet-4-5-20250929-v1:0', RATE_TABLE.sonnetLegacy],
  ['global.anthropic.claude-haiku-4-5-20251001-v1:0', RATE_TABLE.haiku],
  ['unknown', RATE_TABLE.sonnetLegacy]
];

for (const [model, expected] of CASES) {
  test(`${model} → matching rate row`, () => {
    assert.deepStrictEqual(getRates(model), expected);
  });
}

test('Opus 5.5 / Fable 5.1 cache-read multipliers are 0.05x / 0.025x', () => {
  assert.strictEqual(RATE_TABLE.opus.cacheRead, RATE_TABLE.opus.in * 0.05);
  assert.strictEqual(RATE_TABLE.fable.cacheRead, RATE_TABLE.fable.in * 0.025);
});

console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
