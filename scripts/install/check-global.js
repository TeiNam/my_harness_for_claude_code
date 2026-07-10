#!/usr/bin/env node
'use strict';

/**
 * check-global.js — 글로벌 하네스 baseline 설치 상태를 판정한다.
 *
 * 설치 플로우 1단계: "글로벌이 설치돼 있는가 / 오래됐는가"를 결정한다.
 *   absent   — 매니페스트 없음 또는 _harness 루트 링크 없음 → baseline 신규 설치
 *   outdated — 매니페스트 버전 < repo VERSION            → baseline 갱신
 *   current  — 그 외                                       → 패스
 *
 * install.sh / install.ps1 이 이 CLI 를 호출해 분기한다. stdout 은 JSON 한 덩어리.
 *
 * Usage:
 *   node scripts/install/check-global.js [--claude-home=PATH] [--root=PATH] [--json]
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const { readManifest, repoVersion, compareVersion } = require('./manifest');

function parseArgs(argv) {
  const flags = { claudeHome: null, root: null, json: false };
  for (const a of argv.slice(2)) {
    const eq = a.indexOf('=');
    const key = eq === -1 ? a : a.slice(0, eq);
    const val = eq === -1 ? null : a.slice(eq + 1);
    switch (key) {
      case '--claude-home': flags.claudeHome = val; break;
      case '--root': flags.root = val; break;
      case '--json': flags.json = true; break;
      case '-h':
      case '--help': flags.help = true; break;
      default: throw new Error(`Unknown flag: ${a}`);
    }
  }
  return flags;
}

/**
 * baseline 루트 링크 존재 여부. install.sh 이 repo 루트를
 * `$CLAUDE_HOME/_harness` 로 심볼릭 링크하므로 그 존재를 baseline 신호로 본다.
 */
function harnessRootLinked(claudeHome) {
  const link = path.join(claudeHome, '_harness');
  try {
    // 링크가 dangling 이어도 lstat 은 성공한다 — 존재만 확인.
    fs.lstatSync(link);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * 상태를 판정한다 (순수 함수, 테스트 용이).
 * @returns {{state:'absent'|'outdated'|'current', installedVersion:string|null, repoVersion:string|null, workloads:string[]}}
 */
function evaluate({ claudeHome, root }) {
  const manifest = readManifest(claudeHome);
  const repoV = repoVersion(root);
  const linked = harnessRootLinked(claudeHome);

  if (!manifest || !linked) {
    return {
      state: 'absent',
      installedVersion: manifest ? manifest.version : null,
      repoVersion: repoV,
      workloads: manifest && Array.isArray(manifest.workloads) ? manifest.workloads : [],
    };
  }

  const installedV = manifest.version || null;
  const state = (repoV && installedV && compareVersion(installedV, repoV) < 0)
    ? 'outdated'
    : 'current';

  return {
    state,
    installedVersion: installedV,
    repoVersion: repoV,
    workloads: Array.isArray(manifest.workloads) ? manifest.workloads : [],
  };
}

function main(argv) {
  const flags = parseArgs(argv);
  if (flags.help) {
    console.log([
      'check-global.js — 글로벌 baseline 설치 상태 판정',
      '',
      'Flags:',
      '  --claude-home=PATH   $CLAUDE_HOME 재정의',
      '  --root=PATH          repo 루트 (기본: 이 파일의 ../..)',
      '  --json               (기본 출력이 이미 JSON — 호환용 플래그)',
      '',
      'stdout(JSON): { state, installedVersion, repoVersion, workloads }',
      '  state ∈ absent | outdated | current',
    ].join('\n'));
    return 0;
  }

  const root = flags.root || path.resolve(__dirname, '..', '..');
  const claudeHome = flags.claudeHome || process.env.CLAUDE_HOME || path.join(os.homedir(), '.claude');

  const result = evaluate({ claudeHome, root });
  process.stdout.write(JSON.stringify(result) + '\n');
  return 0;
}

if (require.main === module) {
  try {
    process.exit(main(process.argv));
  } catch (e) {
    process.stderr.write(`[check-global] ${e.message}\n`);
    process.exit(2);
  }
}

module.exports = { evaluate, harnessRootLinked, parseArgs };
