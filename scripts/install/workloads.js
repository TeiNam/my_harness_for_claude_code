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
  // baseline — 항상 포함 (github·context7·time·fetch 만)
  'core',

  // 리서치·리포트 — 웹 검색 + 기술 리포트 작성(tech-writer 계열)
  'research', // exa · brave-search (웹 검색·자료조사)
  'report', // tech-writer / tech-doc-* / doc-clarity / doc-quality / tech-fidelity (기술 리포트 작성·검증)

  // 백엔드 카테고리 sub-옵션
  'python-backend', // FastAPI / 일반 백엔드 파이썬
  'rust',
  'nodejs',
  'cloud', // AWS / Docker / Terraform / K8s (범용 AWS·계정·네트워크·IAM·통합)
  'devops', // AWS IaC·컨테이너(EKS/ECS)·서버리스·Lambda·관측성(CloudWatch/Prometheus)
  'finops', // AWS 비용·요금 (Billing and Cost Management / Pricing)
  'integration', // AWS 통합·메시징 (SNS·SQS/MQ/OpenAPI/Step Functions/AppSync)
  'aws-rds', // AWS 관리형 DB MCP (Aurora PG/MySQL·DSQL·RDS Oracle/SQL Server·Keyspaces·Timestream) — 로컬 DB 설계(mysql/postgres/mongodb)와 별개
  'data-analysis', // AWS 분석 엔진 (Glue/Athena/EMR/Redshift/Neptune) — 로컬 pandas/duckdb 는 python-data
  'ai', // Claude SDK / Bedrock / LLM 파이프라인 / HF STT

  // 프론트엔드 카테고리 sub-옵션
  'frontend', // React / Vite / TypeScript / Next / Web UI

  // 플러그인 카테고리 sub-옵션
  'obsidian',
  'plugin-chrome', // 예약 — 자산이 추가될 때 채워질 키
  'plugin-claude', // 예약 — Claude Code 플러그인 자체 개발용

  // 데이터 분석 카테고리 sub-옵션
  'python-data', // duckdb / pandas / polars / pytorch / mle / recsys

  // 데이터 설계 카테고리 sub-옵션
  'mysql',
  'postgres',
  'mongodb',
  'dynamodb',

  // 글쓰기 카테고리 sub-옵션
  'writing', // 기술 문서 / 블로깅 / PPT / 장문 콘텐츠
  // 소셜 콘텐츠 3분할 (LinkedIn 개인 브랜딩) — writing.social 상세 tier
  'social-voice', // 보이스·프로필 (voice-builder / newsletter-voice / profile-optimizer)
  'social-content', // 콘텐츠 제작 (post-writer / hook-generator / content-matrix 등)
  'social-visual', // 시각 자산 (graphic-designer / gemini-* / quote-post / youtube-thumbnail)

  // 메뉴에 노출되지 않는 격리 그룹 — 하네스 메타/실험 자산용.
  // 어떤 카테고리에도 매핑되지 않으므로 --all 에도 끌려오지 않는다.
  // 필요하면 --workload=...,lab 으로 명시 설치한다.
  'lab'
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

  // -- Report (tech-writer 계열: 기술 리포트 작성·검증) -------------------
  // Writing 블록보다 먼저 — content-* 등 넓은 룰에 흡수되지 않도록.
  { pattern: /^tech[-_]writer([-_]|$)/i, groups: ['report'] },
  { pattern: /^tech[-_]doc[-_]writer$/i, groups: ['report'], kind: 'agent' },
  { pattern: /^tech[-_]fidelity[-_]auditor$/i, groups: ['report'], kind: 'agent' },
  { pattern: /^doc[-_]clarity[-_]reviewer$/i, groups: ['report'], kind: 'agent' },
  { pattern: /^doc[-_]quality[-_]detector$/i, groups: ['report'], kind: 'agent' },

  // -- Research (웹 검색·자료조사) ---------------------------------------
  { pattern: /^deep[-_]research(er)?$/i, groups: ['research'] },

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

  // -- Social Content (LinkedIn 개인 브랜딩, charlie947/social-media-skills) --
  // 파이프라인 단계별 3분할: voice / content / visual.
  //   voice   — 보이스·프로필 세팅
  { pattern: /^voice[-_]builder$/i, groups: ['social-voice'] },
  { pattern: /^newsletter[-_]voice$/i, groups: ['social-voice'] },
  { pattern: /^profile[-_]optimizer$/i, groups: ['social-voice'] },
  //   content — 콘텐츠 제작·검증
  { pattern: /^post[-_](writer|formatter|scorer)$/i, groups: ['social-content'] },
  { pattern: /^hook[-_]generator$/i, groups: ['social-content'] },
  { pattern: /^content[-_]matrix$/i, groups: ['social-content'] },
  { pattern: /^niche[-_]research$/i, groups: ['social-content'] },
  { pattern: /^pinned[-_]comment$/i, groups: ['social-content'] },
  { pattern: /^reels[-_]scripting$/i, groups: ['social-content'] },
  { pattern: /^analytics[-_]dashboard$/i, groups: ['social-content'] },
  //   visual  — 시각 자산
  { pattern: /^graphic[-_]designer$/i, groups: ['social-visual'] },
  { pattern: /^gemini[-_](carousel|infographic)$/i, groups: ['social-visual'] },
  { pattern: /^quote[-_]post$/i, groups: ['social-visual'] },
  { pattern: /^youtube[-_]thumbnail$/i, groups: ['social-visual'] },

  // -- 기타 reviewer / kind 한정 룰 ------------------------------------
  { pattern: /^rust[-_]reviewer$/i, groups: ['rust'], kind: 'agent' },
  { pattern: /^typescript[-_]reviewer$/i, groups: ['frontend'], kind: 'agent' }

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
    case 'common':
      return ['core'];
    case 'python':
      if (baseName === 'fastapi') return ['python-backend'];
      return ['python-backend', 'python-data'];
    case 'rust':
      return ['rust'];
    case 'typescript':
    case 'web':
      return ['frontend'];
    default:
      return [DEFAULT_GROUP];
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

/**
 * 하위호환 별칭 — 옛 통짜 키를 세분화된 하위 키 집합으로 확장한다.
 * select-assets 진입 시 1곳에서 확장하므로, 키를 세분화할 때 옛 키를 여기에
 * 등록해 두면 문서·CI·사용자 스크립트가 안 깨진다.
 *
 * 현재는 비어 있다 — 마지막 별칭이던 `apple` 은 Apple 스킬 제거와 함께 사라졌다.
 * `social-content` 는 분할 후에도 "콘텐츠 제작" 그룹의 실제 키로 재사용하므로
 * 별칭이 아니다 (옛 의미인 17종 전체를 원하면 세 키를 명시).
 */
const ALIASES = {};

/**
 * 워크로드 키 배열에서 별칭을 확장한다. 별칭이 아닌 키는 그대로 통과.
 * @param {string[]} groups
 * @returns {string[]} 확장·중복제거된 키 배열
 */
function expandAliases(groups) {
  const out = new Set();
  for (const g of groups || []) {
    if (ALIASES[g]) for (const sub of ALIASES[g]) out.add(sub);
    else out.add(g);
  }
  return [...out];
}

function isKnownGroup(id) {
  return GROUPS.includes(id);
}

function validateGroups(ids, label = 'groups') {
  const bad = ids.filter(g => !isKnownGroup(g));
  if (bad.length) {
    throw new Error(`Unknown ${label}: ${bad.join(', ')}. Valid: ${GROUPS.join(', ')}`);
  }
}

module.exports = {
  GROUPS,
  DEFAULT_GROUP,
  RULES,
  ALIASES,
  expandAliases,
  classify,
  classifyIdentifier,
  classifyRulePath,
  identifierOf,
  isKnownGroup,
  validateGroups
};
