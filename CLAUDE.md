# CLAUDE.md

Guidance for Claude Code working in this repository.

## Project Overview

Personal Claude Code harness — a curated set of agents, skills, commands, hooks, rules, and MCP configs tailored to the owner's workloads.

This is **not** a published plugin. It is a working, standalone harness: trim, edit, and rewrite freely.

## Owner's Primary Workloads

When picking agents/skills/rules to apply, bias toward what's relevant to these:

- **Python**: general coding, data analysis (pandas/polars/duckdb), FastAPI
- **Rust**: general coding
- **Frontend**: React + Vite + TypeScript, Obsidian plugin development
- **Data**: RDBMS modeling (Postgres/MySQL), MongoDB, DuckDB
- **Cloud / AI**: AWS, Amazon Bedrock, Hugging Face models for real-time speech transcription
- **Node.js**: server + tooling
- **Writing**: creative writing, tech blogging, presentation (PPT) authoring

## Layout

- `agents/` — subagents available for delegation
- `skills/` — domain knowledge / workflow definitions
- `commands/` — slash commands (markdown with `description:` frontmatter)
- `hooks/` — trigger-based hook configs (JSON + handler scripts)
- `rules/` — always-follow guidelines (common + per-language)
- `mcp-configs/` — MCP server configurations
- `scripts/` — Node.js utilities for hooks, install/uninstall, audits
- `tests/` — test suite for `scripts/`
- `docs/` — long-form reference (writing guides, security guide, steering rules)

## High-value Agents

- `rdbms-data-modeler` — forces target-DB confirmation (Aurora MySQL / MySQL / Aurora PG / PG), then routes to `mysql-guideline` or `postgres-guideline` skill before writing DDL.
- `article-writer` — long-form articles, guides, blog posts, newsletters in distinctive voice
- `content-creator` — platform-native social content (X, LinkedIn, newsletter, video scripts)
- `devops` — AWS / Docker / Terraform / K8s; always plans/dry-runs before mutations
- `translator-docs` — Korean / English bidirectional translation + README/API docs
- `deep-researcher` — multi-source web research with citations

The longer reviewer/architect agents (`code-reviewer`, `python-reviewer`, `typescript-reviewer`, `rust-reviewer`, `architect`, etc.) are kept alongside shorter counterparts — they overlap but are more detailed.

## High-value Skills for Owner's Workloads

Filled-in (real content, not placeholder):

- **DB**: `skills/postgres-guideline/`, `skills/mysql-guideline/`, `skills/mongodb-guideline/`, `skills/dynamodb-guideline/` — schema / index / partitioning / sharding / connection
- **Frontend**: `skills/obsidian-plugin-develop/` (TypeScript + i18n + Chromium + release checklist), `skills/vite-patterns/`, `skills/frontend-patterns/`
- **AI**: `skills/claude-api/` (Anthropic SDK), `skills/foundation-models-on-device/`, `skills/ai-regression-testing/`, `skills/cost-aware-llm-pipeline/`, `skills/aws-bedrock/`, `skills/realtime-stt-huggingface/`, `skills/ai-tui/`
- **AI TUI (터미널 에이전트 초기화면·두뇌)**: `skills/ai-tui/` — Claude Code·stocker 스타일 터미널 AI 에이전트의 초기화면(배너·로고·입력창·힌트바 6요소)과 두뇌(프롬프트·스킬·MCP·사용룰)를 세팅하는 크로스 언어 레퍼런스. `references/` 4종 — 언어별 3종(`node-pi-tui`, `rust-ratatui`, `python-textual`)과 언어 중립 `agent-brain-setup`. 유지형(pi-tui/textual) vs 즉시형(ratatui) 렌더링 차이와 ANSI 폭 함정을 언어별로 대비. `${CLAUDE_SKILL_DIR}` 토큰 치환. `ai`·`nodejs`·`rust`·`python-backend` 워크로드로 통합.
- **Cloud**: `skills/aws-cloud/` (IAM, S3, Lambda, ECS/Fargate, RDS, networking, cost guardrails)
- **Backend**: `skills/fastapi-backend-best-practices/` (api-design, async-patterns, deployment, domain-modeling, project-structure, security, testing), `skills/python-patterns/`, `skills/rust-patterns/`
- **Writing**: `skills/markdown-writing/`, `skills/article-writing/`, `skills/brand-voice/`, `skills/crosspost/`, `skills/frontend-slides/`, `skills/tech-blogging/`, `skills/creative-writing/`, `skills/ppt-authoring/`, `skills/tech-writer/`
- **Tech Writer (기술 문서 작성·윤문)**: `skills/tech-writer/` — 한/영 기술 문서를 새로 쓰거나(write) 기존 초안을 윤문(polish)하는 오케스트레이터. `references/` 3종(quick-rules, tech-doc-taxonomy, tech-writing-playbook)과 전용 에이전트 5종(`tech-doc-writer`, `doc-clarity-reviewer`, `doc-quality-detector`, `tech-fidelity-auditor`, `tech-writer-monolith`)을 둔다. `${CLAUDE_SKILL_DIR}` 토큰 치환으로 경로 독립. `writing` 워크로드로 통합.
- **Humanize (한글 AI 티 제거)**: `skills/humanize-korean/` — AI가 쓴 한글 글의 번역투·관용구·기계적 병렬·피동태 남용 등 10대 카테고리 패턴을 탐지·윤문. Fast 모드(monolith 1콜)와 strict 5인 파이프라인. 진입 커맨드 `/humanize`·`/humanize-redo`. **런타임 에이전트(`writing` 상시 로드)**: `humanize-monolith`, `ai-tell-detector`, `korean-style-rewriter`, `content-fidelity-auditor`, `naturalness-reviewer`. **스킬 유지·확장용 메타 에이전트는 `lab` 그룹으로 격리**(상시 로드 제외, 분류체계 v2.0 승격·학술 인용·metric 엔지니어링·웹 확장 시에만 수동 호출): `korean-ai-tell-taxonomist`, `taxonomy-gap-analyzer`, `translationese-research-distiller`, `post-editese-metric-engineer`, `quick-rules-integrator`, `korean-translation-scholar`, `humanize-web-architect`. 원본 epoko77-ai/im-not-ai 를 `writing` 워크로드로 통합.

## Still Placeholder Skills

None — all previously-scaffolded skills are now filled in. If new placeholders
are added later, list them here so they're easy to find and complete.

## Workload-based Install (2-tier 메뉴)

설치는 6개 톱레벨 카테고리(**backend / frontend / plugin / data-analysis / data-design / writing**) 와 sub-옵션으로 결정된다. sub-옵션이 곧 워크로드 키와 1:1 매칭되어, 예컨대 "데이터 설계 → MySQL" 만 골랐을 때 Postgres 가이드까지 끌려오지 않는다.

- 톱레벨 카테고리와 sub-옵션 → 워크로드 매핑은 `scripts/install/menu.js` 한 곳에서 정의된다.
- 워크로드 키 카탈로그는 `scripts/install/workloads.js` (`core, python-backend, python-data, rust, nodejs, cloud, ai, frontend, obsidian, plugin-chrome, plugin-claude, mysql, postgres, mongodb, dynamodb, writing`). `core` 는 항상 포함된다.
- 진입점은 `scripts/install/select-workloads.js` 로, 다음 셋 중 하나를 자동으로 고른다:
  - 메뉴 CLI 플래그(`--category=`, `--backend=`, `--data-design=` …) 가 있으면 비대화형으로 그 값 사용
  - 인자가 없고 TTY 면 stdin 기반 체크박스 메뉴
  - 그 외엔 `--all` 폴백
- 결정된 워크로드는 `scripts/install/select-assets.js` 로 넘어가 자산 frontmatter `workloads:` 와 교집합 매칭 → `kind\tsource\ttarget` 라인 출력 → install.sh / install.ps1 가 파일별 심볼릭 링크로 `$CLAUDE_HOME/<kind>s/_harness/...` 에 설치한다. 워크로드 흐름에 들어오는 kind 는 **agent·command·skill·rule** 4종뿐이다.
- **워크로드 외(hooks·mcp) 추가 설치 프롬프트**: hooks·mcp 는 워크로드 분류 밖(별도 파일, 통째 설치)이라, 워크로드 자산 설치 후 **TTY 면 두 번 물어본다** — (1) hooks 를 settings.json 에 머지할지, (2) mcp 설정 안내를 볼지. `--with-hooks`(`-WithHooks`) 를 주면 hooks 는 묻지 않고 바로 머지. `--no-extras`(`-NoExtras`) 또는 비대화형(파이프/CI)이면 프롬프트를 건너뛰고 워크로드만 설치(기존 동작 보존). mcp 는 `.mcp.json` 이 `${VAR}` 참조라 머지가 아니라 활성화 방법 안내만 출력(`print_mcp_info`/`Show-McpInfo`).
- repo-root 링크 `$CLAUDE_HOME/_harness` 는 항상 생성된다 — `hooks/hooks.json` 의 inline bootstrap 이 root 후보로 본다. 부트스트랩 우선순위: `$CLAUDE_PLUGIN_ROOT` → `$CLAUDE_PROJECT_DIR/.claude(_harness)` → `$HOME/.claude(_harness, plugins/_harness)`. 따라서 `CLAUDE_HOME` 을 프로젝트 로컬로 둬도 (예: `$PWD/.claude`) `CLAUDE_PROJECT_DIR` 만 주입되면 동작한다.
- `--with-hooks` 로 hooks 를 머지하고 `CLAUDE_HOME` 이 `$HOME/.claude` 가 아닌 경우, 일부 환경 (CLAUDE_PROJECT_DIR 미주입 등) 을 위한 안전망으로 `$HOME/.claude/_harness` 보조 링크가 함께 생성된다. 끄려면 `--no-home-link` (`-NoHomeLink`).
- 자산 추가: 파일을 두고 frontmatter 에 `workloads: [...]` 만 적으면 끝. 휴리스틱에 맡길 수도 있다. 일괄 재태깅은 `node scripts/install/tag-assets.js --apply --force`.
- 저수준 모드: `--workload=python-backend,mysql` 를 직접 지정하면 메뉴를 무시하고 그 값만 사용한다.
- **드리프트 점검**: `npm run check-drift [-- --workload=core]` (= `scripts/install/check-drift.js`). 선택 워크로드 기준으로 "레포가 깔아야 할 자산" vs "실제 `$CLAUDE_HOME` 심볼릭"을 대조해 missing / wrong-target / broken 을 보고하고 drift 가 있으면 exit 1 + `./install.sh --force` 안내. 읽기 전용 — 링크를 만들거나 지우지 않는다. "자산은 옛 상태로 stale 인데 훅만 풀 주입" 같은 어긋남을 한 방에 드러내려는 용도(과거 글로벌이 거의 비어 있었던 사고의 재발 방지).
- 테스트: `tests/scripts/install/{workloads,menu,select-workloads,select-assets,tag-assets,merge-hooks}.test.js`.

## Hooks (status)

- `hooks/hooks.json` — main hook stack. Install via `./install.sh --with-hooks` (or `install.ps1 -WithHooks`), which merges entries into `~/.claude/settings.json` keyed by `id`. Re-runs are idempotent; user-added entries are preserved. `--with-hooks --dry-run` previews the change; `--with-hooks --uninstall` removes only harness-owned ids.
- **글로벌 기본은 `HARNESS_HOOK_PROFILE=minimal`** (`~/.claude/settings.json` 의 `env`). hooks.json 의 모든 그룹은 `run-with-flags.js <id> <script> <profilesCsv>` 로 게이팅되고(Stop/SessionEnd 훅은 인라인 bootstrap 래퍼가 같은 CSV 를 spawnSync 인자로 넘긴다), `scripts/lib/hook-flags.js` 가 profile 과 `HARNESS_DISABLED_HOOKS` CSV 를 읽어 실행 여부를 결정한다. 3단계는 누적 포함 관계다:
  - **minimal (9훅)**: 라이프사이클·안전·메트릭만 — `session:start`·`session:end:marker`·`stop:session-end`·`stop:evaluate-session`·`stop:capture-lessons`·`stop:cost-tracker`·`post:harness-metrics-bridge`·`pre/post:bash:dispatcher`. (앞 3개는 게이트 없는 직접 실행이라 항상 ON.)
  - **standard (27훅)**: minimal + 품질·관찰·거버넌스 **경고** 훅 (observe·governance·quality-gate·console-warn·design-quality·context-monitor·mcp-health-check·format-typecheck 등). 코드 프로젝트 권장값.
  - **strict (28훅)**: standard + **차단형(blocking)** 훅 2종 — `pre:config-protection`(linter/formatter config 수정 차단)·`pre:edit-write:gateguard-fact-force`(파일당 첫 Edit 차단+사실확인 강제). 이 둘만 `strict` 단독 CSV 라 strict 에서만 켜진다.
  - 더 엄격히: 프로젝트 `.claude/settings.json` 에 `env.HARNESS_HOOK_PROFILE=standard`(또는 `strict`). 특정 훅만 끄려면 `HARNESS_DISABLED_HOOKS=stop:cost-tracker,…`.
- `scripts/install/merge-hooks.js` — the underlying merger; can be called directly when you don't want the symlink step. id 가 없는 (사용자가 손으로 박은) 훅 그룹은 추적 못 하므로 재머지 시 중복될 수 있다 — 머지 전 settings.json 의 id-less 하네스 훅은 정리할 것. Tests live at `tests/scripts/install/merge-hooks.test.js`.
- `hooks/prompt-pack.json` — two reference-only prompts (`ref:pre-write-guard`, `ref:review-on-stop`). Not runnable; see `hooks/README-prompt-pack.md` for what they overlap with and how to wire them up if needed.

## Self-evolution (학습 메커니즘)

세 층위로 무게가 다르다. 가벼운 것부터 무거운 것 순:

- **lessons-learned** (경량, 한 줄 교훈 로그) — `skills/lessons-learned/SKILL.md` (manual inclusion) 에 반복 교정 교훈을 한 줄씩 누적. `scripts/hooks/capture-lessons.js` (Stop hook, id `stop:capture-lessons`) 가 transcript 에서 반복 교정 신호(사용자 정정 / 빌드·테스트 실패 / 리뷰 지적)를 휴리스틱 감지하면 `systemMessage` 로 "`/lessons add` 권장" 한 줄 알림을 띄운다 — 파일은 사용자 확인 후 `/lessons` 로만 기록(자동 편집 안 함). Stop 이벤트는 `additionalContext` 를 허용하지 않으므로 systemMessage 로만 알린다. kiro-with-harness 의 Kiro `askAgent` hook 을 재해석한 것. 테스트: `tests/hooks/capture-lessons.test.js`.
- **`/learn`** (중간, 패턴→skill) — 비자명한 문제 해결을 재사용 skill 파일 1개로 추출. 추출 후 품질 게이트(체크리스트 + Save/Improve/Absorb/Drop 판정)와 저장 위치(Global vs Project) 결정을 거친다. (구 `/learn-eval` 흡수됨 — 2026-06 통합.)
- **continuous-learning-v2** (자동, instinct) — 상시 관찰(`observe-runner.js`) → instinct 누적 → `/promote`·`/evolve` 로 command/skill/agent 승격.

안정적으로 반복되는 lesson 은 `/lessons promote` 로 `rules/` steering 규칙으로 올린다.

## Running Tests

```bash
node tests/run-all.js
node tests/lib/utils.test.js
node tests/hooks/hooks.test.js
```

## Key Commands (subset)

- `/tdd-workflow` (skill) / `/plan` / `/feature-dev` — start work
- `/code-review` / `/python-review` / `/rust-review` / `/fastapi-review`
- `/build-fix` / `/rust-build` / `/test-coverage`
- `/refactor-clean` / `/security-scan` / `/quality-gate`
- `/skill-create` / `/skill-health` / `/learn` / `/lessons` / `/evolve` / `/promote`
- `/save-session` / `/resume-session` / `/checkpoint`

## Language

@rules/common/korean-language.md

## README Conventions

@rules/common/readme-rule.md

## Code Style (Node parts)

- Node.js >=18, plain CommonJS in `scripts/`
- No TypeScript in this harness's own scripts (plain `.js`)
- File naming: lowercase with hyphens
- Hook scripts: prefer small, focused scripts (~200 lines is a good target for new hooks). Larger files are fine for orchestrators, lifecycle hooks (session-start, mcp-health-check), and gates (gateguard, block-no-verify) — split when a single file mixes concerns, not just because it's long.
- Hook scripts must exit 0 on non-critical errors so they never block the user's tool call.

## Origin

Originally assembled on 2026-05-22 from two sources, then trimmed to remove plugin-bootstrap dependencies and run standalone. Selection criteria: only what maps to the workloads above. Enterprise/healthcare/blockchain/mobile-only material was intentionally left out.

Some files still carry references to the original projects — replace as you customize.
