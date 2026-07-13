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

// 카탈로그의 시크릿 플레이스홀더 → 실행 config 의 ${ENV} 참조.
const SECRET_PLACEHOLDERS = {
  YOUR_GITHUB_PAT_HERE: '${GITHUB_PAT}',
  YOUR_BRAVE_API_KEY_HERE: '${BRAVE_API_KEY}',
  YOUR_OBSIDIAN_API_KEY_HERE: '${OBSIDIAN_API_KEY}'
};

function parseArgs(argv) {
  const out = { workloads: [], dryRun: false, list: false };
  for (const a of argv) {
    if (a.startsWith('--workload=') || a.startsWith('--workloads=')) {
      out.workloads = a
        .split('=')[1]
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    } else if (a === '--dry-run') {
      out.dryRun = true;
    } else if (a === '--list') {
      out.list = true;
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
 * 선택된 워크로드 집합에 매칭되는 proxy 서버만 추린다.
 * @returns {{ servers: object, keys: string[], needsTerraform: boolean }}
 */
function selectServers(catalog, selected) {
  const active = new Set([ALWAYS, ...expandAliases(selected)]);
  const servers = {};
  const keys = [];
  for (const [name, entry] of Object.entries(catalog.mcpServers || {})) {
    if (entry.route !== 'proxy') continue; // local 은 프록시 대상 아님
    const wl = entry.workloads || [ALWAYS];
    if (!wl.some(w => active.has(w))) continue;
    servers[name] = toRuntimeEntry(entry);
    keys.push(name);
  }
  return { servers, keys, needsTerraform: keys.includes('terraform') };
}

function build(selected) {
  const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
  const { servers, keys, needsTerraform } = selectServers(catalog, selected);
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
  const { config, keys, needsTerraform } = build(args.workloads);

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
