#!/usr/bin/env node
'use strict';

/**
 * menu.js — 2-tier 메뉴 정의와 메뉴 → 워크로드 변환.
 *
 * UX 모델:
 *   1) 6개 톱레벨 카테고리 중 사용할 것을 다중 선택한다.
 *   2) 각 카테고리마다 sub-옵션 (언어/엔진/플랫폼) 을 다중 선택한다.
 *   3) sub-옵션의 합집합 + `core` = 활성 워크로드 집합.
 *
 * 한 자산은 워크로드 여러 개를 가질 수 있고 (예: `[ai, python-data]`),
 * 활성 집합과 한 개라도 교집합이 있으면 설치된다.
 *
 * 데이터 분석 카테고리에서 "Python" 만 선택했을 때 FastAPI 가이드가 끌려오지
 * 않도록, python-backend 와 python-data 는 별도 키로 분리되어 있다.
 *
 * 카테고리에 sub-옵션이 없으면 (예: 글쓰기) 카테고리 자체가 단일 워크로드로
 * 매핑된다.
 */

/**
 * @typedef {{ id: string, label: string, workloads: string[] }} SubOption
 * @typedef {{
 *   id: string,
 *   label: string,
 *   workloads?: string[],
 *   subQuestion?: string,
 *   subOptions?: SubOption[],
 * }} Category
 */

/** @type {Category[]} */
const CATEGORIES = [
  {
    id: 'backend',
    label: '백엔드 개발',
    subQuestion: '어떤 백엔드를 다루세요?',
    subOptions: [
      { id: 'python',  label: 'Python (FastAPI 등)', workloads: ['python-backend'] },
      { id: 'rust',    label: 'Rust',                workloads: ['rust'] },
      { id: 'nodejs',  label: 'Node.js',             workloads: ['nodejs'] },
      { id: 'cloud',   label: 'AWS · Docker · K8s',  workloads: ['cloud'] },
      { id: 'ai',      label: 'AI · LLM 파이프라인', workloads: ['ai'] },
    ],
  },
  {
    id: 'frontend',
    label: '프론트엔드 개발',
    subQuestion: '어떤 프론트엔드 스택?',
    subOptions: [
      { id: 'react-vite-ts', label: 'React / Vite / TypeScript', workloads: ['frontend'] },
    ],
  },
  {
    id: 'plugin',
    label: '플러그인 개발',
    subQuestion: '어떤 플러그인 플랫폼?',
    subOptions: [
      { id: 'obsidian', label: 'Obsidian 플러그인',     workloads: ['obsidian', 'frontend'] },
      { id: 'chrome',   label: 'Chrome 확장 (예약)',    workloads: ['plugin-chrome', 'frontend'] },
      { id: 'claude',   label: 'Claude Code 플러그인 (예약)', workloads: ['plugin-claude'] },
    ],
  },
  {
    id: 'data-analysis',
    label: '데이터 분석',
    subQuestion: '어떤 분석 도구?',
    subOptions: [
      { id: 'duckdb', label: 'DuckDB 세팅 / 쿼리',    workloads: ['python-data'] },
      { id: 'python', label: 'Python (pandas/polars/pytorch/MLE)', workloads: ['python-data', 'ai'] },
    ],
  },
  {
    id: 'data-design',
    label: '데이터 설계',
    subQuestion: '어떤 DB 엔진?',
    subOptions: [
      { id: 'mysql',    label: 'MySQL / Aurora MySQL',         workloads: ['mysql'] },
      { id: 'postgres', label: 'PostgreSQL / Aurora Postgres', workloads: ['postgres'] },
      { id: 'mongodb',  label: 'MongoDB',                      workloads: ['mongodb'] },
      { id: 'dynamodb', label: 'DynamoDB',                     workloads: ['dynamodb'] },
    ],
  },
  {
    id: 'writing',
    label: '글쓰기 / 콘텐츠',
    workloads: ['writing'],
  },
];

const CATEGORY_IDS = CATEGORIES.map(c => c.id);

function findCategory(id) {
  return CATEGORIES.find(c => c.id === id);
}

/**
 * 메뉴 선택 입력을 받아 활성 워크로드 집합을 산출한다.
 *
 * @param {{ categories: string[], subSelections?: Record<string, string[]> }} input
 *        categories: 톱레벨 카테고리 id 배열
 *        subSelections: { [categoryId]: subOptionId[] } — sub-옵션을 가진
 *                       카테고리에서 사용자가 고른 항목들. 빈 배열은 그 카테고리의
 *                       모든 sub-옵션을 의미한다 (편의 기본값).
 * @returns {{ workloads: string[], unknownCategories: string[], unknownSubs: string[] }}
 */
function resolveSelection({ categories = [], subSelections = {} } = {}) {
  const wlSet = new Set(['core']); // core 는 항상 포함
  const unknownCategories = [];
  const unknownSubs = [];

  for (const catId of categories) {
    const cat = findCategory(catId);
    if (!cat) { unknownCategories.push(catId); continue; }

    if (!cat.subOptions || cat.subOptions.length === 0) {
      for (const w of (cat.workloads || [])) wlSet.add(w);
      continue;
    }

    const requestedSubs = subSelections[catId];
    const subs = (Array.isArray(requestedSubs) && requestedSubs.length)
      ? requestedSubs
      : cat.subOptions.map(s => s.id); // 빈 배열 → 전체

    for (const subId of subs) {
      const sub = cat.subOptions.find(s => s.id === subId);
      if (!sub) { unknownSubs.push(`${catId}.${subId}`); continue; }
      for (const w of sub.workloads) wlSet.add(w);
    }
  }

  return {
    workloads: [...wlSet].sort(),
    unknownCategories,
    unknownSubs,
  };
}

/**
 * CLI 플래그를 메뉴 입력 형태로 정규화.
 *
 *   --category=backend,writing
 *   --backend=python,cloud
 *   --frontend=react-vite-ts
 *   --plugin=obsidian
 *   --data-analysis=duckdb,python
 *   --data-design=mysql,mongodb
 *
 * (글쓰기처럼 sub-옵션이 없는 카테고리는 그냥 --category=writing 으로 충분)
 *
 * @param {Record<string,string|string[]>} flags
 */
function parseCliFlags(flags) {
  const split = v => (Array.isArray(v) ? v : String(v || '').split(','))
    .map(s => s.trim()).filter(Boolean);

  const categories = split(flags.category);
  const subSelections = {};

  for (const cat of CATEGORIES) {
    const flag = flags[cat.id];
    if (flag === undefined) continue;
    subSelections[cat.id] = split(flag);
    // sub-옵션 플래그를 명시했지만 --category 에 카테고리를 안 넣었다면 자동 포함.
    if (!categories.includes(cat.id)) categories.push(cat.id);
  }

  return { categories, subSelections };
}

module.exports = {
  CATEGORIES,
  CATEGORY_IDS,
  findCategory,
  resolveSelection,
  parseCliFlags,
};
