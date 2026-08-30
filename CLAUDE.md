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

## Layout

- `agents/` — subagents available for delegation
- `skills/` — domain knowledge / workflow definitions
- `commands/` — slash commands (markdown with `description:` frontmatter)
- `hooks/` — trigger-based hook configs (JSON + handler scripts)
- `rules/` — **컨텍스트 예산이지 문서 폴더가 아니다.** 설치된 rule 은 `paths:` frontmatter 가 없으면 모든 프로젝트의 모든 세션에 로드된다. 그래서 `rules/common/` 에는 언제나 참인 불변 제약 4개만 둔다(`korean-language`·`git-workflow`·`security`·`coding-style`, 합계 <12KB). 언어·도메인 폴더(`python/`·`typescript/`·`rust/`·`web/`)는 전부 `paths:` 로 게이팅해 해당 파일을 건드릴 때만 로드된다. 절차·참고 자료(테스트 전략, 리뷰 체크리스트, 모델 라우팅, README 배지 규칙 등)는 `docs/rules-reference/` 로 — 필요할 때 읽는다. 두 규칙은 `tests/scripts/install/workloads.test.js` 가 강제한다.
- `mcp-configs/` — MCP 설정(proxy-first). **커밋된 `proxy/config.json`(9개)이 실사용 SSOT** 이고, `--with-mcp` 는 워크로드 전체 기준으로 이 파일을 덮어써 65개까지 늘린 사고 전례가 있다(디스크 9Gi + 프록시 3.0GiB). MCP 만 다시 띄울 때는 `cd mcp-configs/proxy && docker compose --profile terraform up -d`. 카탈로그 구조·사고 상세는 **`mcp-configs/README.md`**.
- `scripts/` — Node.js utilities for hooks, install/uninstall, audits
- `tests/` — test suite for `scripts/`
- `docs/rules-reference/` — 옛 `rules/common/` 중 상시 로드가 필요 없는 9개(`testing`·`patterns`·`performance`·`hooks`·`code-review`·`development-workflow`·`agents`·`model-routing`·`readme-rule`)와 rules 설치 안내 `README.md`. 설치되지 않으므로 컨텍스트를 먹지 않는다. 언어별 rule 의 `> This file extends …` 링크가 여기를 가리킨다.
- `docs/hooks-policy.md` — 훅 판정 기준·은퇴 이력(어떤 훅이 왜 내려갔는지)·프로파일 CSV 분포·머지 동작·루프 제어 표. **훅을 추가·제거하려면 먼저 읽는다.** 프로파일별 훅 수 문장은 `scripts/ci/validate-hooks.js` 가 hooks.json 실측과 대조한다.
- `docs/orca-dependencies.md` — Orca 와 `~/.claude` 를 공유하는 지점 전체(훅 11개·스킬 5종·역할 분리·점검 명령·Orca 없이 쓸 때).
- `docs/harness-assets.md` · `docs/install-menu.md` — CLAUDE.md 에서 옮겨온 스킬·에이전트 카탈로그와 설치 메뉴 상세. CLAUDE.md 는 매 세션 100% 로드되므로 "작업할 때만 필요한 목록"은 여기 둔다.
- `docs/` — long-form reference (writing guides, security guide, steering rules). `docs/plugin.md` 는 하네스와 함께 설치하는 동반 플러그인 목록(superpowers·codex·ui-ux-pro-max 등) — 이 플러그인들과 겹치는 하네스 자체 스킬(`tdd-workflow`·`verification-loop`·`codex-cli`·`design-system`)은 2026-07-26 제거됨. 새 스킬 추가 시 플러그인과의 중복 여부를 먼저 확인할 것.

## High-value Agents

`agents/` 46종. 대표: `article-writer` · `content-creator` · `devops`(mutation 전 항상 plan/dry-run) · `translator-docs` · `deep-researcher`. 전체 목록과 선정 이유는 **`docs/harness-assets.md`**.

### Model Routing (per-agent model tiers)

`model:` 은 항상 **별칭**(`opus`/`sonnet`/`haiku`)으로 적는다 — 핀된 버전 ID 금지. 현재 `opus`→Opus 5, `sonnet`→Sonnet 5, `haiku`→Haiku 4.5. **Opus 5 가 천장이다**: 더 깊은 추론이 필요하면 티어를 올리지 말고 effort 를 올리고(`high`→`xhigh`→`max`), 그다음은 위가 아니라 **옆(Codex)** 으로 간다.

티어 판단 기준은 **"박스가 열려 있는가"** 하나다. 답의 형태가 이미 정해졌으면(rubric·taxonomy 가 주어짐, 원인·해결이 확정됨, 출력 형식이 고정됨) 탐색 공간이 없으므로 **`sonnet`**. 답의 형태가 미정이거나(원인 미상 진단, 설계, 의미 보존 판정, taxonomy 가 못 덮은 것 발견) 미스 비용이 회복 불가면 **`opus`**. 기계적 고빈도는 **`haiku`**. **파이프라인이 아니라 단계별로 태깅한다** — detect→fix→judge 는 `sonnet`→`sonnet`→`opus` 이고 opus×3 이 아니다. 두 축이 충돌하면 최악 비용이 이긴다.

권위 있는 정책(작업 표·에이전트 클래스 맵·오케스트레이션·Codex 핸드오프 기준)은 **`docs/rules-reference/model-routing.md`**; `/model-route` 도 이를 따른다.

## High-value Skills for Owner's Workloads

`skills/` 115종 — 전부 실제 내용이 채워져 있고 placeholder 는 없다. 설치된 스킬은 `description` 이 매 세션 로드되므로 여기서 다시 나열하지 않는다. 워크로드별 카탈로그·출처(origin)·중복 판정 이력은 **`docs/harness-assets.md`**.

새 스킬을 추가할 때 확인할 것 두 가지: ① 동반 플러그인(`docs/plugin.md`)과 겹치지 않는지 — 겹쳐서 제거된 전례가 있다(`tdd-workflow`·`verification-loop`·`codex-cli`·`design-system`) ② 기존 스킬의 부분집합이 아닌지(`seo` 가 `seo-geo-aeo` 에 흡수된 전례).

## Workload-based Install (2-tier 메뉴)

설치는 **도메인 축 6개 톱레벨**(dev / cloud / ai / data / research / writing) → 중분류 → 상세의 3단계 체크박스 메뉴다. 중분류가 곧 워크로드 키라서 "데이터 → MySQL" 만 골랐을 때 Postgres 가이드가 끌려오지 않는다.

- 메뉴 정의는 `scripts/install/menu.js`, 워크로드 키 카탈로그는 `scripts/install/workloads.js`. 자산 추가는 파일을 두고 frontmatter 에 `workloads: [...]` 만 적으면 끝(휴리스틱 폴백도 있음).
- **메뉴 baseline 은 `core` + `writing` + `report`** (`menu.js` 의 `ALWAYS_INCLUDED`). 글·문서 작업 비중이 높아 매번 고르는 것이 의미가 없으므로 고르지 않아도 따라온다(합계 상시 비용 ~1.7k tok — 스킬은 description 만 로드되고 본문은 호출 시 읽힌다). 소셜 콘텐츠(`social-*`)는 별도 축이라 옵트인으로 남긴다. 이 baseline 은 **메뉴 경로에만** 적용된다 — `--workload=` 저수준 플래그는 "정확히 이것만"이라는 뜻이므로 그대로이고, 프로젝트 로컬 설치에서 글쓰기를 빼려면 그 경로를 쓴다.
- 워크로드 흐름에 들어오는 kind 는 **agent·command·skill·rule** 4종. hooks·mcp 는 분류 밖이라 설치 후 별도로 묻는다(`--with-hooks` / `--with-mcp` / `--no-extras`).
- 드리프트 점검: `npm run check-drift` — 레포가 깔아야 할 자산 vs 실제 심볼릭을 대조한다. 읽기 전용.
- **settings.json 점검: `npm run optimize-settings`** — 읽기 전용이 기본이고 고칠 것이 있으면 exit 1, `-- --apply` 로 적용한다. 프로파일 유무·유효성, 하네스가 더 읽지 않는 `HARNESS_*` env, 평문 비밀값이 든 `settings.json.bak.*`(**값은 절대 출력하지 않고 sha+길이로만** 식별), 스킬 description 의 `skillListing*` 캡을 본다. 훅은 `merge-hooks.js`, 링크는 `check-drift.js` 담당이라 겹치지 않는다.
- **컨텍스트 절감 목적으로 워크로드를 줄이는 건 헛수고다**(실측): 안 쓰는 워크로드 6개를 다 빼도 상시 비용은 13 tok 만 줄었다(`aws-rds`·`devops`·`integration`·`data-analysis` 는 MCP 분류용 키라 자산이 없다). 줄일 곳은 **상시 로드분**이다 — 다른 프로젝트 상시는 ≈10.4k tok(스킬 description 5.1k + 에이전트 2.6k + rules 1.8k + 커맨드 0.9k)이고, 이 레포 CLAUDE.md 는 이 레포 세션에만 얹힌다.

메뉴 구조·플래그·워크로드 키 전체 목록은 **`docs/install-menu.md`**.

## Hooks

**훅은 "되돌리기 어려운 행위 차단"만 담당한다.** 모델이 좋아질수록 훅을 늘리면 답변 품질이 *내려간다* — 스스로 판단해서 하려던 일을 매번 끼어들어 되돌리기 때문이다. 그래서 훅 수는 늘릴 대상이 아니라 줄일 대상이고, `Edit`·`Write`·`Stop` 에 붙는 코어 훅은 **0개**다. 품질·관찰·거버넌스는 커맨드(`/quality-gate`, `/code-review`, `/cost-report`)로 사람이 부를 때 돈다.

코어에 넣을지는 두 질문으로 판정한다: **① 산출물에 독자가 있는가 ② 커맨드·rule·스킬로 커버되지 않는가.** 둘을 못 넘기면 옵트인으로 내린다.

- `hooks/hooks.json` — **코어 2그룹**: `pre:bash:dispatcher`(Bash 프리플라이트) · `subagent:budget`(서브에이전트 예산 브리프). 전 프로파일에서 동일하게 2그룹이고, 프로파일은 그룹 수가 아니라 **dispatcher 내부 서브훅의 강도**만 바꾼다. 설치: `./install.sh --with-hooks` (또는 `install.ps1 -WithHooks`)
- `hooks/hooks-optional.json` — **옵트인 28그룹**(품질 게이트·차단형·관찰 전부). `node scripts/install/merge-hooks.js --optional` 로 추가하고, `--optional` 없이 재실행하면 걷힌다(머지는 선언적이다). **standard 이상 전용** — minimal 에서 켜지는 것은 0개여야 한다
- **프로파일 기본은 `minimal`** 이고 설치가 `settings.json` 의 `env.HARNESS_HOOK_PROFILE` 에 명시한다. 이미 값이 있으면 건드리지 않는다. `minimal` = 최소 가드레일만 / `standard` = + 경고 / `strict` = + 차단형. **`minimal` 에 훅을 추가하는 변경은 정의 위반이다**
- **`settings.json` 의 `hooks` 를 손으로 편집하지 않는다** — `merge-hooks.js` 를 쓴다. 소유권 판정은 "우리 스크립트를 우리 런처로 부르는가" 하나이므로 서드파티 훅(Orca 11개)은 자동 보존된다. `--dry-run` 으로 sweep 목록을 먼저 확인할 것

루프 제어(무한 루프·컨텍스트 폭증·반복 실수·비용)는 **상시 훅이 아니라 루프를 돌릴 때 `--optional` 로 켠다.**

판정 기준·은퇴 이력(왜 어떤 훅이 내려갔는지)·프로파일 CSV 분포·루프 제어 표는 **`docs/hooks-policy.md`**.

## Orca Integration

이 하네스는 **Orca 안에서 돌아간다.** Orca 는 자체 훅을 `settings.json` 의 12개 이벤트에 심고(Orca 밖에서는 no-op) 자체 스킬 5종을 링크한다. **겹치는 기능은 한쪽만 쓴다** — 워크트리 격리·핸드오프 = `orca-cli`, statusLine = claude-dashboard, 세션 재개 = 네이티브 `/resume`.

### 오케스트레이션은 Orca 전담 — 하네스는 이 축의 자산을 두지 않는다

팬아웃·task DAG·coordinator 루프·블로킹 ask/reply 는 전부 **Orca `orchestration`** 이다. 이유는 능력이 아니라 **상태의 소유자**다 — 워크트리·worker_done 대기를 들고 있는 쪽이 Orca 이고, 같은 작업 집합에 조율자가 둘이면 경쟁한다.

그래서 `Workflow` 툴은 **전역에서 내렸다**(`~/.claude/settings.json` 의 `enableWorkflows: false` · `ultracode: false`). 안 쓰기로 한 툴의 설명이 매 세션 시스템 프롬프트에 실리던 비용까지 함께 사라진다. Orca 밖에서 팬아웃이 필요해지면 문서에 분기를 남겨두는 대신 **그 키를 켠다**.

### 서브에이전트는 적극 위임 — 이 문단이 상시 승인이다

**일에 형태가 있으면 위임이 기본이다.** 예전의 "서브에이전트는 예외이지 반사가 아니다" 규칙은 2026-08-30 폐기했다 — cold 에이전트가 하네스 맥락 없이(스킬도 rubric 도 없이) 돌던 시절엔 인라인이 실제로 더 나았지만, 지금은 CLAUDE.md·`rules/` 가 모든 서브에이전트에 자동 상속되고 46종 중 38종이 rubric 을 preload 한다. **인라인은 한 번의 도구 호출로 끝나는 일에만 남는다.**

Opus 5 기본 프롬프트에는 "사용자가 요청하지 않으면 Agent 툴을 부르지 말라"가 들어 있다(모델 프롬프트 번들 소속이라 설정으로 못 끈다). **이 문단이 그 요청이다** — 1회 호출은 오케스트레이션이 아니라 그냥 도구 호출이므로 따로 묻지 않는다.

| 필요한 것 | 수단 |
|---|---|
| 지금 컨텍스트가 그대로 필요한 곁가지(조사·초안·교차검증) | **`fork`** — `Agent(subagent_type:"fork")` 또는 `/subtask`. 시스템 프롬프트·툴·모델·히스토리를 상속하고 프롬프트 캐시를 공유해 cold 보다 싸다. 단 fork 는 fork 를 못 만든다(1단) |
| rubric 이 이미 정해진 역할(리뷰·감사·번역) | `agents/` 의 cold 에이전트 — 모델 티어를 내리고 툴을 좁힐 수 있다. rubric 스킬은 `skills:` frontmatter 로 preload 되어 있고(38/46), 판단 깊이는 `effort:` 로 박아뒀다 |
| 워크트리 격리·소유권 이전 | Orca (`orca-cli`) |
| 추론 깊이 | 팬아웃이 아니라 effort 를 올린다(`/effort`) |

cold 에이전트도 **CLAUDE.md 계층과 `rules/` 는 자동으로 상속한다** — 내장 `Explore`·`Plan` 둘만 예외이고 그건 바꿀 수 없다. 상속되지 않는 것(대화 히스토리·스킬 본문·SessionStart 컨텍스트)과 그 보완 레버는 **`docs/orca-dependencies.md`**.

상한은 **빈도가 아니라 동시성·재귀**에 있다 — 동시 3개까지, 서브에이전트는 leaf(`subagent:budget` 이 못박고 fork 는 애초에 중첩 불가), 그 이상은 Orca 다. 라우팅 표 전문은 `docs/rules-reference/agents.md` → Subagent Routing.

하네스가 담당하는 것은 셋뿐이다: **① 취향·언어 규칙(`rules/`) ② 도메인 스킬(`skills/`) ③ 되돌리기 어려운 행위 차단(코어 훅 2개)**. 전체 의존 지점·역할 분리 표·점검 명령은 **`docs/orca-dependencies.md`**.

## Self-evolution (학습 메커니즘)

- **`/lessons`** (경량) — 반복 교정 교훈을 `skills/lessons-learned/SKILL.md` 에 한 줄씩 누적. `stop:capture-lessons`(optional)가 신호를 감지하면 권장 알림만 띄우고, **파일은 사용자 확인 후 `/lessons` 로만 기록한다**(자동 편집 안 함).
- **`/learn`** (중간, 패턴→skill) — 비자명한 문제 해결을 재사용 skill 1개로 추출. 품질 게이트(Save/Improve/Absorb/Drop)와 저장 위치(Global vs Project) 판정을 거친다.

**자동 층위(instinct)는 없다.** 상시 관찰로 instinct 를 누적하던 continuous-learning-v2 는 산출물이 0이라 `627dd9f` 에서 제거됐다(-13,062줄). 다시 붙이려면 그 커밋을 되살리는 것이 아니라 관찰 결과가 **실제로 쓰이는 경로**(`/lessons` → `rules/`)부터 확인하고 시작한다.

안정적으로 반복되는 lesson 은 `/lessons promote` 로 `rules/` steering 규칙으로 올린다 — 단 rules 는 상시 로드 예산이므로 불변 제약만 올린다.

## Running Tests

```bash
node tests/run-all.js
node tests/lib/utils.test.js
node tests/hooks/hooks.test.js
```

## Key Commands (subset)

- `/plan` / `/feature-dev` — start work (TDD는 superpowers 플러그인의 `test-driven-development` 스킬)
- `/code-review` / `/python-review` / `/rust-review` / `/fastapi-review`
- `/build-fix` / `/rust-build` / `/test-coverage`
- `/refactor-clean` / `/security-scan` / `/quality-gate`
- `/skill-create` / `/learn` / `/lessons`
- `/save-session` / `/resume-session` / `/checkpoint`

## Language

@rules/common/korean-language.md

## README Conventions

README.md 를 새로 쓰거나 배지를 손볼 때는 프로젝트 파일(`package.json`·`pyproject.toml`·`Dockerfile`·`LICENSE` 등)을 먼저 읽어 **실제 사용 중인 기술만** 배지로 올린다. 후원 배지(Buy Me A Coffee 등)는 규칙으로 넣지 않는다 — 개인 계정 링크가 클라이언트·회사 레포까지 새어 나가기 때문이며, 필요하면 그때 직접 붙인다.

감지 조건 → 배지 매핑 표와 배치 규칙 전문은 `docs/rules-reference/readme-rule.md` 에 있다 — README 작업을 할 때 그 파일을 읽고 따른다.

## Code Style (Node parts)

- Node.js >=18, plain CommonJS in `scripts/`
- No TypeScript in this harness's own scripts (plain `.js`)
- File naming: lowercase with hyphens
- Hook scripts: prefer small, focused scripts (~200 lines is a good target for new hooks). Larger files are fine for orchestrators, lifecycle hooks (session-start, mcp-health-check), and gates (gateguard, block-no-verify) — split when a single file mixes concerns, not just because it's long.
- Hook scripts must exit 0 on non-critical errors so they never block the user's tool call.

## Origin

Originally assembled on 2026-05-22 from two sources, then trimmed to remove plugin-bootstrap dependencies and run standalone. Selection criteria: only what maps to the workloads above. Enterprise/healthcare/blockchain/mobile-only material was intentionally left out.

Some files still carry references to the original projects — replace as you customize.
