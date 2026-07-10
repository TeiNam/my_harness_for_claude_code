#!/usr/bin/env node
'use strict';

/**
 * manifest.js — 하네스 설치 상태를 기록하는 매니페스트 read/write + 버전 비교.
 *
 * 설치는 심볼릭 링크 기반이라 따로 버전된 산출물이 없다. 그래서 설치 시
 * `$CLAUDE_HOME/_harness-manifest.json` 에 버전·워크로드·설치시각을 남겨,
 * "글로벌이 설치돼 있는가 / 오래됐는가" 판정의 단일 소스로 쓴다.
 *
 * 순수 모듈: 타임스탬프는 호출부에서 주입한다 (Date.now 직접 호출 안 함).
 */

const fs = require('fs');
const path = require('path');

const MANIFEST_NAME = '_harness-manifest.json';

function manifestPath(claudeHome) {
  return path.join(claudeHome, MANIFEST_NAME);
}

/**
 * 매니페스트를 읽는다. 없거나 깨졌으면 null (throw 안 함 — 부재는 정상 상태).
 * @param {string} claudeHome
 * @returns {{version: string, workloads: string[], installedAt: string} | null}
 */
function readManifest(claudeHome) {
  const file = manifestPath(claudeHome);
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (_) {
    return null; // 파일 없음
  }
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return null;
    return obj;
  } catch (_) {
    return null; // 손상된 JSON — 재설치 유발이 안전
  }
}

/**
 * 매니페스트를 쓴다. installedAt 은 호출부가 주입 (모듈 순수성 유지).
 * @param {string} claudeHome
 * @param {{version: string, workloads: string[], installedAt?: string}} data
 */
function writeManifest(claudeHome, data) {
  const file = manifestPath(claudeHome);
  const payload = {
    version: data.version,
    workloads: Array.isArray(data.workloads) ? data.workloads.slice().sort() : [],
    installedAt: data.installedAt || null,
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n');
}

/**
 * repo 루트의 VERSION 파일을 읽어 트림한 문자열 반환. 없으면 null.
 * @param {string} root
 * @returns {string | null}
 */
function repoVersion(root) {
  try {
    return fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim() || null;
  } catch (_) {
    return null;
  }
}

/**
 * semver-lite 비교. major.minor.patch 를 숫자로 비교한다 (pre-release 무시).
 * 누락된 세그먼트는 0 취급. 숫자가 아니면 0.
 * @returns {-1|0|1}  a<b → -1, a==b → 0, a>b → 1
 */
function compareVersion(a, b) {
  const parse = v => String(v || '')
    .split('.')
    .map(s => parseInt(s, 10))
    .map(n => (Number.isFinite(n) ? n : 0));
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

/**
 * CLI: install 스크립트가 매니페스트를 기록할 때 호출한다 (bash/pwsh 가 node -e
 * 를 인라인하지 않도록). installedAt 은 여기서 new Date() 로 스탬프한다 —
 * CLI 진입점은 순수성 대상이 아니다 (모듈 함수는 여전히 순수).
 *
 *   node manifest.js write --claude-home=PATH --version=X --workloads=a,b
 *   node manifest.js read  --claude-home=PATH        # JSON 또는 빈 출력
 */
function main(argv) {
  const cmd = argv[2];
  const flags = {};
  for (const a of argv.slice(3)) {
    const eq = a.indexOf('=');
    if (eq !== -1) flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  const claudeHome = flags['claude-home'] || process.env.CLAUDE_HOME;
  if (!claudeHome) { process.stderr.write('[manifest] --claude-home required\n'); return 2; }

  if (cmd === 'write') {
    const workloads = (flags.workloads || '').split(',').map(s => s.trim()).filter(Boolean);
    writeManifest(claudeHome, {
      version: flags.version || null,
      workloads,
      installedAt: new Date().toISOString(),
    });
    return 0;
  }
  if (cmd === 'read') {
    const m = readManifest(claudeHome);
    if (m) process.stdout.write(JSON.stringify(m) + '\n');
    return 0;
  }
  process.stderr.write('[manifest] usage: manifest.js write|read --claude-home=PATH ...\n');
  return 2;
}

if (require.main === module) {
  try {
    process.exit(main(process.argv));
  } catch (e) {
    process.stderr.write(`[manifest] ${e.message}\n`);
    process.exit(2);
  }
}

module.exports = {
  MANIFEST_NAME,
  manifestPath,
  readManifest,
  writeManifest,
  repoVersion,
  compareVersion,
};
