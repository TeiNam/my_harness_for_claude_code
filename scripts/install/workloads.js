#!/usr/bin/env node
'use strict';

/**
 * workloads.js — Workload group catalog and asset → group classification.
 *
 * 그룹은 "오늘 어떤 일을 할 건가?"에 1:1 로 매칭되도록 정밀하게 쪼갰다.
 * install 시 2-tier 메뉴 (백엔드 / 프론트 / 플러그인 / 데이터분석 / 데이터설계 /
 * 글쓰기) 의 sub-옵션이 곧 워크로드 키가 된다 — sub-옵션에서 "MySQL"만 골랐을
 * 때 Postgres 가이드까지 끌려오지 않도록.
 *
 * 자산은 frontmatter `workloads:` 로 그룹을 선언한다. install.sh / install.ps1 은
 * select-assets.js 를 통해 사용자의 활성 그룹과 교집합인 자산만 심볼릭 링크한다.
 */

/** 사용자가 고를 수 있는 모든 워크로드 키. */
const GROUPS = [
  // baseline — 항상 포함
  'core',

  // 백엔드 카테고리 sub-옵션
  'python-backend',  // FastAPI / 일반 백엔드 파이썬
  'rust',
  'nodejs',
  'cloud',           // AWS / Docker / Terraform / K8s
  'ai',              // Claude SDK / Bedrock / LLM 파이프라인 / HF STT

  // 프론트엔드 카테고리 sub-옵션
  'frontend',        // React / Vite / TypeScript / Next / Web UI

  // 플러그인 카테고리 sub-옵션
  'obsidian',
  'plugin-chrome',   // 예약 — 자산이 추가될 때 채워질 키
  'plugin-claude',   // 예약 — Claude Code 플러그인 자체 개발용

  // 데이터 분석 카테고리 sub-옵션
  'python-data',     // duckdb / pandas / polars / pytorch / mle / recsys

  // 데이터 설계 카테고리 sub-옵션
  'mysql',
  'postgres',
  'mongodb',
  'dynamodb',

  // 글쓰기 카테고리
  'writing',
];

/**
 * Heuristic match table — frontmatter `workloads:` 가 없는 자산을 위한 폴백.
 * 각 룰은 `{ pattern, groups, kind?, comment? }`. `pattern` 은 자산 식별자(파일
 * basename - .md 확장자, skill 디렉터리 이름) 와 매칭된다. `kind` 가 있으면 해당
 * 자산 타입에서만 적용. 매칭된 모든 그룹의 합집합을 취해 dedup 한다.
 *
 * 룰 순서: 좁은 매칭 → 넓은 매칭. 같은 식별자에 여러 룰이 걸리면 모두 더해진다.
 */
const RULES = [
  // -- Rust ----------------------------------------------------------------
  { pattern: /(^|[-_/])rust([-_]|$)/i, groups: ['rust'] },

  // -- AI / Python-data 교차점 ------------------------------------------
  { pattern: /^pytorch[-_]?build[-_]?resolver$/i, groups: ['ai', 'python-data'] },
  { pattern: /^pytorch([-_]|$)/i, groups: ['ai', 'python-data'] },
  { pattern: /^mle[-_]/i, groups: ['ai', 'python-data'] },
  { pattern: /^recsys[-_]/i, groups: ['ai', 'python-data'] },

  // -- Python (data analysis) -------------------------------------------
  { pattern: /^python[-_]data[-_]analysis$/i, groups: ['python-data'] },
  { pattern: /^duckdb[-_]/i, groups: ['python-data'] },

  // -- Python (backend) -------------------------------------------------
  { pattern: /^fastapi([-_]|$)/i, groups: ['python-backend'] },
  { pattern: /(^|[-_])fastapi$/i, groups: ['python-backend'] },
  // 백엔드 / 데이터 양쪽에 모두 등장하는 일반 패턴 라이브러리
  { pattern: /^python[-_]patterns$/i, groups: ['python-backend', 'python-data'] },
  { pattern: /^python[-_]testing$/i, groups: ['python-backend', 'python-data'] },
  { pattern: /^python[-_]reviewer$/i, groups: ['python-backend', 'python-data'], kind: 'agent' },
  { pattern: /^python[-_]review$/i, groups: ['python-backend', 'python-data'], kind: 'command' },
  { pattern: /^fastapi[-_]reviewer$/i, groups: ['python-backend'], kind: 'agent' },
  { pattern: /^mle[-_]reviewer$/i, groups: ['ai', 'python-data'], kind: 'agent' },

  // -- Frontend / TypeScript / Web ----------------------------------------
  { pattern: /^typescript([-_]|$)/i, groups: ['frontend'] },
  { pattern: /(^|[-_])typescript([-_]|$)/i, groups: ['frontend'] },
  { pattern: /^vite([-_]|$)/i, groups: ['frontend'] },
  { pattern: /^nextjs([-_]|$)/i, groups: ['frontend'] },
  { pattern: /^frontend([-_]|$)/i, groups: ['frontend'] },
  { pattern: /^a11y[-_]architect$/i, groups: ['frontend'] },
  { pattern: /^design[-_]system$/i, groups: ['frontend'] },
  { pattern: /^liquid[-_]glass[-_]design$/i, groups: ['frontend'] },
  { pattern: /^motion[-_]/i, groups: ['frontend'] },
  { pattern: /^make[-_]interfaces[-_]feel[-_]better$/i, groups: ['frontend'] },
  { pattern: /^browser[-_]qa$/i, groups: ['frontend'] },
  { pattern: /^click[-_]path[-_]audit$/i, groups: ['frontend'] },
  { pattern: /^ui[-_]demo$/i, groups: ['frontend'] },
  { pattern: /^seo$/i, groups: ['frontend'] },
  { pattern: /^seo[-_]specialist$/i, groups: ['frontend'] },
  { pattern: /^remotion[-_]/i, groups: ['frontend'] },
  { pattern: /^manim[-_]video$/i, groups: ['frontend', 'writing'] },

  // -- Obsidian -----------------------------------------------------------
  { pattern: /^obsidian([-_]|$)/i, groups: ['obsidian', 'frontend'] },

  // -- 데이터 설계: 개별 RDBMS / NoSQL ----------------------------------
  { pattern: /^(postgres|aurora[-_]?postgres|aurora[-_]?pg)([-_]|$)/i, groups: ['postgres'] },
  { pattern: /^(mysql|aurora[-_]?mysql)([-_]|$)/i, groups: ['mysql'] },
  { pattern: /^mongodb([-_]|$)/i, groups: ['mongodb'] },
  { pattern: /^dynamodb([-_]|$)/i, groups: ['dynamodb'] },

  // RDBMS 양쪽에 적용되는 자산 (마이그레이션 / 모델러 / DB 리뷰어)
  { pattern: /^rdbms[-_]/i, groups: ['mysql', 'postgres'] },
  { pattern: /^rdbms[-_]data[-_]modeler$/i, groups: ['mysql', 'postgres'], kind: 'agent' },
  { pattern: /^database[-_]migrations$/i, groups: ['mysql', 'postgres'] },
  { pattern: /^database[-_]reviewer$/i, groups: ['mysql', 'postgres', 'mongodb', 'dynamodb'], kind: 'agent' },

  // -- Cloud / Infra ------------------------------------------------------
  { pattern: /^aws[-_]bedrock$/i, groups: ['ai', 'cloud'] },
  { pattern: /^aws[-_]/i, groups: ['cloud'] },
  { pattern: /^devops$/i, groups: ['cloud'] },
  { pattern: /^docker[-_]/i, groups: ['cloud'] },
  { pattern: /^deployment[-_]/i, groups: ['cloud'] },

  // -- AI / LLM -----------------------------------------------------------
  { pattern: /^claude[-_]api$/i, groups: ['ai'] },
  { pattern: /^foundation[-_]models[-_]on[-_]device$/i, groups: ['ai'] },
  { pattern: /^realtime[-_]stt[-_]huggingface$/i, groups: ['ai'] },
  { pattern: /^cost[-_]aware[-_]llm[-_]pipeline$/i, groups: ['ai'] },
  { pattern: /^ai[-_]first[-_]engineering$/i, groups: ['ai'] },
  { pattern: /^ai[-_]regression[-_]testing$/i, groups: ['ai'] },
  { pattern: /^prompt[-_]optimizer$/i, groups: ['ai'] },

  // -- Node.js ------------------------------------------------------------
  { pattern: /^bun[-_]runtime$/i, groups: ['nodejs'] },
  { pattern: /^prisma[-_]/i, groups: ['nodejs'] },
  { pattern: /^nodejs([-_]|$)/i, groups: ['nodejs'] },

  // -- Writing ------------------------------------------------------------
  { pattern: /^article[-_]/i, groups: ['writing'] },
  { pattern: /^content[-_]/i, groups: ['writing'] },
  { pattern: /^brand[-_]voice$/i, groups: ['writing'] },
  { pattern: /^crosspost$/i, groups: ['writing'] },
  { pattern: /^creative[-_]writing$/i, groups: ['writing'] },
  { pattern: /^markdown[-_]writing$/i, groups: ['writing'] },
  { pattern: /^tech[-_]blogging$/i, groups: ['writing'] },
  { pattern: /^ppt[-_]authoring$/i, groups: ['writing'] },
  { pattern: /^frontend[-_]slides$/i, groups: ['writing', 'frontend'] },
  { pattern: /^translator[-_]docs$/i, groups: ['writing'] },

  // -- 기타 reviewer / kind 한정 룰 ------------------------------------
  { pattern: /^rust[-_]reviewer$/i, groups: ['rust'], kind: 'agent' },
  { pattern: /^typescript[-_]reviewer$/i, groups: ['frontend'], kind: 'agent' },

  // rules/ 폴더 폴백은 classifyRulePath 에서 처리한다.
];

/** 매칭되지 않은 자산은 core 로 떨어진다. */
const DEFAULT_GROUP = 'core';

/** Strip extension and frontmatter punctuation for matching. */
function identifierOf(filePath) {
  const base = filePath.split(/[\\/]/).pop() || '';
  return base.replace(/\.md$/i, '');
}

/**
 * Classify by raw identifier (basename without extension or skill dir name).
 * @param {string} identifier
 * @param {"agent"|"command"|"skill"|"rule"} [kind]
 * @returns {string[]} sorted unique group ids; never empty.
 */
function classifyIdentifier(identifier, kind) {
  const hits = new Set();
  for (const rule of RULES) {
    if (rule.kind && kind && rule.kind !== kind) continue;
    if (rule.pattern.test(identifier)) {
      for (const g of rule.groups) hits.add(g);
    }
  }
  if (hits.size === 0) hits.add(DEFAULT_GROUP);
  return [...hits].sort();
}

/**
 * Classify a rules/ file by its parent folder. Uses the folder, not the
 * basename, because rule basenames are generic.
 *
 * rules/python/fastapi.md 만 python-backend 한정으로 좁힌다 (파일명 기반 보정).
 */
function classifyRulePath(relativePath) {
  const parts = relativePath.split(/[\\/]/).filter(Boolean);
  // parts[0] === 'rules', parts[1] === folder, parts[parts.length - 1] === filename
  const folder = (parts[1] || '').toLowerCase();
  const baseName = (parts[parts.length - 1] || '').replace(/\.md$/i, '').toLowerCase();
  switch (folder) {
    case 'common':    return ['core'];
    case 'python':
      if (baseName === 'fastapi') return ['python-backend'];
      return ['python-backend', 'python-data'];
    case 'rust':      return ['rust'];
    case 'typescript':
    case 'web':       return ['frontend'];
    default:          return [DEFAULT_GROUP];
  }
}

/**
 * Top-level convenience: given an asset descriptor, return its groups.
 *
 * @param {object} asset
 * @param {"agent"|"command"|"skill"|"rule"} asset.kind
 * @param {string} asset.identifier  basename or skill directory name
 * @param {string} [asset.relativePath] only used when kind === "rule"
 */
function classify(asset) {
  if (asset.kind === 'rule' && asset.relativePath) {
    return classifyRulePath(asset.relativePath);
  }
  return classifyIdentifier(asset.identifier, asset.kind);
}

function isKnownGroup(id) {
  return GROUPS.includes(id);
}

function validateGroups(ids, label = 'groups') {
  const bad = ids.filter(g => !isKnownGroup(g));
  if (bad.length) {
    throw new Error(
      `Unknown ${label}: ${bad.join(', ')}. Valid: ${GROUPS.join(', ')}`
    );
  }
}

module.exports = {
  GROUPS,
  DEFAULT_GROUP,
  RULES,
  classify,
  classifyIdentifier,
  classifyRulePath,
  identifierOf,
  isKnownGroup,
  validateGroups,
};
