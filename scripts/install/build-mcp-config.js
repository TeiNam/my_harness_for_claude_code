#!/usr/bin/env node
'use strict';

/**
 * 선택된 워크로드에 맞는 proxy 서버만 골라 mcp-proxy config.json 을 빌드한다.
 *
 * 입력: --workload=core,cloud,obsidian (CSV). core 는 항상 포함.
 * 소스: mcp-configs/mcp-servers.json (카탈로그, route/workloads 표시).
 * 출력: mcp-configs/proxy/config.json (route=proxy 이고 워크로드 매칭되는 서버만).
 *
 * "설치 시 모든 MCP 를 통짜로 띄우지 않고 필요한 것만" 을 위한 빌더.
 * route=local 서버(sentry·playwright 등)는 프록시 대상이 아니므로 제외한다.
 *
 * 카탈로그 항목은 사람이 읽는 형식(플레이스홀더 시크릿·type:http)이라, 실행
 * 형식(config.json: ${VAR} 치환·transportType)으로 정규화해서 쓴다.
 *
 * 사용:
 *   node build-mcp-config.js --workload=core,cloud            # config.json 쓰기
 *   node build-mcp-config.js --workload=core --dry-run        # 미리보기(stdout)
 *   node build-mcp-config.js --workload=core --list           # 선택된 서버 키만
 * 반환: 활성화할 별도 compose 서비스가 있으면 stderr 로 알림(terraform-mcp).
 */

const fs = require('fs');
const path = require('path');
const { expandAliases } = require('./workloads');

const ROOT = path.join(__dirname, '..', '..');
const CATALOG = path.join(ROOT, 'mcp-configs', 'mcp-servers.json');
const OUTPUT = path.join(ROOT, 'mcp-configs', 'proxy', 'config.json');

// core 는 항상 포함되는 baseline 워크로드.
const ALWAYS = 'core';

// 컨텍스트 윈도 보호 권장 상한. 이 수를 넘으면 경고한다(차단은 안 함).
// CLAUDE.md 의 "동시 활성 MCP 10개 이하" 를 프록시 기준 8개로 더 보수적으로 잡음.
const RECOMMENDED_MAX = 8;

// 카탈로그의 시크릿 플레이스홀더 → 실행 config 의 ${ENV} 참조.
const SECRET_PLACEHOLDERS = {
  YOUR_GITHUB_PAT_HERE: '${GITHUB_PAT}',
  YOUR_BRAVE_API_KEY_HERE: '${BRAVE_API_KEY}',
  YOUR_OBSIDIAN_API_KEY_HERE: '${OBSIDIAN_API_KEY}'
};

const USAGE = [
  'usage: build-mcp-config.js [--workload=a,b] [--servers=x,y] [--dry-run] [--list]',
  '',
  '  --workload=core,cloud   워크로드 CSV (core 는 항상 포함)',
  '  --servers=github,exa    서버 단위 명시 선택 (워크로드 매칭 건너뜀)',
  '  --dry-run               config.json 을 쓰지 않고 미리보기',
  '  --list                  선택된 서버 키만 stdout 으로',
  '  --help                  이 도움말'
].join('\n');

/** 미인식 인자는 조용히 무시하지 않는다 — 무시하면 workloads 가 빈 배열로
 *  떨어져 core 기본값으로 config.json 을 덮어쓴다(오타 한 번에 서버 유실). */
function parseArgs(argv) {
  const out = { workloads: [], servers: null, dryRun: false, list: false, help: false, unknown: [] };
  for (const a of argv) {
    if (a.startsWith('--workload=') || a.startsWith('--workloads=')) {
      out.workloads = a
        .split('=')[1]
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    } else if (a.startsWith('--servers=')) {
      // 서버 단위 명시 선택(대화형 체크박스가 넘겨주는 값). 워크로드 매칭을 건너뛴다.
      out.servers = a
        .split('=')[1]
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    } else if (a === '--dry-run') {
      out.dryRun = true;
    } else if (a === '--list') {
      out.list = true;
    } else if (a === '--help' || a === '-h') {
      out.help = true;
    } else {
      out.unknown.push(a);
    }
  }
  return out;
}

/** 카탈로그 값의 문자열 안 플레이스홀더를 ${ENV} 로 치환(재귀).
 *  플레이스홀더가 "Bearer YOUR_GITHUB_PAT_HERE" 처럼 다른 텍스트에 박혀 있을 수
 *  있으므로 부분 문자열 치환한다. */
function substituteSecrets(value) {
  if (typeof value === 'string') {
    let out = value;
    for (const [placeholder, envRef] of Object.entries(SECRET_PLACEHOLDERS)) {
      out = out.split(placeholder).join(envRef);
    }
    return out;
  }
  if (Array.isArray(value)) return value.map(substituteSecrets);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = substituteSecrets(v);
    return out;
  }
  return value;
}

/**
 * 카탈로그 서버 항목을 실행 config.json 형식으로 정규화한다.
 * - route/workloads/description 등 메타 필드는 뺀다.
 * - type:"http" → transportType:"streamable-http" (mcp-proxy 규약).
 * - 시크릿 플레이스홀더 → ${ENV}.
 */
function toRuntimeEntry(entry) {
  const { route, workloads, description, type, ...rest } = entry;
  const runtime = substituteSecrets(rest);
  if (type === 'http' && !runtime.transportType) {
    runtime.transportType = 'streamable-http';
  }
  return runtime;
}

/**
 * proxy 서버를 추린다. `serverAllowlist` 가 주어지면 그 이름들만(서버 단위 선택,
 * 대화형 체크박스용), 아니면 선택된 워크로드에 매칭되는 서버를 고른다.
 * @param {object} catalog
 * @param {string[]} selected - 워크로드 키
 * @param {string[]|null} serverAllowlist - 서버 이름 목록(있으면 워크로드 무시)
 * @returns {{ servers: object, keys: string[], needsTerraform: boolean }}
 */
function selectServers(catalog, selected, serverAllowlist = null) {
  const active = new Set([ALWAYS, ...expandAliases(selected)]);
  const allow = serverAllowlist ? new Set(serverAllowlist) : null;
  const servers = {};
  const keys = [];
  for (const [name, entry] of Object.entries(catalog.mcpServers || {})) {
    if (entry.route !== 'proxy') continue; // local 은 프록시 대상 아님
    if (allow) {
      if (!allow.has(name)) continue; // 서버 단위 명시 선택
    } else {
      const wl = entry.workloads || [ALWAYS];
      if (!wl.some(w => active.has(w))) continue;
    }
    servers[name] = toRuntimeEntry(entry);
    keys.push(name);
  }
  return { servers, keys, needsTerraform: keys.includes('terraform') };
}

function build(selected, serverAllowlist = null) {
  const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
  const { servers, keys, needsTerraform } = selectServers(catalog, selected, serverAllowlist);
  const config = {
    mcpProxy: {
      baseURL: 'http://localhost:9090',
      addr: ':9090',
      name: 'Harness MCP Proxy',
      type: 'streamable-http'
    },
    mcpServers: servers
  };
  return { config, keys, needsTerraform };
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    process.stdout.write(USAGE + '\n');
    return;
  }
  if (args.unknown.length) {
    process.stderr.write(`[build-mcp-config] 알 수 없는 인자: ${args.unknown.join(' ')}\n${USAGE}\n`);
    process.exitCode = 2;
    return;
  }

  const { config, keys, needsTerraform } = build(args.workloads, args.servers);

  if (args.list) {
    process.stdout.write(keys.join('\n') + (keys.length ? '\n' : ''));
    return;
  }

  const json = JSON.stringify(config, null, 2) + '\n';

  // 요약·terraform 알림은 항상 stderr 로(호출부가 grep 한다). --dry-run 은 파일만 안 쓴다.
  if (args.dryRun) {
    process.stderr.write(`[build-mcp-config] [dry-run] ${keys.length} proxy 서버 (미기록):\n`);
  } else {
    fs.writeFileSync(OUTPUT, json, 'utf8');
    process.stderr.write(`[build-mcp-config] ${keys.length} proxy 서버 → ${path.relative(ROOT, OUTPUT)}\n`);
  }
  process.stderr.write(`  ${keys.join(', ')}\n`);

  // 컨텍스트 윈도 보호: 권장 상한 초과 시 경고(차단 안 함). 서버 단위 재선택 유도.
  if (keys.length > RECOMMENDED_MAX) {
    process.stderr.write(
      `[build-mcp-config] [!] ${keys.length}개 — 권장 상한 ${RECOMMENDED_MAX}개 초과. ` +
        `동시 활성 MCP 가 많으면 컨텍스트 윈도를 잠식합니다.\n` +
        `  필요한 것만 골라 재빌드: node scripts/install/build-mcp-config.js --servers=github,exa,...\n` +
        `  (전체 목록: --list)\n`
    );
  }

  // terraform 은 별도 compose 서비스(terraform-mcp)가 필요하다. 호출부가 알 수 있게 알림.
  if (needsTerraform) {
    process.stderr.write('[build-mcp-config] terraform 선택됨 — compose 의 terraform-mcp 서비스도 함께 기동됩니다.\n');
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`[build-mcp-config] error: ${err.message}\n`);
    process.exit(1);
  }
} else {
  module.exports = { build, selectServers, toRuntimeEntry, parseArgs };
}
