#!/usr/bin/env node
'use strict';

/**
 * menu.js — 2-tier 메뉴 정의와 메뉴 → 워크로드 변환.
 *
 * UX 모델:
 *   1) 7개 톱레벨 카테고리 중 사용할 것을 다중 선택한다.
 *   2) 각 카테고리마다 sub-옵션 (언어/엔진/플랫폼) 을 다중 선택한다.
 *   3) sub-옵션의 합집합 + `core` = 활성 워크로드 집합.
 *
 * 한 자산은 워크로드 여러 개를 가질 수 있고 (예: `[ai, python-data]`),
 * 활성 집합과 한 개라도 교집합이 있으면 설치된다.
 *
 * 데이터 분석 카테고리에서 "Python" 만 선택했을 때 FastAPI 가이드가 끌려오지
 * 않도록, python-backend 와 python-data 는 별도 키로 분리되어 있다.
 *
 * 카테고리에 sub-옵션이 없으면 카테고리 자체가 단일 워크로드로 매핑된다.
 */

/**
 * @typedef {{ id: string, label: string, workloads: string[] }} DetailOption
 * @typedef {{
 *   id: string,
 *   label: string,
 *   workloads?: string[],
 *   detailQuestion?: string,
 *   detailOptions?: DetailOption[],
 * }} SubOption
 * @typedef {{
 *   id: string,
 *   label: string,
 *   workloads?: string[],
 *   subQuestion?: string,
 *   subOptions?: SubOption[],
 *   detailQuestion?: string,
 *   detailOptions?: DetailOption[],
 * }} Category
 *
 * detailOptions 는 "leaf 가 될 수 있는 노드"(subOptions 없는 category, 또는
 * subOption)에 부착한다. 부착된 노드는 3번째 tier(상세)로 드릴다운한다.
 */

/** @type {Category[]} */
// 대분류(도메인) → 중분류(sub) → 소분류(상세 워크로드).
// 자산이 많은 중분류(writing.social)만 detailOptions 로 3단째를 편다.
const CATEGORIES = [
  {
    id: 'dev',
    label: '개발 (프로그래밍)',
    subQuestion: '어떤 개발 영역? (여러 개 선택 가능)',
    subOptions: [
      { id: 'frontend', label: '프론트엔드 (React / Vite / TypeScript)', workloads: ['frontend'] },
      { id: 'python', label: '백엔드 · Python (FastAPI 등)', workloads: ['python-backend'] },
      { id: 'rust', label: '백엔드 · Rust', workloads: ['rust'] },
      { id: 'nodejs', label: '백엔드 · Node.js', workloads: ['nodejs'] },
      { id: 'obsidian', label: '플러그인 · Obsidian', workloads: ['obsidian', 'frontend'] },
      { id: 'chrome', label: '플러그인 · Chrome 확장 (예약)', workloads: ['plugin-chrome', 'frontend'] },
      { id: 'claude', label: '플러그인 · Claude Code (예약)', workloads: ['plugin-claude'] }
    ]
  },
  {
    id: 'cloud',
    label: '클라우드 · 인프라 운영 (AWS)',
    subQuestion: '어떤 운영 영역? (여러 개 선택 가능)',
    subOptions: [
      { id: 'infra', label: '인프라 · 컨테이너 (IaC·EKS·ECS·Lambda·관측성)', workloads: ['cloud', 'devops'] },
      { id: 'finops', label: '비용 (Billing · Pricing)', workloads: ['finops'] },
      { id: 'integration', label: '통합 · 메시징 (SNS·SQS·MQ·Step Functions)', workloads: ['integration'] }
    ]
  },
  {
    id: 'ai',
    label: 'AI',
    subQuestion: '어떤 AI 작업?',
    subOptions: [{ id: 'llm', label: 'AI · LLM 파이프라인 (Bedrock·SageMaker·Kendra 등)', workloads: ['ai'] }]
  },
  {
    id: 'data',
    label: '데이터',
    subQuestion: '분석 / 설계 중 무엇? (여러 개 선택 가능)',
    subOptions: [
      { id: 'duckdb', label: '분석 · DuckDB 세팅 / 쿼리', workloads: ['python-data'] },
      { id: 'python-data', label: '분석 · Python (pandas/polars/pytorch/MLE)', workloads: ['python-data', 'ai'] },
      { id: 'aws-analytics', label: '분석 · AWS (Glue·Athena·EMR·Redshift)', workloads: ['data-analysis'] },
      { id: 'mysql', label: '설계 · MySQL / Aurora MySQL', workloads: ['mysql'] },
      { id: 'postgres', label: '설계 · PostgreSQL / Aurora Postgres', workloads: ['postgres'] },
      { id: 'mongodb', label: '설계 · MongoDB', workloads: ['mongodb'] },
      { id: 'dynamodb', label: '설계 · DynamoDB', workloads: ['dynamodb'] },
      { id: 'aws-rds', label: '설계 · AWS 관리형 DB (Aurora·RDS·DSQL·Keyspaces)', workloads: ['aws-rds'] }
    ]
  },
  {
    id: 'research',
    label: '리서치 · 자료조사 · 리포트',
    subQuestion: '웹 검색 / 리포트 중 무엇? (여러 개 선택 가능)',
    subOptions: [
      { id: 'websearch', label: '웹 검색 · 자료조사 (exa·brave·deep-researcher)', workloads: ['research'] },
      { id: 'report', label: '기술 리포트 작성 · 검증 (tech-writer)', workloads: ['report'] }
    ]
  },
  {
    id: 'writing',
    label: '글쓰기 · 콘텐츠',
    subQuestion: '일반 글쓰기 / 소셜 중 무엇?',
    subOptions: [
      { id: 'general', label: '일반 글쓰기 (블로깅 · PPT · 창작 · 번역)', workloads: ['writing'] },
      {
        id: 'social',
        label: '소셜 콘텐츠 (LinkedIn 등)',
        // 상세 tier: 파이프라인 단계별 3분할. 미선택 시 전체 설치.
        detailQuestion: '어느 단계? (여러 개 선택 가능)',
        detailOptions: [
          { id: 'voice', label: '보이스 · 프로필 (voice-builder 등)', workloads: ['social-voice'] },
          { id: 'content', label: '콘텐츠 제작 (post-writer / hook 등)', workloads: ['social-content'] },
          { id: 'visual', label: '시각 자산 (carousel / infographic 등)', workloads: ['social-visual'] }
        ]
      }
    ]
  }
];

const CATEGORY_IDS = CATEGORIES.map(c => c.id);

function findCategory(id) {
  return CATEGORIES.find(c => c.id === id);
}

/**
 * detailOptions 를 가진 노드(카테고리 또는 sub-옵션)의 워크로드를 산출한다.
 * 고른 상세 id 들의 workloads 합집합을 wlSet 에 더한다.
 *
 * @param {DetailOption[]} detailOptions
 * @param {string[]|undefined} requested  고른 상세 id 배열 (빈/미지정 → 전체)
 * @param {Set<string>} wlSet
 * @param {string} nodeKey                미지 상세 id 리포팅용 (예: 'writing.social')
 * @param {string[]} unknownDetails
 */
function addDetailWorkloads(detailOptions, requested, wlSet, nodeKey, unknownDetails) {
  const details = Array.isArray(requested) && requested.length ? requested : detailOptions.map(d => d.id); // 빈 배열 → 전체 상세
  for (const detId of details) {
    const det = detailOptions.find(d => d.id === detId);
    if (!det) {
      unknownDetails.push(`${nodeKey}.${detId}`);
      continue;
    }
    for (const w of det.workloads) wlSet.add(w);
  }
}

/**
 * 메뉴 선택 입력을 받아 활성 워크로드 집합을 산출한다.
 *
 * @param {{
 *   categories: string[],
 *   subSelections?: Record<string, string[]>,
 *   detailSelections?: Record<string, string[]>,
 * }} input
 *   categories: 톱레벨 카테고리 id 배열
 *   subSelections: { [categoryId]: subOptionId[] } — sub-옵션을 가진 카테고리의
 *                  선택. 빈 배열 = 전체 sub.
 *   detailSelections: { [nodeKey]: detailId[] } — 상세 tier 선택. nodeKey 는
 *                  카테고리 레벨 상세면 `categoryId`, sub 레벨
 *                  상세면 `categoryId.subId`(예: 'writing.social'). 빈 배열 = 전체 상세.
 * @returns {{ workloads: string[], unknownCategories: string[], unknownSubs: string[], unknownDetails: string[] }}
 */
function resolveSelection({ categories = [], subSelections = {}, detailSelections = {} } = {}) {
  const wlSet = new Set(['core']); // core 는 항상 포함
  const unknownCategories = [];
  const unknownSubs = [];
  const unknownDetails = [];

  for (const catId of categories) {
    const cat = findCategory(catId);
    if (!cat) {
      unknownCategories.push(catId);
      continue;
    }

    // (1) 카테고리 레벨 상세 tier (subOptions 없는 카테고리)
    if (cat.detailOptions && cat.detailOptions.length) {
      addDetailWorkloads(cat.detailOptions, detailSelections[catId], wlSet, catId, unknownDetails);
      continue;
    }

    // (2) sub-옵션 없는 단순 카테고리
    if (!cat.subOptions || cat.subOptions.length === 0) {
      for (const w of cat.workloads || []) wlSet.add(w);
      continue;
    }

    // (3) sub-옵션이 있는 카테고리
    const requestedSubs = subSelections[catId];
    const subs = Array.isArray(requestedSubs) && requestedSubs.length ? requestedSubs : cat.subOptions.map(s => s.id); // 빈 배열 → 전체

    for (const subId of subs) {
      const sub = cat.subOptions.find(s => s.id === subId);
      if (!sub) {
        unknownSubs.push(`${catId}.${subId}`);
        continue;
      }
      // sub 레벨 상세 tier (writing.social)
      if (sub.detailOptions && sub.detailOptions.length) {
        const nodeKey = `${catId}.${subId}`;
        addDetailWorkloads(sub.detailOptions, detailSelections[nodeKey], wlSet, nodeKey, unknownDetails);
      } else {
        for (const w of sub.workloads || []) wlSet.add(w);
      }
    }
  }

  return {
    workloads: [...wlSet].sort(),
    unknownCategories,
    unknownSubs,
    unknownDetails
  };
}

/**
 * CLI 플래그를 메뉴 입력 형태로 정규화.
 *
 *   --category=dev,cloud              톱레벨 카테고리
 *   --dev=frontend,python             sub-옵션
 *   --data=mysql,aws-analytics        sub-옵션
 *   --writing-social=voice,content    sub 레벨 상세 (writing.social)
 *   --writing=general,social          sub-옵션
 *   --writing-social=voice,content    sub 레벨 상세 (writing.social)
 *
 * @param {Record<string,string|string[]>} flags
 */
function parseCliFlags(flags) {
  const split = v => (Array.isArray(v) ? v : String(v || '').split(',')).map(s => s.trim()).filter(Boolean);

  const categories = split(flags.category);
  // `--category=X` 로 명시된 카테고리 집합. 이 카테고리는 "전체 sub" 의도이므로
  // 아래 상세 플래그의 auto-sub 가 subSelections 를 특정 sub 로 좁히면 안 된다.
  const explicitCategories = new Set(categories);
  const subSelections = {};
  const detailSelections = {};
  const ensureCategory = id => {
    if (!categories.includes(id)) categories.push(id);
  };

  for (const cat of CATEGORIES) {
    // 카테고리 레벨 상세: `--<category>=a,b` → detailSelections[categoryId]
    if (cat.detailOptions && cat.detailOptions.length) {
      const flag = flags[cat.id];
      if (flag !== undefined) {
        detailSelections[cat.id] = split(flag);
        ensureCategory(cat.id);
      }
      continue;
    }

    // sub-옵션 플래그: `--backend=python,cloud`
    const subFlag = flags[cat.id];
    if (subFlag !== undefined) {
      subSelections[cat.id] = split(subFlag);
      ensureCategory(cat.id);
    }

    // sub 레벨 상세 플래그: `--<catId>-<subId>=...` (예: --writing-social=voice)
    for (const sub of cat.subOptions || []) {
      if (!sub.detailOptions || !sub.detailOptions.length) continue;
      const detailFlag = flags[`${cat.id}-${sub.id}`];
      if (detailFlag === undefined) continue;
      detailSelections[`${cat.id}.${sub.id}`] = split(detailFlag);
      ensureCategory(cat.id);
      // 상세만 줬고 sub 를 --dev= 로도, --category=dev 로도 안 골랐다면 그 sub 를
      // 자동 선택(상세 플래그 하나로 카테고리를 켜는 편의). 단 `--category=dev` 로
      // 카테고리를 명시했으면 "전체 sub" 의도이므로 좁히지 않는다(상세는 그 브랜치에만 적용).
      if (explicitCategories.has(cat.id)) continue;
      if (!subSelections[cat.id]) subSelections[cat.id] = [sub.id];
      else if (!subSelections[cat.id].includes(sub.id)) subSelections[cat.id].push(sub.id);
    }
  }

  return { categories, subSelections, detailSelections };
}

module.exports = {
  CATEGORIES,
  CATEGORY_IDS,
  findCategory,
  resolveSelection,
  parseCliFlags
};
