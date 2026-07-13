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

const { CATEGORIES, parseCliFlags, resolveSelection } = require('./menu');
const { checkboxPrompt } = require('./checkbox-prompt');

function parseArgv(argv) {
  const flags = {};
  const positional = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--non-interactive') {
      flags._nonInteractive = true;
      continue;
    }
    if (a === '--all') {
      flags._all = true;
      continue;
    }
    if (a === '--print-categories') {
      flags._printCategories = true;
      continue;
    }
    if (a === '-h' || a === '--help') {
      flags._help = true;
      continue;
    }
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
  const lines = [];
  for (const c of CATEGORIES) {
    if (c.detailOptions) {
      // 카테고리 레벨 상세 (apple)
      lines.push(`  --${c.id.padEnd(16)}=${c.detailOptions.map(d => d.id).join(',')}   (상세)`);
    } else if (c.subOptions) {
      lines.push(`  --${c.id.padEnd(16)}=${c.subOptions.map(s => s.id).join(',')}`);
      for (const s of c.subOptions) {
        if (!s.detailOptions) continue;
        lines.push(`  --${`${c.id}-${s.id}`.padEnd(16)}=${s.detailOptions.map(d => d.id).join(',')}   (상세)`);
      }
    } else {
      lines.push(`  --${c.id.padEnd(16)}   (no sub-options)`);
    }
  }
  return [
    'select-workloads.js — 워크로드 선택 진입점',
    '',
    '사용:',
    '  node select-workloads.js                 대화형 3단계 체크박스 (TTY) 또는 전체',
    '  node select-workloads.js --all           플래그/메뉴 없이 전체 설치',
    '  node select-workloads.js --non-interactive --category=...  CLI 모드',
    '',
    'CLI 플래그:',
    '  --category=dev,cloud               사용할 톱레벨 카테고리 (콤마 구분)',
    '  --<category>=<sub1>,<sub2>         각 카테고리의 sub-옵션 (예: --dev=frontend,python)',
    '  --<category>-<sub>=<detail1>,...  sub 레벨 상세 (예: --dev-apple=core, --writing-social=voice)',
    ...lines,
    '',
    '출력:',
    '  stdout: 콤마 구분 워크로드 키 (예: core,python-backend,frontend)',
    '  stderr: 진단 로그'
  ].join('\n');
}

/** 인식되는 메뉴 플래그 이름 전체 집합 (category + 각 sub 레벨 상세). */
function knownFlagNames() {
  const names = new Set(['category']);
  for (const c of CATEGORIES) {
    names.add(c.id);
    for (const s of c.subOptions || []) {
      if (s.detailOptions && s.detailOptions.length) names.add(`${c.id}-${s.id}`);
    }
  }
  return names;
}

/**
 * 사용자가 준 `--xxx=` 플래그 중 인식되지 않는 것(옛 플래그·오타)을 찾는다.
 * parseArgv 는 `_` 접두 내부 플래그(_all/_nonInteractive 등)와 실제 플래그를
 * 한 객체에 담으므로 내부 플래그는 제외한다.
 */
function unknownFlagNames(flags) {
  const known = knownFlagNames();
  return Object.keys(flags).filter(k => !k.startsWith('_') && !known.has(k));
}

function hasAnyFlagSelection(flags) {
  if ('category' in flags) return true;
  for (const c of CATEGORIES) {
    if (c.id in flags) return true;
    // sub 레벨 상세 플래그: --<catId>-<subId> (예: --writing-social)
    for (const s of c.subOptions || []) {
      if (`${c.id}-${s.id}` in flags) return true;
    }
  }
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
 * stdin 기반 3단계 대화형 메뉴 (방향키 체크박스).
 *   1) 대분류(카테고리)  →  2) 중분류(sub-옵션)  →  3) 상세(detail, 있을 때만)
 * 각 단계는 checkbox-prompt.js 를 재사용한다. 아무것도 안 고르면 그 단계는
 * "전체"로 해석된다 (resolveSelection 의 빈 배열 = 전체 규칙과 일치).
 */
async function runInteractive() {
  process.stderr.write('\n=== 설치할 워크로드를 선택하세요 ===\n');

  // 1단계: 대분류
  const chosenCatIds = await checkboxPrompt({
    title: '대분류 (space 토글 · a 전체 · enter 확정):',
    options: CATEGORIES.map(c => ({ id: c.id, label: c.label }))
  });
  const categories = chosenCatIds.length ? chosenCatIds : [];

  const subSelections = {};
  const detailSelections = {};

  for (const catId of categories) {
    const cat = CATEGORIES.find(c => c.id === catId);
    if (!cat) continue;

    // 카테고리 레벨 상세 tier (예: apple — sub 없음)
    if (cat.detailOptions && cat.detailOptions.length) {
      detailSelections[catId] = await checkboxPrompt({
        title: `\n[${cat.label}] ${cat.detailQuestion || '항목을 고르세요'} (미선택 = 전체):`,
        options: cat.detailOptions.map(d => ({ id: d.id, label: d.label }))
      });
      continue;
    }

    if (!cat.subOptions || cat.subOptions.length === 0) continue;

    // 2단계: 중분류
    const subIds = await checkboxPrompt({
      title: `\n[${cat.label}] ${cat.subQuestion || '항목을 고르세요'} (미선택 = 전체):`,
      options: cat.subOptions.map(s => ({ id: s.id, label: s.label }))
    });
    subSelections[catId] = subIds; // 빈 배열이면 resolveSelection 이 전체로 해석

    // 3단계: 상세 (선택된 sub 중 detailOptions 를 가진 것만)
    const effectiveSubs = subIds.length ? subIds : cat.subOptions.map(s => s.id);
    for (const subId of effectiveSubs) {
      const sub = cat.subOptions.find(s => s.id === subId);
      if (!sub || !sub.detailOptions || !sub.detailOptions.length) continue;
      detailSelections[`${catId}.${subId}`] = await checkboxPrompt({
        title: `\n[${cat.label} › ${sub.label}] ${sub.detailQuestion || '항목을 고르세요'} (미선택 = 전체):`,
        options: sub.detailOptions.map(d => ({ id: d.id, label: d.label }))
      });
    }
  }

  return resolveSelection({ categories, subSelections, detailSelections });
}

async function main() {
  const { flags } = parseArgv(process.argv);
  if (flags._help) {
    process.stdout.write(helpText() + '\n');
    return 0;
  }
  if (flags._printCategories) {
    process.stdout.write(JSON.stringify(CATEGORIES, null, 2) + '\n');
    return 0;
  }

  // 옛/오타 플래그(예: --backend=)를 조용히 무시하고 전체 설치로 폴백하지 않도록,
  // 인식되지 않는 --xxx= 플래그가 있으면 즉시 실패한다. (--all 은 명시적이라 예외)
  const unknown = unknownFlagNames(flags);
  if (unknown.length && !flags._all) {
    process.stderr.write(
      `Unknown flags: ${unknown.map(f => `--${f}`).join(', ')}\n` +
      `유효한 카테고리 플래그: --category, ${[...knownFlagNames()].filter(n => n !== 'category').map(n => `--${n}`).join(', ')}\n`
    );
    return 2;
  }

  let result;
  if (flags._all) {
    result = selectAll();
  } else if (hasAnyFlagSelection(flags)) {
    const { categories, subSelections, detailSelections } = parseCliFlags(flags);
    result = resolveSelection({ categories, subSelections, detailSelections });
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
  if (result.unknownDetails && result.unknownDetails.length) {
    process.stderr.write(`Unknown detail options: ${result.unknownDetails.join(', ')}\n`);
    return 2;
  }

  process.stdout.write(result.workloads.join(',') + '\n');
  return 0;
}

if (require.main === module) {
  main()
    .then(code => process.exit(code || 0))
    .catch(err => {
      process.stderr.write(`[select-workloads] ${err.message}\n`);
      process.exit(1);
    });
}

module.exports = {
  parseArgv,
  selectAll,
  runInteractive
};
