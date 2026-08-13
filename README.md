# my_harness_for_claude_code

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933.svg)
![Python](https://img.shields.io/badge/Python-3.12-3776AB.svg)
![ESLint](https://img.shields.io/badge/ESLint-9.x-4B32C3.svg)
![Tests](https://img.shields.io/badge/tests-1586%20passing-brightgreen.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/teinam)

개인 워크로드(Python / Rust / TypeScript / 데이터베이스 / 클라우드 / 글쓰기)에 맞춰 큐레이션한 Claude Code 하네스 — agents, skills, slash commands, hooks, rules, MCP 설정을 한곳에 모았습니다.

특히 **AWS Bedrock 기반 개발에 최적화**되어 있습니다. Bedrock Converse API / 모델 호출(Claude·Nova·Llama·Mistral·Titan) / Agents·Knowledge Bases / Guardrails / prompt caching / 크로스 리전 inference profile / 비용 추적을 다루는 `aws-bedrock` 스킬을 중심으로, `aws-cloud`(IAM·네트워킹·비용 가드레일), `cost-aware-llm-pipeline`(토큰·비용 최적화), `claude-api`(Anthropic SDK 연계)가 함께 묶여 AWS 경계 안에서의 LLM 개발을 일관되게 지원합니다.

플러그인 부트스트랩 없이 단독으로 동작하며, 이 저장소를 `~/.claude/`에 심볼릭 링크로 설치해 곧바로 사용합니다. 2026-05-22에 두 개의 출처에서 모은 자료를 정리·재배선한 결과물입니다.

## 한눈에 보기

| 디렉터리 | 항목 수 | 설명 |
|---|---:|---|
| `agents/` | 48 | 위임 가능한 서브에이전트 (planner, reviewers, build-resolvers, devops, translator-docs, deep-researcher, tech-writer 등) |
| `commands/` | 37 | 슬래시 커맨드 (frontmatter 기반 markdown) |
| `skills/` | 121 | 도메인 지식·워크플로 정의 (DB / FastAPI / Obsidian 플러그인 / AI / TUI 에이전트 / 문서 생성(PDF·DOCX·XLSX) / 다이어그램(archify·drawio) / 글쓰기 / 소셜 콘텐츠 / 랜딩페이지 디자인 등) |
| `rules/` | 37 | common 레이어(모델 라우팅 정책 포함) + 언어별(typescript / python / rust / web) |
| `hooks/` | 29 | 이벤트 기반 훅 매처 (실행 스크립트 45종) |
| `mcp-configs/` | — | MCP 서버 설정 샘플 |
| `scripts/` | — | 훅 핸들러 / 설치 / CI 검증 / 세션 관리 도구 |
| `tests/` | — | 1509개 테스트 (검증기 + 라이브러리 + 훅 + 통합) |
| `docs/` | — | 장문 가이드(글쓰기 / 보안)와 steering 규칙 |

상세 인덱스는 `docs/COMMAND-REGISTRY.json`에 자동 생성되어 있습니다.

## 대상 워크로드

Python(데이터 분석 / FastAPI), Rust, React + Vite + TypeScript, Obsidian 플러그인, RDBMS / MongoDB / DuckDB / DynamoDB, AWS + Bedrock, Hugging Face 기반 실시간 STT, Node.js, 창작·기술 블로깅·PPT 작성.


## 모델 라우팅

에이전트마다 작업 성격에 맞는 모델 티어를 `model:` frontmatter에 **별칭**(`opus` / `sonnet` / `haiku`)으로 선언합니다. 버전 ID를 직접 박지 않으므로, 모델이 업그레이드돼도 대규모 재태깅 없이 최신 라인업을 따라갑니다.

| 별칭 | 현재 매핑 | 성격 | 대표 에이전트 |
|---|---|---|---|
| `opus` | **Opus 5** | 최상위 티어 — 답의 형태가 미정인 일: 설계·미지의 원인 진단·사실 보존 판정·미분류 패턴 발견·보안/적대적 리뷰. 더 필요하면 티어가 아니라 effort(`high`→`xhigh`→`max`)를 올린다. refusal·web fetch·Priority Tier 필요 시 Opus 4.8 폴백 | `architect`, `planner`, `deep-researcher`, `security-reviewer`, fidelity 감사관, 최종 리뷰어 |
| `sonnet` | **Sonnet 5** | 최고의 코딩 모델 — 기준이 이미 주어진 일: 구현·리팩터·PR 리뷰·rubric 대조 스캔·리포트대로 윤문·원인이 확정된 수리(코딩의 ~90%) | 언어별 리뷰어, `code-*`, `devops`, `tdd-guide`, `refactor-cleaner`, 탐지기, 작성가/윤문가 |
| `haiku` | **Haiku 4.5** | Sonnet의 ~90% 성능을 ~3× 저렴하게 — 기계적 편집·검색·문서 스캐폴딩 | `doc-updater`, `docs-lookup`, 고빈도 워커 |

**티어를 가르는 질문은 "박스가 열려 있는가"입니다.** 추론 깊이는 답의 형태가 미정일 때만 값을 합니다. taxonomy·rubric 이 이미 주어졌거나 원인과 해결이 확정된 상태에서 실행만 하는 일은 탐색 공간이 없으므로 Sonnet 5 로 충분합니다 — 이게 함대에서 가장 흔한 낭비였습니다. 반대로 설계·미지의 원인 진단·의미 보존 판정처럼 답을 스스로 만들어야 하는 일은 Opus 5. Opus 5가 천장이므로 그 위로는 **티어가 아니라 effort**(`high`→`xhigh`→`max`)를 올리고, 그다음은 위가 아니라 **옆(Codex, 다른 모델 패밀리)**으로 갑니다.

함정 둘: ① "중요한 파이프라인이니 전부 opus" — 중요도는 추론 깊이가 아닙니다(40패턴 taxonomy 대조는 lookup). ② "수리니까 sonnet" — 원인이 *확정된 뒤에만* 참입니다(원인 찾기는 열린 박스). **파이프라인이 아니라 단계별로 태깅**합니다: detect→fix→judge 는 `sonnet`→`sonnet`→`opus`. 두 축이 충돌하면(닫힌 박스인데 미스 비용이 큼) 평균이 아니라 **틀렸을 때의 최악 비용**이 이깁니다 (머지를 게이팅하는 리뷰어는 대부분 쉬워도 `opus`).

권위 있는 정책(작업 표·에이전트 클래스 맵·오케스트레이션·Codex 핸드오프)은 `docs/rules-reference/model-routing.md`에 있고, `/model-route` 커맨드와 `performance.md`가 이를 참조합니다. 다른 모델 패밀리의 독립적 세컨드 오피니언이 필요하면 codex 플러그인(`codex:rescue` 스킬/`codex:codex-rescue` 에이전트)으로 OpenAI Codex CLI를 호출합니다.

## 핵심 에이전트

- `rdbms-data-modeler` — 대상 DB(MySQL / Aurora MySQL / Postgres / Aurora Postgres)를 먼저 확정한 뒤 매칭되는 가이드라인 스킬로 라우팅한 후에야 DDL 작성
- `article-writer`, `content-creator` — 장문 글 / 플랫폼별 소셜 콘텐츠 워크플로
- `devops` — AWS / Docker / Terraform / K8s, 변경 전 plan·dry-run 우선
- `translator-docs` — 한국어 / 영어 양방향 번역 + README·API 문서
- `deep-researcher` — 출처 인용을 갖춘 멀티 소스 웹 리서치
- `code-reviewer`, `python-reviewer`, `typescript-reviewer`, `rust-reviewer`, `architect` — 길이가 다른 리뷰어/아키텍트 페어

## 핵심 스킬

- **DB**: `postgres-guideline`, `mysql-guideline`, `mongodb-guideline`, `dynamodb-guideline` — 스키마 / 인덱스 / 파티셔닝 / 샤딩 / 커넥션
- **백엔드**: `fastapi-backend-best-practices`(7개 하위 영역), `python-patterns`, `rust-patterns`
- **프론트엔드**: `obsidian-plugin-develop`(TypeScript + i18n + Chromium + 릴리스 체크리스트), `vite-patterns`, `frontend-patterns`, `frontend-design`(anthropics/skills — 심미적 방향성·타이포그래피)
- **랜딩페이지 디자인 (Supanova)**: `taste-skill`, `redesign-skill`, `soft-skill`, `output-skill` — 한글 우선 Standalone HTML + Tailwind CDN 랜딩페이지 생성/리디자인 엔진(origin: supanova-design-skill-main, based on Leonxlnx/taste-skill). `frontend` 워크로드.
- **SEO/GEO/AEO**: `seo-geo-aeo`(origin: SNLabat/SEO-GEO-AEO-Skill) — SEO·생성형 검색엔진(GEO)·답변엔진(AEO) 3축 웹사이트 감사, Word/PDF 리포트. 기존 `seo` 스킬과 별개, `frontend` 워크로드.
- **AI / 클라우드**: `claude-api`, `aws-bedrock`, `aws-cloud`, `aws-finops`(FinOps Foundation Framework + AWS 비용관리), `realtime-stt-huggingface`, `cost-aware-llm-pipeline`, `ai-regression-testing`
- **데이터 분석**: `analysis-methodology`(분석 방법론·판단층 — 프레이밍→기법선택→검증→결정), `python-data-analysis`(pandas/polars/duckdb 도구), `duckdb-patterns`
- **Codex (교차 모델)**: codex 플러그인(openai/codex-plugin-cc, `docs/plugin.md`) — 다른 모델 패밀리의 독립 리뷰·tie-break·대규모 기계적 편집 오프로드. 하네스 자체 스킬은 플러그인과 중복이라 제거.
- **문서 생성**: `pdf`(pypdf·reportlab·weasyprint), `docx`(python-docx·docxtpl), `xlsx`(openpyxl·pandas) — 프로그래밍 방식 PDF/Word/Excel 산출. 슬라이드는 `ppt-authoring`·`frontend-slides`. `core` 워크로드.
- **글쓰기**: `markdown-writing`, `article-writing`, `brand-voice`, `crosspost`, `frontend-slides`, `tech-blogging`, `creative-writing`, `ppt-authoring`, `tech-writer`(한/영 기술 문서 작성·윤문 오케스트레이터, 5개 전용 에이전트)
- **소셜 콘텐츠 (LinkedIn 개인 브랜딩)**: 17종, origin: charlie947/social-media-skills. `writing`과 분리된 별도 워크로드이며, 파이프라인 단계별 3그룹으로 나뉩니다 — **`social-voice`**(`voice-builder`, `newsletter-voice`, `profile-optimizer`) → **`social-content`**(`post-writer`, `post-formatter`, `post-scorer`, `hook-generator`, `content-matrix`, `niche-research`, `pinned-comment`, `reels-scripting`, `analytics-dashboard`) → **`social-visual`**(`graphic-designer`, `gemini-carousel`, `gemini-infographic`, `quote-post`, `youtube-thumbnail`). 설치 시 글쓰기 › 소셜 상세 tier(`--writing-social=`)로 골라 담습니다.
- **한글 AI 티 제거**: `humanize-korean` — AI가 쓴 한글 글의 번역투·관용구·기계적 병렬·피동태 남용 등 10대 카테고리 패턴을 탐지·윤문(`/humanize`·`/humanize-redo`, Fast/strict 모드). epoko77-ai/im-not-ai 통합.

## AWS Bedrock 워크플로 (최적화 포인트)

이 하네스는 "같은 모델을 AWS 계정·IAM·과금 경계 안에서" 쓰는 시나리오를 1급으로 다룹니다.

- **`aws-bedrock` 스킬** — Converse API, `bedrock-runtime` 모델 호출(Claude / Nova / Llama / Mistral / Cohere / Titan), Bedrock Agents·Knowledge Bases(관리형 RAG), Guardrails(PII·금칙어·문맥 필터), Titan/Cohere 임베딩, prompt caching, provisioned throughput, 크로스 리전 inference profile. Bedrock vs 직접 provider SDK 선택 기준표 포함.
- **`aws-cloud` 스킬** — IAM 최소 권한, VPC 엔드포인트·PrivateLink, 리전 레지던시, CloudWatch / CloudTrail 관측, 비용 가드레일.
- **`aws-finops` 스킬** — FinOps Foundation Framework(Inform/Optimize/Operate) 기반 비용관리. Cost Explorer·CUR·Budgets·Anomaly Detection, 태깅·Cost Categories, Savings Plans vs RI, Compute Optimizer, 단위경제학, showback/chargeback. `finops` 워크로드.
- **`cost-aware-llm-pipeline` 스킬** — 토큰·비용 추적과 모델 라우팅으로 Bedrock 호출 비용을 통제.
- **`claude-api` 스킬** — Bedrock과 Anthropic 직접 SDK를 함께 쓸 때의 스트리밍·tool use·캐싱 패턴.
- **연계 에이전트** — `devops`(plan·dry-run 우선의 AWS 변경), `security-reviewer`(IAM·자격증명·SDK 호출 경로 점검), `architect`(추론 파이프라인·리트라이/백오프 설계).

워크로드 설치 시 `--category=ai,cloud` (또는 `--workload=ai,cloud`) 를 고르면 위 자산만 추려서 들어옵니다. 관련 트리거 키워드: `bedrock-runtime`, `Converse`, `InvokeModel`, `BedrockAgent`, `retrieve_and_generate`, `guardrail`, `inference profile`, `provisioned throughput`.

## 설치

설치는 **도메인 축 6개 톱레벨 카테고리**(**개발 / 클라우드·인프라 / AI / 데이터 / 리서치·리포트 / 글쓰기**) 로 시작해서 카테고리별 중분류(sub-옵션: 언어·엔진·영역) 를 다중 선택하는 방식입니다. 자산이 많은 중분류(writing.social)만 상세 3그룹으로 한 단계 더 드릴다운됩니다. 선택된 sub-옵션이 워크로드 키로 변환되고, 그 키와 교집합인 자산만 `~/.claude/` 에 파일별 심볼릭 링크로 들어갑니다. 저장소에서 수정한 내용은 즉시 반영됩니다.

### 대화형 메뉴

```bash
./install.sh                                    # 3단계 방향키 체크박스 메뉴를 띄움
```

방향키 체크박스로 고릅니다: `↑`/`↓` 이동, `space` 토글, `a` 전체, `enter` 확정. 흐름은 3단계입니다 — **대분류(카테고리) → 중분류(sub-옵션) → 상세(있을 때만)**. 상세 tier 는 자산이 많은 카테고리(**글쓰기 › 소셜** = 보이스/콘텐츠/시각)에만 나타나며, 나머지는 중분류에서 바로 끝납니다. 각 단계에서 아무것도 안 고르면 그 단계 전체가 선택됩니다.

설치는 먼저 **글로벌 baseline 상태**(`absent`/`outdated`/`current`)를 검사해 알려줍니다 — 매니페스트(`~/.claude/_harness-manifest.json`)에 기록된 버전을 저장소 `VERSION` 과 비교하며, 없거나 오래됐으면 새로 깔고 최신이면 선택 워크로드만 반영합니다.

### CLI 플래그 (비대화형)

대화형 없이 같은 결과를 얻으려면:

```bash
./install.sh --all                              # 모든 카테고리 · 모든 sub-옵션
./install.sh --dev=python                       # FastAPI 등 파이썬 백엔드만
./install.sh --dev=frontend,python              # 프론트 + 파이썬 백엔드
./install.sh --cloud=infra,finops               # AWS 인프라·컨테이너 + 비용
./install.sh --data=duckdb,python-data          # DuckDB + 파이썬 분석
./install.sh --data=mysql                       # MySQL 가이드라인만 (Postgres 제외)
./install.sh --dev=obsidian                     # Obsidian 플러그인 + 프론트
./install.sh --research=websearch               # 웹 검색·자료조사 (exa·brave·deep-researcher)
./install.sh --research=report                  # 기술 리포트 작성·검증 (tech-writer)
./install.sh --writing=general                  # 글쓰기 — 일반 글쓰기만 (LinkedIn 콘텐츠 제외)
./install.sh --writing=social                   # 글쓰기 — 소셜 콘텐츠(LinkedIn) 전체
./install.sh --writing-social=voice,content     # 소셜 — 보이스 + 콘텐츠 제작만 (시각 자산 제외)
```

| 카테고리 | sub-옵션(중분류) | 상세 (3단계) |
|---|---|---|
| `cloud` | `infra`(→ `cloud`+`devops`), `finops`, `integration` | — |
| `ai` | `llm`(→ `ai`) | — |
| `data` | `duckdb`, `python-data`, `aws-analytics`, `mysql`, `postgres`, `mongodb`, `dynamodb`, `aws-rds` | — |
| `research` | `websearch`(→ `research`), `report` | — |
| `writing` | `general`(→ `writing`), `social` | `social`: `voice` / `content` / `visual` (`--writing-social=`) |

> sub-옵션 플래그(`--dev=...` 등)를 명시하면 해당 카테고리는 자동으로 활성화되므로 `--category=` 는 생략 가능합니다. 상세 플래그(`--writing-social=`)도 마찬가지입니다.

### 그 외 옵션

```bash
./install.sh --dry-run                          # 변경 없이 미리 보기
./install.sh --uninstall                        # 모두 제거 (선택과 무관하게 전체 정리)
./install.sh --force                            # 기존 파일 덮어쓰기
./install.sh --with-hooks                       # 묻지 않고 ~/.claude/settings.json 에 훅 병합
./install.sh --with-hooks --dry-run             # 병합 결과 미리 보기
./install.sh --with-hooks --uninstall           # 하네스가 추가한 훅만 정리 (사용자 훅 보존)
./install.sh --with-mcp                          # 묻지 않고 MCP proxy 기동 (docker compose up -d)
./install.sh --no-extras                        # 워크로드 외(hooks·mcp) 프롬프트 건너뛰기
```

워크로드(agent·command·skill·rule)는 선택에 따라 설치되고, **워크로드 밖인
hooks·mcp 는 설치 후 대화형(TTY)일 때 추가 설치할지 물어봅니다.** `--with-hooks`
를 주면 hooks 를 묻지 않고 바로 병합하고, `--with-mcp` 를 주면 MCP proxy 를 묻지 않고
바로 기동합니다(둘 다 비대화형에서도 동작). `--no-extras` 또는 비대화형(CI·파이프)
이면 프롬프트 없이 워크로드만 설치합니다.

저수준 워크로드 키를 직접 다루고 싶으면 `--workload=python-backend,mysql` / `--skip-workload=ai,nodejs` 도 그대로 사용할 수 있습니다 (메뉴 플래그보다 우선).

### Windows

```powershell
.\install.ps1                                                         # 대화형 (Windows Terminal)
.\install.ps1 -All
.\install.ps1 -Dev frontend,python
.\install.ps1 -Data mysql,postgres -WithHooks
.\install.ps1 -Cloud infra,finops                                     # AWS 인프라·컨테이너 + 비용
.\install.ps1 -WithMcp                                                # 묻지 않고 MCP proxy 기동 (docker compose up -d)
.\install.ps1 -WritingSocial voice,content                            # 소셜 상세 — 보이스 + 콘텐츠
```

Windows 10+ + Developer Mode 또는 관리자 권한이 필요합니다 (심볼릭 링크).

### 자산 분류 방식

각 자산의 그룹은 frontmatter 의 `workloads:` 키로 결정됩니다 (`workloads: [python-backend]`, `workloads: [obsidian, frontend]` 등). 키가 없거나 frontmatter 자체가 없는 파일은 `scripts/install/workloads.js` 의 휴리스틱으로 폴백 분류됩니다 (rules/ 는 부모 폴더 기준). 일괄 재태깅은 `node scripts/install/tag-assets.js --dry-run` 으로 미리보고 `--apply` 로 적용합니다.

전체 워크로드 키 목록: `core, python-backend, python-data, rust, nodejs, cloud, ai, frontend, obsidian, plugin-chrome, plugin-claude, mysql, postgres, mongodb, dynamodb, writing, social-voice, social-content, social-visual` (그 외 메뉴 비노출·수동 전용 키 `lab`).

훅 병합은 `id`(`pre:bash:dispatcher`, `stop:cost-tracker` 등) 기준으로 멱등하게 동작하며, 변경 전 `settings.json.bak.<ISO>` 백업을 남깁니다. 사용자가 수동으로 추가한 훅 항목은 그대로 보존됩니다.

`hooks/prompt-pack.json`은 실행되지 않는 참고용 프롬프트 모음으로, `hooks/README-prompt-pack.md`를 참고해 세션이나 `CLAUDE.md`에 직접 붙여 사용합니다.

## 동반 플러그인 (하네스와 같이 설치)

설치 스크립트는 플러그인을 건드리지 않습니다 — 아래는 손으로 설치하며, 명령 전체는 `docs/plugin.md`.
6종 합계 상시 컨텍스트 비용은 스킬 `description` 기준 약 3.4k tok 입니다.

| 플러그인 | 마켓플레이스 | 역할 (하네스와의 관계) |
|---|---|---|
| `superpowers` | anthropics/claude-plugins-official | TDD·검증·디버깅·플랜 스킬 — 하네스 자체 `tdd-workflow`·`verification-loop` 스킬은 중복이라 제거됨 |
| `ponytail` | DietrichGebert/ponytail | 최소주의 코딩 모드 |
| `codex` | openai/codex-plugin-cc | 교차 모델 세컨드 오피니언 — 하네스 자체 `codex-cli` 스킬은 중복이라 제거됨 |
| `ui-ux-pro-max` | nextlevelbuilder/ui-ux-pro-max-skill | 디자인 시스템·UI 스타일링 — 하네스 자체 `design-system` 스킬은 중복이라 제거됨 |
| `claude-dashboard` | uppinote20/claude-dashboard | **statusLine 담당** — 하네스 `harness-statusline.js`는 등록되지 않는 죽은 경로라 2026-08 제거. 비용 DB(`cost-tracking`)는 SQLite 기반이라 별개 유지 |
| `obsidian` | kepano/obsidian-skills | Obsidian 문서 포맷 (project scope 설치) |

**설치하지 말 것**

- 하네스 스킬과 이중 노출 (2026-07-26 제거, 하네스 쪽이 SSOT): `humanize-korean@im-not-ai`(하네스 `skills/humanize-korean`이 v1.6.1로 더 최신), `frontend-design@claude-plugins-official`(하네스 `skills/frontend-design`과 동일 출처 중복).
- 워크로드와 무관 (2026-08-14 제거 — 마켓플레이스 등록·캐시까지 정리): `motion-creative@motion-mcp`(광고 크리에이티브 분석, 17스킬 395 tok — 2026-07-26에 뺐다가 재설치돼 있던 것), `scroll-world@scroll-world`(스크롤 시네마틱 랜딩 — 랜딩페이지는 하네스 `taste`/`redesign`/`soft`/`output-skill`이 담당), `rust-analyzer-lsp@claude-plugins-official`(LSP 서버, 스킬 0개라 컨텍스트 비용은 없었으나 Rust 작업에서 쓰지 않음).

## 필수 도구 버전

`.tool-versions`에 asdf / mise용 핀이 들어 있습니다.

```
nodejs 20.19.0
python 3.12.8
```

`engines.node`는 `>=18`. ESLint 9.x로 lint를 돌립니다.

## 환경 변수

`.env.example`에 정리된 변수만 사용합니다 — 실제 값은 절대 커밋하지 않습니다.

| 변수 | 용도 |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API |
| `GITHUB_PAT` | MCP github 서버 인증 (프록시 `mcp-configs/proxy/.env`) |
| `BRAVE_API_KEY` | MCP brave-search 서버 (프록시 `mcp-configs/proxy/.env`) |
| `OBSIDIAN_API_KEY` | MCP obsidian 서버 (프록시 `mcp-configs/proxy/.env`) |
| `CLAUDE_HOME` | 기본값 `~/.claude` 재정의 |
| `HARNESS_HOOK_PROFILE` | 훅 프로파일 (`minimal` / `standard` / `strict`) |
| `HARNESS_DISABLED_HOOKS` | 비활성화할 훅 ID 목록(쉼표 구분) |
| `HARNESS_STOP_TESTS` | `stop:run-tests` 자동 테스트 실행 끄기 (`off`/`0`/`false`) |
| `HARNESS_OBSERVER_DIR` | 옵저버 출력 디렉터리 |
| `HARNESS_GH_SHIM` | 테스트용 gh shim 활성화 |
| `HARNESS_SESSION_RECORDING_DIR` | 세션 녹화 출력 경로 |

훅 동작은 환경 변수만으로 조정합니다. 자세한 키 목록은 `hooks/README.md`를 참고하세요.

## MCP 서버 (proxy-first)

프록시 가능한 서버는 [tbxark/mcp-proxy](https://github.com/tbxark/mcp-proxy) 컨테이너에서 중앙 구동하고, 클라이언트는 `http://localhost:9090/<서버>/mcp` 하나만 바라봅니다. 여러 클라이언트가 같은 MCP 서버 프로세스를 중복으로 띄우지 않고, 시크릿도 프록시 한 곳에만 둡니다.

**분류 기준**: 리눅스 컨테이너에서 무인증(또는 정적 env 시크릿)으로 헤드리스 구동되면 → 프록시. 호스트 브라우저·GUI·호스트 바이너리·경로·런타임 OAuth 리다이렉트가 필요하면 → 로컬.

| 서버 | 위치 | 이유 |
|---|---|---|
| github, exa, context7, brave-search, time, fetch, drawio, token-optimizer, aws-documentation, obsidian | **proxy** | 헤드리스·정적 시크릿(또는 무인증) — 컨테이너 구동 |
| aws-iam, aws-iac, aws-eks, aws-ecs, aws-serverless, aws-lambda-tool, aws-cloudwatch, aws-prometheus, aws-support, aws-billing-cost, aws-pricing, aws-redshift, aws-knowledge | **proxy** | AWS MCP(`awslabs.*`) — SSO 자격증명(`~/.aws` 마운트) 필요. devops·finops·cloud·data-analysis 워크로드에서만 선택 |
| terraform | **proxy** | Go 바이너리라 프록시 안에서 못 돌려 별도 컨테이너(`terraform-mcp:8080`), 프록시가 내부 네트워크로 전달 |
| sentry | **local** | 런타임 OAuth 리다이렉트 — 프록시 경유 불가 |
| playwright, agent-browser | **local** | 호스트 브라우저·바이너리 필요 |
| higgsfield, zapier | **local** | 런타임 OAuth (샘플 카탈로그에만 포함) |

- **워크로드별 선택 빌드**: 설치 시 모든 MCP 를 통짜로 띄우지 않습니다. `scripts/install/build-mcp-config.js` 가 선택된 워크로드와 매칭되는 `route=proxy` 서버만 골라 `proxy/config.json` 을 빌드합니다. 범용(github·exa·context7·brave-search·time·fetch·token-optimizer)은 `core` 라 항상 포함, 나머지는 성격별 — `obsidian`(obsidian), `drawio`(frontend), 그리고 AWS MCP 는 `cloud`(Knowledge·Docs·IAM), `devops`(IaC·EKS·ECS·Serverless·Lambda·CloudWatch·Prometheus·Support), `finops`(Billing·Pricing), `data-analysis`(Redshift 등)로 나뉩니다. `terraform` 이 선택되면 compose 의 `terraform-mcp` profile 도 함께 켜집니다. 전체 목록의 SSOT 는 `mcp-configs/mcp-servers.json`(각 서버 `route`·`workloads` 표시)이고, `config.json` 은 그 산출물입니다.
- **AWS MCP 인증은 SSO 전용**: `awslabs.*` 서버는 IAM 장기 액세스 키가 아니라 SSO(IAM Identity Center)로만 인증합니다. `aws configure sso` → `aws sso login --profile <name>` 후 `.env` 의 `AWS_PROFILE` 에 프로필 이름을 넣으면, 프록시 컨테이너가 `~/.aws:/root/.aws:ro` 마운트로 SSO 캐시를 읽습니다. 세션 만료 시 `aws sso login` 재실행 후 컨테이너 재기동. 프로덕션 IAM·비용 서버는 read-only 권장.
- 프록시 에셋: `mcp-configs/proxy/` (`docker-compose.yaml` · `config.json` · `.env.example`). `install.sh` 가 설치 중 물어보고(또는 `--with-mcp` 로 바로) `docker compose up -d` 로 기동합니다. **docker 가 없으면** 설치 명령(brew 있으면 `brew install colima docker docker-compose && colima start`, 없으면 Colima/Docker Desktop 링크)과 재실행 커맨드(`./install.sh --with-mcp`)를 안내하고 넘어갑니다. 데몬 미동작·compose v2 부재도 각각 켜는 법을 안내합니다.
- 활성 클라이언트 설정: `.mcp.json` — 프록시 서버(github·exa·context7·brave-search·time·obsidian·drawio 등)는 `localhost:9090` URL, 로컬 서버(sentry·playwright)는 직접 명령.
- 복사용 카탈로그: `mcp-configs/mcp-servers.json` — 각 서버에 `route: proxy|local` 표시.
- 시크릿(`GITHUB_PAT`·`BRAVE_API_KEY`)은 프록시 한 곳에만 — `.mcp.json` 에는 URL만 남아 키가 흩어지지 않습니다. 컨텍스트 윈도 보호를 위해 동시 활성 서버는 10개 이하로 유지합니다.

### API 키 넣기

`github` · `brave-search` 만 키가 필요합니다(`exa`·`context7`·`time` 은 불필요). 두 가지 중 하나:

**1) 셸 rc (권장)** — 여러 프로젝트에서 재사용, 파일에 안 남음. `~/.zshrc` 또는 `~/.bashrc` 에:

```bash
export GITHUB_PAT="ghp_..."      # github.com/settings/tokens
export BRAVE_API_KEY="BSA_..."   # api.search.brave.com/app/keys
```

`source ~/.zshrc` 후 `install.sh`(또는 `docker compose ... up -d`)를 실행하면 프록시가 셸 env 를 읽습니다. compose 는 셸 값을 빈 `.env` 보다 우선합니다.

**2) 프록시 `.env`** — `cp mcp-configs/proxy/.env.example mcp-configs/proxy/.env` 후 값을 채웁니다. `.env` 는 커밋되지 않습니다.

키를 안 넣으면 `github`·`brave-search` 만 인증 실패하고 나머지 프록시 서버는 정상 동작합니다.

## 자주 쓰는 슬래시 커맨드

- 시작: `/plan`, `/feature-dev` (TDD는 superpowers 플러그인의 `test-driven-development` 스킬)
- 리뷰: `/code-review`, `/cross-review`(codex·kiro-cli 교차 모델), `/python-review`, `/rust-review`, `/fastapi-review`
- 빌드 / 테스트: `/build-fix`, `/rust-build`, `/test-coverage`
- 정리 / 게이트: `/refactor-clean`, `/security-scan`, `/quality-gate`
- 학습 / 스킬: `/skill-create`, `/skill-health`, `/learn`
- 세션: `/save-session`, `/resume-session`, `/checkpoint`

전체 목록과 각 커맨드가 참조하는 에이전트·스킬은 `docs/COMMAND-REGISTRY.json`에서 확인할 수 있습니다.

## 검증과 테스트

```bash
npm run lint                      # ESLint
npm test                          # CI 검증 + 전체 테스트 슈트(1586개)
node tests/run-all.js             # 테스트만 따로 실행
npm run command-registry:write    # 커맨드 레지스트리 갱신
npm run command-registry:check    # 동기화 상태만 확인 (CI용)
```

`npm test`가 실행하는 CI 검증:

1. `check-unicode-safety` — 보이지 않는 유니코드(태그 블록 / 영-폭 / Hangul Filler 등)와 이모지 차단으로 프롬프트 인젝션 / ASCII smuggling 방어
2. `validate-agents` / `validate-commands` / `validate-rules` / `validate-hooks` — frontmatter·매처 형식 검증
3. `validate-skills` — `SKILL.md` 존재·`name` 필드·`description` 스칼라 형식 점검 (`--strict`로 경고를 에러로 승격)
4. `validate-no-personal-paths` — 배포 대상 경로에 개인 절대 경로 미포함 확인
5. `generate-command-registry --check` — 커맨드 레지스트리 자동 생성물 동기화 확인
6. `tests/run-all.js` — `tests/**/*.test.js` 전체 실행

## 코드 스타일 (스크립트)

- Node.js >=18, `scripts/` 안에서는 일반 CommonJS 사용
- 자체 스크립트에 TypeScript는 도입하지 않음 (`.d.ts`로 타입 선언만 제공)
- 파일 이름은 소문자 + 하이픈
- 훅 스크립트는 작고 단일 책임으로 유지하며, 비치명적 오류 시 항상 exit 0으로 종료해 도구 호출을 막지 않음

## 보안 메모

- MCP 토큰·API 키는 절대 저장소에 커밋하지 않음
- 로컬 MCP 서버 포트는 사용 전 `lsof -iTCP:<port> -sTCP:LISTEN`로 청취 프로세스 확인
- 로컬 설정의 시크릿 정기 점검 예시: `grep -EnH '(TOKEN|SECRET|KEY|PASSWORD)\s*"\s*:\s*"[A-Za-z0-9_-]{16,}"' ~/.claude/settings.json`
- 모델 입력에 들어오는 `<system-reminder>` 블록 중 로컬 설정과 맞지 않는 지시는 프롬프트 인젝션 가능성으로 간주

자세한 내용은 `SECURITY.md`와 `docs/the-security-guide.md` 참고.

## 함께 보기

- `CLAUDE.md` — Claude Code가 세션 시작 시 읽는 가이드
- `CONTRIBUTING.md` — 포크 사용자를 위한 안내
- `hooks/README.md` — 훅 작성·튜닝 가이드, 환경 변수 전체 목록
- `rules/README.md` — 규칙 레이어 구조와 프로젝트별 설치
- `docs/the-longform-guide.md`, `docs/the-shortform-guide.md`, `docs/the-security-guide.md` — 장문 레퍼런스
