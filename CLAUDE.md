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
- `mcp-configs/` — MCP server configs (proxy-first: `proxy/` holds the mcp-proxy compose stack; `mcp-servers.json` catalog is the SSOT, marking each server `route: proxy|local` + `workloads: [...]`). 설치 시 `scripts/install/build-mcp-config.js` 가 선택 워크로드와 매칭되는 `route=proxy` 서버만 골라 `proxy/config.json` 을 빌드한다. `terraform` 선택 시 compose 의 `terraform-mcp` profile 동반 기동.
  - **함정: `--with-mcp` 는 config.json 을 워크로드 전체 기준으로 덮어쓴다.** AWS 세분 워크로드(`cloud`·`ai`·`devops`·`finops`·`aws-rds`·`data-analysis`·`integration`)를 다 켜면 **65개**가 되고, 실측하면 디스크 9Gi 소비 + 프록시 메모리 3.0GiB(VM 4GiB 의 80%) + MCP 도구 목록으로 컨텍스트 잠식이 일어난다(2026-08-14 사고). 그래서 **커밋된 `proxy/config.json`(9개: github·exa·context7·brave-search·time·fetch·aws-documentation·obsidian·terraform)이 실사용 SSOT** 다.
  - 빌더는 `RECOMMENDED_MAX` 초과 시 stderr 로 경고한다 — 설치 출력을 잘라 읽다가 그 경고를 놓치면 위 사고가 재현된다. MCP 만 다시 띄울 때는 `--with-mcp` 대신 `cd mcp-configs/proxy && docker compose --profile terraform up -d` 를 쓰고, 서버를 바꿀 때만 `node scripts/install/build-mcp-config.js --servers=a,b,c` 로 명시 빌드한다.
- `scripts/` — Node.js utilities for hooks, install/uninstall, audits
- `tests/` — test suite for `scripts/`
- `docs/rules-reference/` — 옛 `rules/common/` 중 상시 로드가 필요 없는 9개(`testing`·`patterns`·`performance`·`hooks`·`code-review`·`development-workflow`·`agents`·`model-routing`·`readme-rule`)와 rules 설치 안내 `README.md`. 설치되지 않으므로 컨텍스트를 먹지 않는다. 언어별 rule 의 `> This file extends …` 링크가 여기를 가리킨다.
- `docs/orca-dependencies.md` — Orca 와 `~/.claude` 를 공유하는 지점 전체(훅 11개·스킬 5종·역할 분리·점검 명령·Orca 없이 쓸 때).
- `docs/harness-assets.md` · `docs/install-menu.md` — CLAUDE.md 에서 옮겨온 스킬·에이전트 카탈로그와 설치 메뉴 상세. CLAUDE.md 는 매 세션 100% 로드되므로 "작업할 때만 필요한 목록"은 여기 둔다.
- `docs/` — long-form reference (writing guides, security guide, steering rules). `docs/plugin.md` 는 하네스와 함께 설치하는 동반 플러그인 목록(superpowers·codex·ui-ux-pro-max 등) — 이 플러그인들과 겹치는 하네스 자체 스킬(`tdd-workflow`·`verification-loop`·`codex-cli`·`design-system`)은 2026-07-26 제거됨. 새 스킬 추가 시 플러그인과의 중복 여부를 먼저 확인할 것.

## High-value Agents

`agents/` 48종. 대표: `rdbms-data-modeler`(대상 DB 확인 후 mysql/postgres 가이드라인 스킬로 라우팅) · `article-writer` · `content-creator` · `devops`(mutation 전 항상 plan/dry-run) · `translator-docs` · `deep-researcher`. 전체 목록과 선정 이유는 **`docs/harness-assets.md`**.

### Model Routing (per-agent model tiers)

`model:` 은 항상 **별칭**(`opus`/`sonnet`/`haiku`)으로 적는다 — 핀된 버전 ID 금지. 현재 `opus`→Opus 5, `sonnet`→Sonnet 5, `haiku`→Haiku 4.5. **Opus 5 가 천장이다**: 더 깊은 추론이 필요하면 티어를 올리지 말고 effort 를 올리고(`high`→`xhigh`→`max`), 그다음은 위가 아니라 **옆(Codex)** 으로 간다.

티어 판단 기준은 **"박스가 열려 있는가"** 하나다. 답의 형태가 이미 정해졌으면(rubric·taxonomy 가 주어짐, 원인·해결이 확정됨, 출력 형식이 고정됨) 탐색 공간이 없으므로 **`sonnet`**. 답의 형태가 미정이거나(원인 미상 진단, 설계, 의미 보존 판정, taxonomy 가 못 덮은 것 발견) 미스 비용이 회복 불가면 **`opus`**. 기계적 고빈도는 **`haiku`**. **파이프라인이 아니라 단계별로 태깅한다** — detect→fix→judge 는 `sonnet`→`sonnet`→`opus` 이고 opus×3 이 아니다. 두 축이 충돌하면 최악 비용이 이긴다.

권위 있는 정책(작업 표·에이전트 클래스 맵·오케스트레이션·Codex 핸드오프 기준)은 **`docs/rules-reference/model-routing.md`**; `/model-route` 도 이를 따른다.

## High-value Skills for Owner's Workloads

`skills/` 121종 — 전부 실제 내용이 채워져 있고 placeholder 는 없다. 설치된 스킬은 `description` 이 매 세션 로드되므로 여기서 다시 나열하지 않는다. 워크로드별 카탈로그·출처(origin)·중복 판정 이력은 **`docs/harness-assets.md`**.

새 스킬을 추가할 때 확인할 것 두 가지: ① 동반 플러그인(`docs/plugin.md`)과 겹치지 않는지 — 겹쳐서 제거된 전례가 있다(`tdd-workflow`·`verification-loop`·`codex-cli`·`design-system`) ② 기존 스킬의 부분집합이 아닌지(`seo` 가 `seo-geo-aeo` 에 흡수된 전례).

## Workload-based Install (2-tier 메뉴)

설치는 **도메인 축 6개 톱레벨**(dev / cloud / ai / data / research / writing) → 중분류 → 상세의 3단계 체크박스 메뉴다. 중분류가 곧 워크로드 키라서 "데이터 → MySQL" 만 골랐을 때 Postgres 가이드가 끌려오지 않는다.

- 메뉴 정의는 `scripts/install/menu.js`, 워크로드 키 카탈로그는 `scripts/install/workloads.js`. 자산 추가는 파일을 두고 frontmatter 에 `workloads: [...]` 만 적으면 끝(휴리스틱 폴백도 있음).
- **메뉴 baseline 은 `core` + `writing` + `report`** (`menu.js` 의 `ALWAYS_INCLUDED`). 글·문서 작업 비중이 높아 매번 고르는 것이 의미가 없으므로 고르지 않아도 따라온다(합계 상시 비용 ~1.7k tok — 스킬은 description 만 로드되고 본문은 호출 시 읽힌다). 소셜 콘텐츠(`social-*`)는 별도 축이라 옵트인으로 남긴다. 이 baseline 은 **메뉴 경로에만** 적용된다 — `--workload=` 저수준 플래그는 "정확히 이것만"이라는 뜻이므로 그대로이고, 프로젝트 로컬 설치에서 글쓰기를 빼려면 그 경로를 쓴다.
- 워크로드 흐름에 들어오는 kind 는 **agent·command·skill·rule** 4종. hooks·mcp 는 분류 밖이라 설치 후 별도로 묻는다(`--with-hooks` / `--with-mcp` / `--no-extras`).
- 드리프트 점검: `npm run check-drift` — 레포가 깔아야 할 자산 vs 실제 심볼릭을 대조한다. 읽기 전용.
- **settings.json 점검: `npm run optimize-settings`** — 기본은 읽기 전용이고 고칠 것이 있으면 exit 1, `-- --apply` 로 적용한다. 보는 것은 넷: ① `env.HARNESS_HOOK_PROFILE` 유무·유효성 ② 하네스가 더 읽지 않는 `HARNESS_*` env(훅이 은퇴하면 남는 찌꺼기 — 하드코딩 표가 아니라 소스를 훑어 판정하므로 자동으로 최신이다) ③ 옵트인 훅만 읽는 env 인데 프로파일이 minimal(보고만) ④ `settings.json.bak.*` 사본의 평문 비밀값(**값은 절대 출력하지 않고 sha 앞 8자+길이로만** 식별, `--apply` 시 삭제) + 스킬 description 이 `skillListing*` 캡에 걸리는지. 훅 구성은 `merge-hooks.js`, 링크는 `check-drift.js` 담당이라 겹치지 않는다.
- **컨텍스트 절감 목적으로 워크로드를 줄이는 건 헛수고다**(2026-08 실측): 안 쓰는 워크로드 6개를 다 빼도 상시 비용은 13 tok 만 줄었다. `aws-rds`·`devops`·`integration`·`data-analysis` 는 MCP 분류용 키라 스킬·에이전트 자산이 아예 없다. 컨텍스트를 줄이려면 rules(`rules/` 항목 참조)와 CLAUDE.md 를 손대야 한다.

메뉴 구조·플래그·워크로드 키 전체 목록은 **`docs/install-menu.md`**.

## Hooks (status)

**설계 기준: 훅은 "되돌리기 어려운 행위 차단 + 라이프사이클"만 담당한다.** 모델이 좋아질수록 훅을 늘리면 답변 품질이 *내려간다* — 스스로 판단해서 하려던 일을 매번 끼어들어 되돌리기 때문이다. 그래서 훅 수는 늘릴 대상이 아니라 줄일 대상이다. 품질·관찰·거버넌스는 훅이 아니라 커맨드(`/quality-gate`, `/code-review`, `/cost-report`)로 사람이 부를 때 돈다. 이유는 비용이 아니라 **간섭**이다 — Opus 5 는 지시가 많을 때보다 *서로 반대되는 지시*가 있을 때 판단이 무너지고, 매 Edit 마다 끼어드는 경고·차단 훅이 그 충돌의 최대 공급원이었다. `Edit`·`Write` 에 붙는 코어 훅은 **0개**다.

- `hooks/hooks.json` — **코어 스택 2그룹.** Install via `./install.sh --with-hooks` (or `install.ps1 -WithHooks`).
  `pre:bash:dispatcher`(Bash 프리플라이트) · `subagent:budget`(서브에이전트 예산 브리프). 둘 다 **되돌리기 어려운 행위**에 붙고, `Edit`·`Write`·`Stop` 에는 코어 훅이 없다.
  전 프로파일에서 동일하게 2그룹이다(**minimal (2훅)** / **standard (2훅)** / **strict (2훅)**) — 프로파일은 그룹 수가 아니라 **dispatcher 내부 서브훅의 강도**만 바꾼다.
  - **판정 기준: 산출물에 독자가 있는가, 그리고 커맨드·rule 로 커버되지 않는가.** 이 둘을 못 넘기면 코어가 아니다.
  - `post:bash:dispatcher` 는 2026-08-15 내려갔다. 서브훅 4개(`command-log-audit`·`command-log-cost`·`pr-created`·`build-complete`)가 전부 standard 이상이라 — 앞의 둘은 `profiles` 미지정이어서 기본값 `standard,strict` 로 떨어진다 — **minimal 에서는 Bash 호출마다 node 를 띄워 아무 일도 하지 않았다.** 산출물 `bash-commands.log` 도 읽는 코드가 없다.
  - **라이프사이클 4종은 2026-08-16 내려갔다**(`session:start`·`stop:session-end`·`stop:cost-tracker`·`session:end:marker`). 각각의 근거:
    - `stop:cost-tracker` — `metrics/costs.jsonl` 의 유일한 독자가 `harness-metrics-bridge.js` 인데 같은 날 standard+ 로 내려갔다. minimal 에선 **매 응답마다 아무도 읽지 않는 무한증가(rotation 없음) 파일을 썼다.** `/cost-report` 는 전혀 다른 외부 DB(`~/.claude-cost-tracker/usage.db`)를 본다.
    - `stop:session-end` — `session-data/*.tmp` 자동 저장. **`/save-session` 커맨드가 같은 파일을 직접 쓴다**(커맨드가 커버). 세션 재개 1순위는 Orca 워크트리 / 네이티브 `/resume` 다.
    - `session:start` — minimal 주입 실적은 `Project type: {...}` 한 줄(레포 보면 아는 정보)뿐. 나머지 주입분은 observer instinct·learned-skill 요약인데 **observer 를 시작하는 코드가 하네스에 없다.** 게이팅은 `session-start-bootstrap.js` 안의 CSV 로 한다(부트스트랩이 이미 `run-with-flags` 를 부르므로 hooks.json 에서 한 번 더 감싸면 이중 래핑이다).
    - `session:end:marker` — `session:start` 가 쓴 observer lease 를 지우는 짝. 쌍으로만 의미가 있어 함께 내렸다.
- `hooks/hooks-optional.json` — **옵트인 28그룹.** 품질 게이트·차단형·관찰 훅 전부(quality-gate, design-quality-check, console-warn, governance-capture, mcp-health-check, context-monitor, metrics-bridge, activity-tracker, format-typecheck, run-tests, command-registry, gateguard-fact-force, config-protection, doc-file-warning, suggest-compact, pre-compact, evaluate-session, capture-lessons, desktop-notify 등). 필요한 프로젝트에서만 `node scripts/install/merge-hooks.js --optional` 로 추가한다. 머지는 **선언적**이라 `--optional` 없이 재실행하면 이 스택은 다시 걷힌다.
- **글로벌 기본은 `HARNESS_HOOK_PROFILE=minimal`** — **설치가 `settings.json` 의 `env` 에 명시한다**(`merge-hooks.js` 의 `applyDefaultHookProfile`). `hook-flags.js` 의 코드 기본값도 같은 값이지만 암묵적 기본값은 사용자가 볼 수도 바꿀 수도 없어서, 적어두는 것이 요점이다. 이미 값이 있으면 건드리지 않고(standard/strict 는 사용자의 결정), 유효하지 않은 값은 고치지 않고 알린다. `--uninstall` 은 우리가 심은 `minimal` 만 걷고 올려둔 값은 남긴다. `run-with-flags.js <id> <script> <profilesCsv>` 게이팅과 `HARNESS_DISABLED_HOOKS` CSV 는 그대로다.
  - **프로파일의 뜻**: `minimal` = **최소한의 가드레일만**(되돌리기 어려운 행위 차단 + 라이프사이클) / `standard` = + 품질·관찰·거버넌스 **경고** / `strict` = + **차단형**. 그래서 `minimal` 에 훅을 추가하는 변경은 정의 위반이다 — 판단이 필요하면 커맨드로 부르지, 훅으로 상시 끼워넣지 않는다.
  - **옵트인 스택은 `standard` 이상 전용이다.** optional 28그룹 중 minimal 에서 켜지는 것은 **0개**여야 한다(2026-08-16 기준: `standard,strict` 24 · `strict` 3 · 게이트 없음 1 = dispatcher 내부 게이팅). 과거 `post:harness-metrics-bridge`·`stop:evaluate-session`·`stop:capture-lessons` 셋이 `minimal` 을 포함해, minimal 인데도 켜졌다 — 특히 metrics-bridge 는 matcher `*` 이고 유일한 소비자(`post:harness-context-monitor`)가 `standard` 이상이라 **매 툴 호출마다 아무도 읽지 않는 파일을 썼다**. `--optional` 을 minimal 에 머지하면 `merge-hooks.js` 가 경고한다.
  - `pre:bash:dispatcher` 서브훅: **minimal 부터** `block-no-verify`·`git-push-reminder`(기본 브랜치 직행 — minimal/standard 경고, strict 차단) / **standard** 부터 `auto-tmux-dev` / **strict 전용** `tmux-reminder`·`commit-quality`·`gateguard-fact-force`.
  - `gateguard-fact-force` 는 **strict 전용이다.** 과거 dispatcher 쪽 사본만 `standard,strict` 로 새어 있어서 standard 프로파일에서 매 세션 첫 Bash 가 차단됐다 — 문서가 strict 라고 적어둔 것과 코드가 어긋난 사례이므로, 프로파일 CSV 를 바꿀 때는 hooks.json 과 dispatcher 양쪽을 함께 본다.
  - `subagent:budget` 은 SubagentStart 훅으로, 서브에이전트가 SessionStart 컨텍스트(= ponytail 규율)를 상속하지 않는 구멍을 메운다 — Agent 호출마다 예산 브리프를 주입해 과탐색·장문 보고를 억제한다. 브리프는 기본형(구현·탐색)과 **리뷰 변형**(`agent_type` 이 review/audit/detector/scorer/critic/analyzer 매칭) 두 종류이고, 리뷰 변형은 탐색 규율만 유지하고 **findings 개수는 압박하지 않는다**. ponytail 이 `off` 면 주입하지 않고, `HARNESS_SUBAGENT_BUDGET=off` 로 개별 차단한다.
- **`settings.json` 의 `id`·`description` 은 살아남지 못한다.** Claude Code 가 그 파일을 재작성할 때(설정 변경·권한 규칙 추가 등) 스키마에 없는 키를 떨어뜨린다 — 2026-08-16 실측: 머지 직후 있던 `id` 6개가 이후 전부 사라졌고, 그때 `settings.json` 의 mtime 은 머지 시각보다 뒤였으며 top-level 에 `ultracode`·`enableWorkflows` 같은 Claude Code 자체 키가 들어와 있었다. 그래서 소유권 판정을 **실행하는 스크립트**(`runsHarnessScript`) 기준으로 두었고 `id` 는 보고용일 뿐이다. 부작용: `--dry-run` 이 매번 "swept N + added N" 으로 보인다(결과는 정확하다 — 스크립트 대조로 검증).
- `scripts/install/merge-hooks.js` — the underlying merger. **머지는 선언적이다**: 실행 후 settings.json 의 하네스 소유분은 머지한 집합과 정확히 일치하고, 그 밖의 하네스 훅은 전부 걷힌다 — hooks.json 에서 은퇴한 id, 그리고 **옛 설치가 남긴 `id` 없는 그룹**까지(`isLegacyHarnessGroup`: command 에 하네스 스크립트 경로 마커가 있으면 하네스 소유로 판정). 서드파티 훅(예: `~/.orca/agent-hooks/claude-hook.sh` 를 부르는 Orca 훅 11개)은 마커가 없어 보존된다. `--dry-run` 으로 sweep 목록을 먼저 확인할 것. Tests: `tests/scripts/install/merge-hooks.test.js`.
- `hooks/prompt-pack.json` — two reference-only prompts (`ref:pre-write-guard`, `ref:review-on-stop`). Not runnable; see `hooks/README-prompt-pack.md` for what they overlap with and how to wire them up if needed.

## Loop Control (에이전트 루프)

자율 루프(관찰→계획→도구실행→결과확인→재계획)를 돌릴 때 필요한 제어는 **상시 훅이 아니라 루프를 돌릴 때 켠다.** 코어 훅이 되돌리기 어려운 행위만 막는 것과 같은 이유다 — 루프 계측은 루프를 돌리는 동안에만 값을 하고, 평시에는 매 툴 호출에 끼어드는 노이즈다.

```bash
node scripts/install/merge-hooks.js --optional   # 루프 시작 전: 계측 켜기
node scripts/install/merge-hooks.js              # 끝난 뒤: 코어만 남기기(선언적이라 자동 정리)
```

네 가지 실패 모드와 담당:

| 실패 모드 | 담당 |
|-----------|------|
| **무한 루프** | `post:harness-context-monitor`(optional) 의 `detectLoop` — 동일 서명 3회면 경고. 서명은 `hashToolCall` = **도구명 + 입력 전체**의 해시다(일부 필드만 고르면 빠뜨린 필드가 곧 오탐이 된다 — 한 파일 연속 편집, offset 페이징, `replace_all` 토글이 모두 "같은 호출"로 뭉쳤던 전례). 여기에 `/loop-start` 의 max_turns·명시적 종료 조건. |
| **컨텍스트 폭증** | `pre:compact`·`pre:edit-write:suggest-compact`(optional), `session:start` 주입 캡(`HARNESS_SESSION_START_MAX_CHARS`, 기본 8000자), `subagent:budget`(서브에이전트의 과탐색·장문 보고 억제). 잔량 **경고**는 없다 — 컨텍스트 퍼센트는 statusLine 훅만 볼 수 있고 그 슬롯은 claude-dashboard 가 쓴다(대신 사용자가 눈으로 본다). |
| **동일 실수 반복** | `stop:capture-lessons`(optional) 가 반복 교정 신호를 감지 → `/lessons add` → `skills/lessons-learned`. 안정된 교훈은 `/lessons promote`. 단 rules 는 상시 로드 예산이므로 불변 제약만 올린다. |
| **비용 폭증** | `stop:cost-tracker`(코어) + `/cost-report`. 그리고 파이프라인을 단계별로 태깅한다 — detect→fix→judge 는 `sonnet`→`sonnet`→`opus`. |

**경계**: 한 세션 안의 read-edit-test 반복은 Claude Code + 위 optional 스택이 담당한다. 그 밖의 다중 에이전트 실행(팬아웃, 블로킹 ask/reply, task DAG, worker_done 대기, 워크트리 격리)은 전부 Orca `orchestration` 이 담당한다 — 둘을 겹쳐 돌리지 않는다.

**계측이 틀리면 없는 것보다 나쁘다.** 오탐이 잦은 경고는 읽는 사람을 길들여 무시하게 만들고, 그러면 진짜 루프도 함께 묻힌다. 루프 감지 로직을 바꿀 때는 `tests/hooks/loop-detection.test.js` 의 "정상 진행은 루프가 아니다" 케이스를 먼저 통과시킨다.

## Orca Integration

이 하네스는 **Orca 안에서 돌아간다.** Orca 는 자체 훅(`~/.orca/agent-hooks/claude-hook.sh`)을 `~/.claude/settings.json` 의 **11개 이벤트**에 심고(전부 `matcher: "*"`; Orca 밖에서는 환경변수가 없어 즉시 exit 하는 no-op), 자체 스킬 5종을 `~/.agents/skills/` 에서 링크한다(상시 ~878 tok).

지켜야 할 것 둘:

- **`settings.json` 의 `hooks` 를 손으로 편집하지 않는다.** `scripts/install/merge-hooks.js` 를 쓴다. 머저의 소유권 판정은 "우리가 배포하는 스크립트를 우리 런처로 부르는가" 하나이므로 Orca 훅은 자동 보존된다 — 머저는 Orca 를 알지 못하고 알 필요도 없다.
- **겹치는 기능은 한쪽만 쓴다.** 워크트리 격리·핸드오프 = `orca-cli`, statusLine = claude-dashboard, 세션 재개 = 네이티브 `/resume`. 다중 에이전트 오케스트레이션은 아래 2분기다.

### 오케스트레이션은 Orca 우선, 없으면 ultracode

| 환경 | 팬아웃·task DAG·coordinator 루프 |
|---|---|
| **Orca 안** (기본) | **Orca `orchestration` 에 일임.** `Workflow` 툴·`ultracode` 는 쓰지 않는다 |
| **Orca 밖** | **`ultracode` + `Workflow` 가 유일한 경로** — 그때는 쓴다 |

판정은 환경변수로 한다: `ORCA_AGENT_HOOK_PORT`·`ORCA_AGENT_HOOK_TOKEN`·`ORCA_PANE_KEY`
중 하나라도 비어 있으면 Orca 밖이다(Orca 훅이 no-op 으로 빠지는 것과 같은 조건).
`orchestration` 스킬이 스킬 목록에 없는 것도 같은 신호다.

Orca 안에서 `Workflow` 를 쓰지 않는 이유는 능력이 아니라 **상태의 소유자**다. 여러
에이전트가 도는 동안 워크트리·터미널·블로킹 ask/reply·worker_done 대기를 실제로 들고
있는 쪽이 Orca 이고, 같은 작업 집합에 조율자가 둘이면 경쟁한다. Orca 밖에서는 그 상태를
아무도 안 들고 있으므로 경쟁 상대가 없다 — 금지의 근거가 사라지니 규칙도 뒤집힌다.
단 `Workflow` 는 **컨텍스트 내 팬아웃까지만** 가능하다(워크트리 격리·블로킹 ask/reply는
못 한다). 대체가 아니라 축소된 대안이다.

한 번에 한 서브에이전트를 부르는 `Agent` 호출은 어느 쪽에서든 오케스트레이션이 아니라
그냥 도구 호출이라 그대로 쓴다. 그리고 **추론을 더 원하는 것**과 **일을 쪼개는 것**은
다른 축이다 — 전자는 팬아웃이 아니라 effort 를 올린다(`--effort max` / `/effort`).

하네스가 담당하는 것은 셋뿐이다: **① 취향·언어 규칙(`rules/`) ② 도메인 스킬(`skills/`) ③ 되돌리기 어려운 행위 차단(코어 훅 2개)**.

전체 의존 지점·역할 분리 표·점검 명령·Orca 없이 쓸 때 무엇이 달라지는지는 **`docs/orca-dependencies.md`**.

## Self-evolution (학습 메커니즘)

두 층위로 무게가 다르다. 가벼운 것부터 무거운 것 순:

- **lessons-learned** (경량, 한 줄 교훈 로그) — `skills/lessons-learned/SKILL.md` (manual inclusion) 에 반복 교정 교훈을 한 줄씩 누적. `scripts/hooks/capture-lessons.js` (Stop hook, id `stop:capture-lessons`) 가 transcript 에서 반복 교정 신호(사용자 정정 / 빌드·테스트 실패 / 리뷰 지적)를 휴리스틱 감지하면 `systemMessage` 로 "`/lessons add` 권장" 한 줄 알림을 띄운다 — 파일은 사용자 확인 후 `/lessons` 로만 기록(자동 편집 안 함). Stop 이벤트는 `additionalContext` 를 허용하지 않으므로 systemMessage 로만 알린다. kiro-with-harness 의 Kiro `askAgent` hook 을 재해석한 것. 테스트: `tests/hooks/capture-lessons.test.js`.
- **`/learn`** (중간, 패턴→skill) — 비자명한 문제 해결을 재사용 skill 파일 1개로 추출. 추출 후 품질 게이트(체크리스트 + Save/Improve/Absorb/Drop 판정)와 저장 위치(Global vs Project) 결정을 거친다. (구 `/learn-eval` 흡수됨 — 2026-06 통합.)

**자동 층위(instinct)는 없다.** 상시 관찰로 instinct 를 누적하고 `/promote`·`/evolve` 로
승격하던 continuous-learning-v2 스택은 산출물이 0이라 `627dd9f` 에서 제거됐다(-13,062줄).
자동 관찰을 다시 붙이려면 그 커밋을 되살리는 것이 아니라, 관찰 결과가 실제로 쓰이는
경로(`/lessons` → `rules/`)부터 확인하고 시작한다.

안정적으로 반복되는 lesson 은 `/lessons promote` 로 `rules/` steering 규칙으로 올린다.

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
