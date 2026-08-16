/**
 * Tests for scripts/install/build-mcp-config.js
 * — 워크로드/서버 단위 선택으로 mcp-proxy config 를 빌드하는 로직.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
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

  if (
    test('core 는 baseline 4개만 (github·context7·time·fetch), 특화 서버 제외', () => {
      const r = build([]);
      assert.deepStrictEqual(r.keys.slice().sort(), ['context7', 'fetch', 'github', 'time']);
      assert.ok(!r.keys.includes('exa'), 'exa 는 research 로 이동 → core 아님');
      assert.ok(!r.needsTerraform);
    })
  )
    passed++;
  else failed++;

  if (
    test('uvx 서버는 mcp<2 핀을 유지한다 (SDK 2.x 에서 Server.list_tools 소멸)', () => {
      // 핀은 카탈로그(SSOT)에 있어야 한다. 생성물 config.json 에만 손으로 넣으면
      // 다음 재빌드에서 날아가고 해당 서버가 기동 실패한다.
      const pinned = build(['core', 'obsidian']).config.mcpServers;
      for (const name of ['time', 'fetch', 'obsidian']) {
        const args = (pinned[name] || {}).args || [];
        assert.ok(args.includes('mcp<2'), `${name} 에 mcp<2 핀이 없음: ${JSON.stringify(args)}`);
        assert.strictEqual(args[args.indexOf('mcp<2') - 1], '--with', `${name}: mcp<2 앞에 --with 필요`);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('research 는 웹 검색만 (exa·brave-search)', () => {
      const r = build(['research']);
      assert.ok(r.keys.includes('exa') && r.keys.includes('brave-search'), 'research → exa·brave');
      assert.ok(!r.keys.includes('token-optimizer'), 'token-optimizer 는 writing 으로 이동');
    })
  )
    passed++;
  else failed++;

  if (
    test('devops 는 terraform 을 포함하고 needsTerraform=true', () => {
      const r = build(['devops']);
      ['aws-iac', 'aws-eks', 'aws-cloudwatch'].forEach(k => assert.ok(r.keys.includes(k), `devops missing ${k}`));
      // terraform 은 cloud 이지만 devops 서브옵션이 cloud 도 켜므로 별도 확인은 cloud 로.
    })
  )
    passed++;
  else failed++;

  if (
    test('cloud 는 terraform 포함 → needsTerraform', () => {
      const r = build(['cloud']);
      assert.ok(r.keys.includes('terraform'), 'cloud → terraform');
      assert.strictEqual(r.needsTerraform, true);
    })
  )
    passed++;
  else failed++;

  if (
    test('로컬 DB 설계 워크로드엔 AWS DB MCP 가 안 붙는다', () => {
      for (const wl of ['mongodb', 'dynamodb']) {
        const r = build([wl]);
        const awsDb = r.keys.filter(k => k.startsWith('aws-'));
        assert.deepStrictEqual(awsDb, [], `${wl} 에 AWS DB 서버가 붙음: ${awsDb}`);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('aws-rds 는 관리형 DB MCP 를 모은다', () => {
      const r = build(['aws-rds']);
      ['aws-postgres', 'aws-mysql', 'aws-aurora-dsql'].forEach(k => assert.ok(r.keys.includes(k), `aws-rds missing ${k}`));
    })
  )
    passed++;
  else failed++;

  if (
    test('서버 단위 선택(allowlist)은 워크로드를 무시한다', () => {
      const r = build([], ['github', 'aws-iac', 'exa']);
      assert.deepStrictEqual(r.keys.slice().sort(), ['aws-iac', 'exa', 'github']);
    })
  )
    passed++;
  else failed++;

  if (
    test('빈 allowlist 는 0개 (core 도 강제 포함하지 않음)', () => {
      const r = build([], []);
      assert.strictEqual(r.keys.length, 0);
    })
  )
    passed++;
  else failed++;

  if (
    test('toRuntimeEntry: 메타 필드 제거 + 시크릿 치환 + transportType 부여', () => {
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
    })
  )
    passed++;
  else failed++;

  if (
    test('parseArgs: --servers 와 --workload 를 분리 파싱', () => {
      assert.deepStrictEqual(parseArgs(['--workload=core,cloud']).workloads, ['core', 'cloud']);
      assert.deepStrictEqual(parseArgs(['--servers=github,exa']).servers, ['github', 'exa']);
      assert.strictEqual(parseArgs(['--workload=core']).servers, null);
      assert.strictEqual(parseArgs(['--dry-run']).dryRun, true);
      assert.deepStrictEqual(parseArgs(['--workload=core']).unknown, []);
    })
  )
    passed++;
  else failed++;

  if (
    test('parseArgs: 미인식 인자를 unknown 으로 모은다 (조용히 무시하면 config 를 덮어씀)', () => {
      assert.deepStrictEqual(parseArgs(['--dryrun']).unknown, ['--dryrun']);
      assert.deepStrictEqual(parseArgs(['--workload=core', '--nope']).unknown, ['--nope']);
      assert.strictEqual(parseArgs(['--help']).help, true);
      assert.strictEqual(parseArgs(['-h']).help, true);
      assert.deepStrictEqual(parseArgs(['--help']).unknown, [], '--help 은 unknown 아님');
    })
  )
    passed++;
  else failed++;

  if (
    test('CLI: --help 과 미인식 인자는 config.json 을 쓰지 않는다', () => {
      const script = path.join(__dirname, '..', '..', '..', 'scripts', 'install', 'build-mcp-config.js');
      const output = path.join(__dirname, '..', '..', '..', 'mcp-configs', 'proxy', 'config.json');
      const before = fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : null;

      const help = spawnSync(process.execPath, [script, '--help'], { encoding: 'utf8' });
      assert.strictEqual(help.status, 0, '--help 은 exit 0');
      assert.ok(/usage:/.test(help.stdout), '--help 은 usage 를 stdout 으로');

      const bad = spawnSync(process.execPath, [script, '--dryrun'], { encoding: 'utf8' });
      assert.strictEqual(bad.status, 2, '미인식 인자는 exit 2');
      assert.ok(/알 수 없는 인자/.test(bad.stderr), '미인식 인자를 stderr 로 알림');

      const after = fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : null;
      assert.strictEqual(after, before, 'config.json 이 변경되면 안 됨');
    })
  )
    passed++;
  else failed++;

  if (
    test('selectServers 는 route=local 서버를 항상 제외', () => {
      const catalog = {
        mcpServers: {
          p: { route: 'proxy', workloads: ['core'], command: 'x' },
          l: { route: 'local', workloads: ['core'], command: 'y' }
        }
      };
      const r = selectServers(catalog, [], null);
      assert.deepStrictEqual(r.keys, ['p']);
    })
  )
    passed++;
  else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}\n`);
  return failed === 0;
}

if (require.main === module) {
  process.exit(runTests() ? 0 : 1);
}

module.exports = { runTests };
