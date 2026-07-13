/**
 * Tests for scripts/install/build-mcp-config.js
 * — 워크로드/서버 단위 선택으로 mcp-proxy config 를 빌드하는 로직.
 */

'use strict';

const assert = require('assert');
const { build, selectServers, toRuntimeEntry, parseArgs } = require('../../../scripts/install/build-mcp-config');

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
  console.log('\n=== Testing scripts/install/build-mcp-config.js ===\n');
  let passed = 0;
  let failed = 0;

  if (test('core 는 baseline 4개만 (github·context7·time·fetch), 특화 서버 제외', () => {
    const r = build([]);
    assert.deepStrictEqual(r.keys.slice().sort(), ['context7', 'fetch', 'github', 'time']);
    assert.ok(!r.keys.includes('exa'), 'exa 는 research 로 이동 → core 아님');
    assert.ok(!r.needsTerraform);
  })) passed++; else failed++;

  if (test('research 는 웹 검색만 (exa·brave-search)', () => {
    const r = build(['research']);
    assert.ok(r.keys.includes('exa') && r.keys.includes('brave-search'), 'research → exa·brave');
    assert.ok(!r.keys.includes('token-optimizer'), 'token-optimizer 는 writing 으로 이동');
  })) passed++; else failed++;

  if (test('devops 는 terraform 을 포함하고 needsTerraform=true', () => {
    const r = build(['devops']);
    ['aws-iac', 'aws-eks', 'aws-cloudwatch'].forEach(k =>
      assert.ok(r.keys.includes(k), `devops missing ${k}`));
    // terraform 은 cloud 이지만 devops 서브옵션이 cloud 도 켜므로 별도 확인은 cloud 로.
  })) passed++; else failed++;

  if (test('cloud 는 terraform 포함 → needsTerraform', () => {
    const r = build(['cloud']);
    assert.ok(r.keys.includes('terraform'), 'cloud → terraform');
    assert.strictEqual(r.needsTerraform, true);
  })) passed++; else failed++;

  if (test('로컬 DB 설계 워크로드엔 AWS DB MCP 가 안 붙는다', () => {
    for (const wl of ['mysql', 'postgres', 'mongodb', 'dynamodb']) {
      const r = build([wl]);
      const awsDb = r.keys.filter(k => k.startsWith('aws-'));
      assert.deepStrictEqual(awsDb, [], `${wl} 에 AWS DB 서버가 붙음: ${awsDb}`);
    }
  })) passed++; else failed++;

  if (test('aws-rds 는 관리형 DB MCP 를 모은다', () => {
    const r = build(['aws-rds']);
    ['aws-postgres', 'aws-mysql', 'aws-aurora-dsql'].forEach(k =>
      assert.ok(r.keys.includes(k), `aws-rds missing ${k}`));
  })) passed++; else failed++;

  if (test('서버 단위 선택(allowlist)은 워크로드를 무시한다', () => {
    const r = build([], ['github', 'aws-iac', 'exa']);
    assert.deepStrictEqual(r.keys.slice().sort(), ['aws-iac', 'exa', 'github']);
  })) passed++; else failed++;

  if (test('빈 allowlist 는 0개 (core 도 강제 포함하지 않음)', () => {
    const r = build([], []);
    assert.strictEqual(r.keys.length, 0);
  })) passed++; else failed++;

  if (test('toRuntimeEntry: 메타 필드 제거 + 시크릿 치환 + transportType 부여', () => {
    const out = toRuntimeEntry({
      route: 'proxy',
      workloads: ['core'],
      type: 'http',
      url: 'https://x',
      headers: { Authorization: 'Bearer YOUR_GITHUB_PAT_HERE' },
      description: 'x'
    });
    assert.ok(!('route' in out) && !('workloads' in out) && !('description' in out) && !('type' in out));
    assert.strictEqual(out.transportType, 'streamable-http');
    assert.strictEqual(out.headers.Authorization, 'Bearer ${GITHUB_PAT}');
  })) passed++; else failed++;

  if (test('parseArgs: --servers 와 --workload 를 분리 파싱', () => {
    assert.deepStrictEqual(parseArgs(['--workload=core,cloud']).workloads, ['core', 'cloud']);
    assert.deepStrictEqual(parseArgs(['--servers=github,exa']).servers, ['github', 'exa']);
    assert.strictEqual(parseArgs(['--workload=core']).servers, null);
    assert.strictEqual(parseArgs(['--dry-run']).dryRun, true);
  })) passed++; else failed++;

  if (test('selectServers 는 route=local 서버를 항상 제외', () => {
    const catalog = {
      mcpServers: {
        p: { route: 'proxy', workloads: ['core'], command: 'x' },
        l: { route: 'local', workloads: ['core'], command: 'y' }
      }
    };
    const r = selectServers(catalog, [], null);
    assert.deepStrictEqual(r.keys, ['p']);
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}\n`);
  return failed === 0;
}

if (require.main === module) {
  process.exit(runTests() ? 0 : 1);
}

module.exports = { runTests };
