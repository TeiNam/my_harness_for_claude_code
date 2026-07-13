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
- **Social Content**: LinkedIn personal-branding content production (voice profile, posts, hooks, graphics, carousels) — separate social workload split into `social-voice` / `social-content` / `social-visual`, not bundled into `writing`
- **Apple Platforms**: iOS/macOS/watchOS/visionOS development, Swift, SwiftUI, App Store lifecycle — separate `apple` workload, opt-in only

## Layout

- `agents/` — subagents available for delegation
- `skills/` — domain knowledge / workflow definitions
- `commands/` — slash commands (markdown with `description:` frontmatter)
- `hooks/` — trigger-based hook configs (JSON + handler scripts)
- `rules/` — always-follow guidelines (common + per-language)
- `mcp-configs/` — MCP server configs (proxy-first: `proxy/` holds the mcp-proxy compose stack; `mcp-servers.json` catalog is the SSOT, marking each server `route: proxy|local` + `workloads: [...]`). 설치 시 `scripts/install/build-mcp-config.js` 가 선택 워크로드와 매칭되는 `route=proxy` 서버만 골라 `proxy/config.json` 을 빌드한다(통짜 X). `terraform` 선택 시 compose 의 `terraform-mcp` profile 동반 기동.
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

### Model Routing (per-agent model tiers)

Agents declare `model:` as an **alias** (`opus` / `sonnet` / `haiku`), never a pinned version ID, so the fleet follows model upgrades without a mass re-tag. Current lineup: `opus`→**Opus 4.8**, `sonnet`→**Sonnet 5**, `haiku`→**Haiku 4.5**. The authoritative policy (task tables, agent-class map, orchestration, Codex handoff) is `rules/common/model-routing.md`; `commands/model-route.md` and `/model-route` defer to it. Classes: reasoning-heavy/high-stakes agents (`architect`, `planner`, `deep-researcher`, `security-reviewer`, fidelity/quality auditors) → `opus`; implementation/review specialists → `sonnet`; mechanical high-frequency (`doc-updater`, `docs-lookup`) → `haiku`. Pick by worst-case cost of a wrong answer, not the average. For a genuinely independent cross-family opinion, route to Codex via `skills/codex-cli` (not just a re-prompt of the same model).

## High-value Skills for Owner's Workloads

Filled-in (real content, not placeholder):

- **DB**: `skills/postgres-guideline/`, `skills/mysql-guideline/`, `skills/mongodb-guideline/`, `skills/dynamodb-guideline/` — schema / index / partitioning / sharding / connection
- **Frontend**: `skills/obsidian-plugin-develop/` (TypeScript + i18n + Chromium + release checklist), `skills/vite-patterns/`, `skills/frontend-patterns/`, `skills/frontend-design/` (origin: anthropics/skills — aesthetic direction, typography, anti-template judgment)
- **Supanova (한글 랜딩페이지 디자인 엔진)**: `skills/taste-skill/`, `skills/redesign-skill/`, `skills/soft-skill/`, `skills/output-skill/` — origin: supanova-design-skill-main (based on Leonxlnx/taste-skill). Standalone HTML + Tailwind CDN 랜딩페이지를 한글 우선(Pretendard, `word-break: keep-all`, 자연스러운 한국어 카피)으로 생성/리디자인. `taste-skill` 상단에 `DESIGN_VARIANCE`/`MOTION_INTENSITY`/`VISUAL_DENSITY`/`LANDING_PURPOSE` 4개 설정값. 새 랜딩페이지는 `taste-skill`+`output-skill`, 기존 페이지 개선은 `redesign-skill`, 최고 퀄리티는 세 개 다 + `soft-skill`. `frontend` 워크로드로 통합.
- **SEO/GEO/AEO**: `skills/seo-geo-aeo/` (origin: SNLabat/SEO-GEO-AEO-Skill) — URL 하나로 SEO·GEO(생성형 검색엔진)·AEO(답변엔진) 3축 감사, Word/PDF 리포트 산출. 기존 `skills/seo/`(harness 자체 SEO 스킬)와 별개, 둘 다 `frontend` 워크로드.
- **AI**: `skills/claude-api/` (Anthropic SDK), `skills/foundation-models-on-device/`, `skills/ai-regression-testing/`, `skills/cost-aware-llm-pipeline/`, `skills/aws-bedrock/`, `skills/realtime-stt-huggingface/`, `skills/ai-tui/`
- **AI TUI (터미널 에이전트 초기화면·두뇌)**: `skills/ai-tui/` — Claude Code·stocker 스타일 터미널 AI 에이전트의 초기화면(배너·로고·입력창·힌트바 6요소)과 두뇌(프롬프트·스킬·MCP·사용룰)를 세팅하는 크로스 언어 레퍼런스. `references/` 4종 — 언어별 3종(`node-pi-tui`, `rust-ratatui`, `python-textual`)과 언어 중립 `agent-brain-setup`. 유지형(pi-tui/textual) vs 즉시형(ratatui) 렌더링 차이와 ANSI 폭 함정을 언어별로 대비. `${CLAUDE_SKILL_DIR}` 토큰 치환. `ai`·`nodejs`·`rust`·`python-backend` 워크로드로 통합.
- **Codex (교차 모델 세컨드 오피니언)**: `skills/codex-cli/` — OpenAI Codex CLI(`codex exec` / `resume`)를 Claude Code 안에서 호출. 다른 모델 패밀리의 독립적 리뷰(Claude 작성 코드의 adversarial 검토), 어려운 결정의 tie-break, 대규모 기계적 편집 오프로드용. `</dev/null` stdin 리다이렉트(비-TTY 무한 대기 방지)·`2>/dev/null`(thinking 억제)·`--skip-git-repo-check` 3종은 필수. 샌드박스는 최소 권한(`read-only` 기본), `--full-auto`/`danger-full-access`는 사전 승인. Codex 출력은 검증 대상인 제안이지 정답 아님. `core` 워크로드.
- **문서 생성 (PDF / DOCX / XLSX)**: `skills/pdf/`(pypdf 읽기·병합·폼필·분할, reportlab/weasyprint 생성, CJK 폰트 등록), `skills/docx/`(python-docx + docxtpl 템플릿 채우기, 스타일·표·한글 eastAsia 폰트), `skills/xlsx/`(openpyxl 스타일 리포트·수식·차트, pandas 핸드오프, `data_only` 함정) — 프로그래밍 방식 오피스 문서 산출. 슬라이드는 `ppt-authoring`+`frontend-slides`, 사람처럼 쓴 한글 산문은 `humanize-korean`가 담당하므로 별도 스킬 미신설. `core` 워크로드.
- **Cloud**: `skills/aws-cloud/` (IAM, S3, Lambda, ECS/Fargate, RDS, networking, cost guardrails)
- **FinOps**: `skills/aws-finops/` — FinOps Foundation Framework(Inform/Optimize/Operate) + AWS Cost Management(Cost Explorer·CUR·Budgets·Anomaly, 태깅·Cost Categories, Savings Plans vs RI, Compute Optimizer, 단위경제학, showback/chargeback). `finops` 워크로드. AWS 청구서·커밋먼트 계층 담당(인프라 구성은 `aws-cloud`, LLM 토큰비용은 `cost-aware-llm-pipeline`).
- **데이터 분석 방법론**: `skills/analysis-methodology/` — 도구가 아닌 판단층(문제 프레이밍→기법 결정트리→검증→의사결정). references 3종(analysis-type-decision·experiment-design·domain-playbooks). 도구·문법은 `skills/python-data-analysis/`(pandas/polars/duckdb)로 위임. `python-data` 워크로드. 워크로드 키 `data-analysis`(AWS Glue/Athena/Redshift MCP)와는 이름만 다르게 분리.
- **Backend**: `skills/fastapi-backend-best-practices/` (api-design, async-patterns, deployment, domain-modeling, project-structure, security, testing), `skills/python-patterns/`, `skills/rust-patterns/`
- **Writing**: `skills/markdown-writing/`, `skills/article-writing/`, `skills/brand-voice/`, `skills/crosspost/`, `skills/frontend-slides/`, `skills/tech-blogging/`, `skills/creative-writing/`, `skills/ppt-authoring/`, `skills/tech-writer/`
- **Tech Writer (기술 문서 작성·윤문)**: `skills/tech-writer/` — 한/영 기술 문서를 새로 쓰거나(write) 기존 초안을 윤문(polish)하는 오케스트레이터. `references/` 3종(quick-rules, tech-doc-taxonomy, tech-writing-playbook)과 전용 에이전트 5종(`tech-doc-writer`, `doc-clarity-reviewer`, `doc-quality-detector`, `tech-fidelity-auditor`, `tech-writer-monolith`)을 둔다. `${CLAUDE_SKILL_DIR}` 토큰 치환으로 경로 독립. `writing` 워크로드로 통합.
- **Humanize (한글 AI 티 제거)**: `skills/humanize-korean/` — AI가 쓴 한글 글의 번역투·관용구·기계적 병렬·피동태 남용 등 10대 카테고리 패턴을 탐지·윤문. Fast 모드(monolith 1콜)와 strict 5인 파이프라인. 진입 커맨드 `/humanize`·`/humanize-redo`. **런타임 에이전트(`writing` 상시 로드)**: `humanize-monolith`, `ai-tell-detector`, `korean-style-rewriter`, `content-fidelity-auditor`, `naturalness-reviewer`. **스킬 유지·확장용 메타 에이전트는 `lab` 그룹으로 격리**(상시 로드 제외, 분류체계 v2.0 승격·학술 인용·metric 엔지니어링·웹 확장 시에만 수동 호출): `korean-ai-tell-taxonomist`, `taxonomy-gap-analyzer`, `translationese-research-distiller`, `post-editese-metric-engineer`, `quick-rules-integrator`, `korean-translation-scholar`, `humanize-web-architect`. 원본 epoko77-ai/im-not-ai 를 `writing` 워크로드로 통합.
- **Social Content (LinkedIn 개인 브랜딩 콘텐츠 제작)**: origin: charlie947/social-media-skills. 기술 문서/블로깅용 `writing` 워크로드와 분리했으므로 글쓰기 카테고리에서 "기술 문서"만 고르면 이 17종은 끌려오지 않는다. 설치 시 글쓰기 › 소셜 상세 tier(`--writing-social=`)로 파이프라인 단계별 3그룹을 골라 담는다 — **`social-voice`**(`voice-builder`(voice.md/about-me.md 생성), `newsletter-voice`, `profile-optimizer`) → **`social-content`**(콘텐츠 제작·검증: `post-writer`, `post-formatter`, `hook-generator`, `content-matrix`, `niche-research`, `pinned-comment`, `reels-scripting`, `post-scorer`, `analytics-dashboard`) → **`social-visual`**(`graphic-designer`, `gemini-carousel`, `gemini-infographic`, `quote-post`, `youtube-thumbnail`). `reels-scripting`은 `APIFY_API_TOKEN`·`GOOGLE_AI_API_KEY` 환경변수 필요.
- **Apple 플랫폼 개발**: `skills/apple-*` 23개 카테고리 — origin: rshankras/claude-code-apple-skills (MIT, upstream LICENSE 사본은 `skills/apple-shared/LICENSE-upstream.txt`). iOS/macOS/watchOS/visionOS를 플랫폼별로 세분화하지 않는 대신, 영역별 상세 tier 3그룹으로 나눴다 — **`apple-core`**(핵심 개발: ios·macos·swift·swiftui·design·testing·generators·security·performance + 메타 `shared`, 10종), **`apple-platform`**(플랫폼 특화: watchos·visionos·swiftdata·mapkit·foundation·core-ml·apple-intelligence, 7종), **`apple-product`**(제품·운영: product·app-store·growth·legal·monetization·release-review, 6종). 설치 시 `--apple=core,platform,product` 로 고르거나 `--category=apple`(=3그룹 별칭)로 전체를 담는다. 각 카테고리는 `skills/apple-<name>/SKILL.md` 가 라우터이고, 하위 서브스킬(`skills/apple-<name>/<sub>/SKILL.md`)은 라우터가 참고 파일로 읽어들이는 2단 구조 — Claude Code의 스킬 탐색은 1단 중첩만 인식하므로 서브스킬 자체는 자동 발견되지 않는다.
  - **핵심 개발**: `apple-ios`, `apple-macos`, `apple-swift`(동시성·Swift 6.2), `apple-swiftui`(AlarmKit/WebKit/텍스트편집/툴바/3D차트), `apple-design`(Liquid Glass), `apple-testing`(TDD/스냅샷/특성화 테스트), `apple-generators`(63개 코드 생성기 — 로깅/분석/인증/페이월/설정화면/영속성/온보딩 등), `apple-security`, `apple-performance`(Instruments/SwiftUI 리렌더 진단)
  - **플랫폼 특화**: `apple-watchos`, `apple-visionos`, `apple-swiftdata`, `apple-mapkit`, `apple-foundation`, `apple-core-ml`, `apple-apple-intelligence`(Foundation Models/Visual Intelligence/App Intents)
  - **제품·운영**: `apple-product`(아이디어→PRD→아키텍처→App Store 7종 스펙 문서 워크플로), `apple-app-store`(ASO/키워드/리젝 대응), `apple-growth`(분석·PR·커뮤니티), `apple-legal`(개인정보정책/이용약관), `apple-monetization`, `apple-release-review`(배포 전 감사 체크리스트)
  - **메타**: `apple-shared`(`skill-creator`/`skill-auditor` — 새 Apple 스킬 작성·감사용)
  - 카테고리 간 상호 참조 경로는 접두사 없는 원본 경로(`skills/ios/...`, `skills/generators/...` 등)를 전부 `skills/apple-<name>/...` 로 재작성했고, 원저작자 로컬 경로(`/Users/ravishankar/...`)는 제거했다(`scripts/ci/validate-no-personal-paths.js` 통과 확인).

## Still Placeholder Skills

None — all previously-scaffolded skills are now filled in. If new placeholders
are added later, list them here so they're easy to find and complete.

## Workload-based Install (2-tier 메뉴)

설치는 **도메인 축 6개 톱레벨 카테고리**(**dev / cloud / ai / data / research / writing**) 와 중분류(sub-옵션)·상세로 결정되는 **3단계(대분류→중분류→소분류)** 메뉴다. sub-옵션이 곧 워크로드 키와 매칭되어, 예컨대 "데이터 → MySQL" 만 골랐을 때 Postgres 가이드까지 끌려오지 않는다. 대분류 구성:
  - **dev**(개발): frontend · 백엔드(python-backend/rust/nodejs) · Apple(상세 3그룹 `apple-core`/`apple-platform`/`apple-product`) · 플러그인(obsidian/chrome/claude)
  - **cloud**(AWS 운영): 인프라·컨테이너(cloud+devops) · finops · integration
  - **ai**: ai(Bedrock·SageMaker·Kendra 등)
  - **data**: 분석(python-data/data-analysis) · 설계(mysql/postgres/mongodb/dynamodb/aws-rds)
  - **research**(리서치·리포트): 웹 검색(research) · 기술 리포트(report=tech-writer)
  - **writing**(글쓰기): 일반 글쓰기(writing) · 소셜(상세 3그룹 `social-voice`/`social-content`/`social-visual`)
  상세 tier(3단째)는 자산이 많은 dev.apple(23)·writing.social(17) 두 중분류에만 붙였고, 나머지는 leaf(3단계 미진입)다. 옛 카테고리(backend/plugin/data-design/data-analysis/apple 톱레벨)는 이 도메인 축으로 재편되면서 dev·data 등으로 흡수됐다.

- 톱레벨 카테고리 → sub-옵션 → 상세(`detailOptions`) 매핑은 `scripts/install/menu.js` 한 곳에서 정의된다. `detailOptions` 는 leaf 가 될 수 있는 노드(subOptions 없는 category, 또는 subOption)에 부착한다.
- 워크로드 키 카탈로그는 `scripts/install/workloads.js` (`core, research, report, python-backend, python-data, rust, nodejs, cloud, devops, finops, integration, aws-rds, data-analysis, ai, frontend, obsidian, plugin-chrome, plugin-claude, mysql, postgres, mongodb, dynamodb, writing, social-voice, social-content, social-visual, apple-core, apple-platform, apple-product`). `core` 는 항상 포함되며 이제 **최소 baseline**(github·context7·time·fetch MCP + 범용 에이전트)만 담는다. AWS MCP 분류용 키 — `devops`(IaC·컨테이너·서버리스·관측성)·`finops`(비용·요금)·`integration`(SNS·SQS·MQ·Step Functions)·`aws-rds`(Aurora·RDS·DSQL·Keyspaces, 로컬 DB설계와 분리)·`data-analysis`(Glue·Athena·Redshift·Neptune) — 로 `cloud` 통짜 바구니를 막는다. `research`(exa·brave·deep-researcher, 웹 검색·자료조사)·`report`(tech-writer 계열, 기술 리포트)는 각각 core·writing 에서 분리했다. 옛 통짜 키 `apple` 은 `workloads.js` 의 `expandAliases()` 가 `apple-core,apple-platform,apple-product` 로 확장하는 별칭으로 계속 동작한다(`--workload=apple`, `--category=apple`). `lab` 은 메뉴에 노출되지 않는 수동 전용 키로 (`--workload=...,lab`), humanize 메타 에이전트 격리에만 쓴다.
- 설치 시작 시 `scripts/install/check-global.js` 가 글로벌 baseline 상태(`absent`/`outdated`/`current`)를 판정한다 — `$CLAUDE_HOME/_harness-manifest.json`(설치 종료 시 `manifest.js` 가 기록: version·workloads·installedAt) 의 버전을 repo `VERSION` 과 비교. 심볼릭 설치는 멱등이라 세 상태 모두 링크 루프를 그대로 태우고, 사용자에겐 상태만 알린다.
- 진입점은 `scripts/install/select-workloads.js` 로, 다음 셋 중 하나를 자동으로 고른다:
  - 메뉴 CLI 플래그(`--category=`, `--backend=`, `--apple=`, `--writing-social=` …) 가 있으면 비대화형으로 그 값 사용
  - 인자가 없고 TTY 면 방향키 체크박스 3단계 메뉴(`scripts/install/checkbox-prompt.js`, 의존성 0)
  - 그 외엔 `--all` 폴백
- 결정된 워크로드는 `scripts/install/select-assets.js` 로 넘어가 자산 frontmatter `workloads:` 와 교집합 매칭 → `kind\tsource\ttarget` 라인 출력 → install.sh / install.ps1 가 파일별 심볼릭 링크로 `$CLAUDE_HOME/<kind>s/_harness/...` 에 설치한다. 워크로드 흐름에 들어오는 kind 는 **agent·command·skill·rule** 4종뿐이다.
- **워크로드 외(hooks·mcp) 추가 설치 프롬프트**: hooks·mcp 는 워크로드 분류 밖(별도 파일, 통째 설치)이라, 워크로드 자산 설치 후 **TTY 면 두 번 물어본다** — (1) hooks 를 settings.json 에 머지할지, (2) MCP proxy 를 `docker compose up -d` 로 기동할지. 둘 다 기본값 N. `--with-hooks`(`-WithHooks`) 를 주면 hooks 는 묻지 않고 바로 머지하고, `--with-mcp`(`-WithMcp`) 를 주면 MCP proxy 를 묻지 않고 바로 기동한다(둘 다 비대화형에서도 동작; docker/데몬/compose 미비 시 경고만 하고 넘어감 — `setup_mcp_proxy`/`Set-McpProxy`). `--no-extras`(`-NoExtras`) 또는 비대화형(파이프/CI)이면 프롬프트를 건너뛰고 워크로드만 설치(기존 동작 보존). MCP 는 proxy-first(`mcp-configs/proxy/` compose 스택)이고, 클라이언트 `.mcp.json` 은 프록시 서버를 `localhost:9090/<서버>/mcp` URL 로, 로컬 서버(sentry·playwright)는 직접 명령으로 참조한다.
- repo-root 링크 `$CLAUDE_HOME/_harness` 는 항상 생성된다 — `hooks/hooks.json` 의 inline bootstrap 이 root 후보로 본다. 부트스트랩 우선순위: `$CLAUDE_PLUGIN_ROOT` → `$CLAUDE_PROJECT_DIR/.claude(_harness)` → `$HOME/.claude(_harness, plugins/_harness)`. 따라서 `CLAUDE_HOME` 을 프로젝트 로컬로 둬도 (예: `$PWD/.claude`) `CLAUDE_PROJECT_DIR` 만 주입되면 동작한다.
- `--with-hooks` 로 hooks 를 머지하고 `CLAUDE_HOME` 이 `$HOME/.claude` 가 아닌 경우, 일부 환경 (CLAUDE_PROJECT_DIR 미주입 등) 을 위한 안전망으로 `$HOME/.claude/_harness` 보조 링크가 함께 생성된다. 끄려면 `--no-home-link` (`-NoHomeLink`).
- 자산 추가: 파일을 두고 frontmatter 에 `workloads: [...]` 만 적으면 끝. 휴리스틱에 맡길 수도 있다. 일괄 재태깅은 `node scripts/install/tag-assets.js --apply --force`.
- 저수준 모드: `--workload=python-backend,mysql` 를 직접 지정하면 메뉴를 무시하고 그 값만 사용한다.
- **드리프트 점검**: `npm run check-drift [-- --workload=core]` (= `scripts/install/check-drift.js`). 선택 워크로드 기준으로 "레포가 깔아야 할 자산" vs "실제 `$CLAUDE_HOME` 심볼릭"을 대조해 missing / wrong-target / broken 을 보고하고 drift 가 있으면 exit 1 + `./install.sh --force` 안내. 읽기 전용 — 링크를 만들거나 지우지 않는다. "자산은 옛 상태로 stale 인데 훅만 풀 주입" 같은 어긋남을 한 방에 드러내려는 용도(과거 글로벌이 거의 비어 있었던 사고의 재발 방지).
- 테스트: `tests/scripts/install/{workloads,menu,select-workloads,select-assets,tag-assets,merge-hooks,manifest,check-global,checkbox-prompt}.test.js`.

## Hooks (status)

- `hooks/hooks.json` — main hook stack. Install via `./install.sh --with-hooks` (or `install.ps1 -WithHooks`), which merges entries into `~/.claude/settings.json` keyed by `id`. Re-runs are idempotent; user-added entries are preserved. `--with-hooks --dry-run` previews the change; `--with-hooks --uninstall` removes only harness-owned ids.
- **글로벌 기본은 `HARNESS_HOOK_PROFILE=minimal`** (`~/.claude/settings.json` 의 `env`). hooks.json 의 모든 그룹은 `run-with-flags.js <id> <script> <profilesCsv>` 로 게이팅되고(Stop/SessionEnd 훅은 인라인 bootstrap 래퍼가 같은 CSV 를 spawnSync 인자로 넘긴다), `scripts/lib/hook-flags.js` 가 profile 과 `HARNESS_DISABLED_HOOKS` CSV 를 읽어 실행 여부를 결정한다. 3단계는 누적 포함 관계다:
  - **minimal (9훅)**: 라이프사이클·안전·메트릭만 — `session:start`·`session:end:marker`·`stop:session-end`·`stop:evaluate-session`·`stop:capture-lessons`·`stop:cost-tracker`·`post:harness-metrics-bridge`·`pre/post:bash:dispatcher`. (앞 3개는 게이트 없는 직접 실행이라 항상 ON.)
  - **standard (28훅)**: minimal + 품질·관찰·거버넌스 **경고** 훅 (observe·governance·quality-gate·console-warn·design-quality·context-monitor·mcp-health-check·format-typecheck·command-registry 등). 코드 프로젝트 권장값. `stop:command-registry` 는 하네스 repo 에서 `commands/*.md` 가 바뀌면 `COMMAND-REGISTRY.json` 을 재생성하는 비차단 훅(다른 repo 에선 조용히 skip).
  - **strict (31훅)**: standard + **차단형(blocking)** 훅 2종 — `pre:config-protection`(linter/formatter config 수정 차단)·`pre:edit-write:gateguard-fact-force`(파일당 첫 Edit 차단+사실확인 강제) — 과 **테스트 자동 실행** `stop:run-tests`(소스 변경 시 npm/pnpm/yarn/bun test·pytest·cargo test 를 프로젝트 루트별로 실행, 실패 시 경고만 하는 비차단형). 이 셋만 `strict` 단독 CSV 라 strict 에서만 켜진다. `stop:run-tests` 는 `HARNESS_STOP_TESTS=off` 로 개별 차단 가능.
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
