#!/usr/bin/env node
'use strict';

/**
 * select-workloads.js — install.sh / install.ps1 의 워크로드 결정 진입점.
 *
 * 호출 모드:
 *   1) CLI 플래그 모드 — `--category=...` 또는 sub-옵션 플래그가 하나라도
 *      있으면 그 값으로 즉시 결정.
 *   2) 대화형 모드   — TTY 가 연결돼 있고 위 플래그가 없으면 stdin 기반
 *      체크박스 메뉴로 선택을 받는다.
 *   3) 기본값 모드   — TTY 가 없고 플래그도 없으면 모든 카테고리·모든 sub-옵션
 *      = 전체 설치.
 *
 * 출력은 stdout 한 줄짜리 콤마 구분 워크로드 키 목록 (`core,python-backend,...`).
 * install 스크립트는 이걸 그대로 `--workload=` 로 select-assets.js 에 넘긴다.
 *
 * 진단 로그는 stderr 로 보낸다 — stdout 은 기계가 읽는다.
 */

const readline = require('readline');
const {
  CATEGORIES,
  parseCliFlags,
  resolveSelection,
} = require('./menu');

function parseArgv(argv) {
  const flags = {};
  const positional = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--non-interactive') { flags._nonInteractive = true; continue; }
    if (a === '--all')              { flags._all = true; continue; }
    if (a === '--print-categories') { flags._printCategories = true; continue; }
    if (a === '-h' || a === '--help') { flags._help = true; continue; }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        flags[a.slice(2)] = '';
      }
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

function helpText() {
  const cats = CATEGORIES.map(c => {
    const subs = c.subOptions
      ? c.subOptions.map(s => s.id).join(',')
      : '(no sub-options)';
    return `  --${c.id.padEnd(14)}=${subs}`;
  }).join('\n');
  return [
    'select-workloads.js — 워크로드 선택 진입점',
    '',
    '사용:',
    '  node select-workloads.js                 대화형 메뉴 (TTY) 또는 전체',
    '  node select-workloads.js --all           플래그/메뉴 없이 전체 설치',
    '  node select-workloads.js --non-interactive --category=...  CLI 모드',
    '',
    'CLI 플래그:',
    '  --category=backend,writing         사용할 톱레벨 카테고리 (콤마 구분)',
    '  --<category>=<sub1>,<sub2>         각 카테고리의 sub-옵션',
    cats,
    '',
    '출력:',
    '  stdout: 콤마 구분 워크로드 키 (예: core,python-backend,frontend)',
    '  stderr: 진단 로그',
  ].join('\n');
}

function hasAnyFlagSelection(flags) {
  if ('category' in flags) return true;
  for (const c of CATEGORIES) if (c.id in flags) return true;
  return false;
}

function selectAll() {
  const categories = CATEGORIES.map(c => c.id);
  const subSelections = {};
  for (const c of CATEGORIES) {
    if (c.subOptions) subSelections[c.id] = c.subOptions.map(s => s.id);
  }
  return resolveSelection({ categories, subSelections });
}

/**
 * stdin 기반 대화형 메뉴. enquirer 등 외부 패키지에 의존하지 않도록
 * "1,3" / "all" / "skip" 같은 텍스트 입력을 받는다.
 */
async function runInteractive() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  const ask = q => new Promise(resolve => rl.question(q, resolve));

  process.stderr.write('\n=== 설치할 워크로드를 선택하세요 ===\n');
  process.stderr.write('카테고리 번호를 콤마로 입력하세요. "all" = 전부, "skip" 후 Enter = 글쓰기만.\n\n');

  CATEGORIES.forEach((c, i) => {
    process.stderr.write(`  ${i + 1}) ${c.label}\n`);
  });
  process.stderr.write('\n');

  const catAnswer = (await ask('카테고리 [기본 all]: ')).trim();
  let chosenCategoryIdx;
  if (!catAnswer || catAnswer === 'all') {
    chosenCategoryIdx = CATEGORIES.map((_, i) => i);
  } else if (catAnswer === 'skip') {
    chosenCategoryIdx = [];
  } else {
    chosenCategoryIdx = catAnswer.split(',')
      .map(s => parseInt(s.trim(), 10) - 1)
      .filter(n => Number.isInteger(n) && n >= 0 && n < CATEGORIES.length);
  }

  const categories = chosenCategoryIdx.map(i => CATEGORIES[i].id);
  const subSelections = {};

  for (const idx of chosenCategoryIdx) {
    const cat = CATEGORIES[idx];
    if (!cat.subOptions || cat.subOptions.length === 0) continue;

    process.stderr.write(`\n[${cat.label}] ${cat.subQuestion || '항목을 고르세요'}\n`);
    cat.subOptions.forEach((s, i) => {
      process.stderr.write(`    ${i + 1}) ${s.label}\n`);
    });
    const ans = (await ask(`  선택 [기본 all]: `)).trim();
    if (!ans || ans === 'all') {
      subSelections[cat.id] = cat.subOptions.map(s => s.id);
    } else {
      subSelections[cat.id] = ans.split(',')
        .map(s => parseInt(s.trim(), 10) - 1)
        .filter(n => Number.isInteger(n) && n >= 0 && n < cat.subOptions.length)
        .map(n => cat.subOptions[n].id);
    }
  }

  rl.close();
  return resolveSelection({ categories, subSelections });
}

async function main() {
  const { flags } = parseArgv(process.argv);
  if (flags._help) { process.stdout.write(helpText() + '\n'); return 0; }
  if (flags._printCategories) {
    process.stdout.write(JSON.stringify(CATEGORIES, null, 2) + '\n');
    return 0;
  }

  let result;
  if (flags._all) {
    result = selectAll();
  } else if (hasAnyFlagSelection(flags)) {
    const { categories, subSelections } = parseCliFlags(flags);
    result = resolveSelection({ categories, subSelections });
  } else if (flags._nonInteractive || !process.stdin.isTTY) {
    // TTY 가 없고 플래그도 없을 때는 전체 설치가 가장 안전한 기본.
    process.stderr.write('[select-workloads] no flags and not a TTY — defaulting to --all\n');
    result = selectAll();
  } else {
    result = await runInteractive();
  }

  if (result.unknownCategories.length) {
    process.stderr.write(`Unknown categories: ${result.unknownCategories.join(', ')}\n`);
    return 2;
  }
  if (result.unknownSubs.length) {
    process.stderr.write(`Unknown sub-options: ${result.unknownSubs.join(', ')}\n`);
    return 2;
  }

  process.stdout.write(result.workloads.join(',') + '\n');
  return 0;
}

if (require.main === module) {
  main().then(code => process.exit(code || 0)).catch(err => {
    process.stderr.write(`[select-workloads] ${err.message}\n`);
    process.exit(1);
  });
}

module.exports = {
  parseArgv,
  selectAll,
  runInteractive,
};
