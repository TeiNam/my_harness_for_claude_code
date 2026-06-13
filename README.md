# my_harness_for_claude_code

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933.svg)
![Python](https://img.shields.io/badge/Python-3.12-3776AB.svg)
![ESLint](https://img.shields.io/badge/ESLint-9.x-4B32C3.svg)
![Tests](https://img.shields.io/badge/tests-1517%20passing-brightgreen.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/teinam)

개인 워크로드(Python / Rust / TypeScript / 데이터베이스 / 클라우드 / 글쓰기)에 맞춰 큐레이션한 Claude Code 하네스 — agents, skills, slash commands, hooks, rules, MCP 설정을 한곳에 모았습니다.

특히 **AWS Bedrock 기반 개발에 최적화**되어 있습니다. Bedrock Converse API / 모델 호출(Claude·Nova·Llama·Mistral·Titan) / Agents·Knowledge Bases / Guardrails / prompt caching / 크로스 리전 inference profile / 비용 추적을 다루는 `aws-bedrock` 스킬을 중심으로, `aws-cloud`(IAM·네트워킹·비용 가드레일), `cost-aware-llm-pipeline`(토큰·비용 최적화), `claude-api`(Anthropic SDK 연계)가 함께 묶여 AWS 경계 안에서의 LLM 개발을 일관되게 지원합니다.

플러그인 부트스트랩 없이 단독으로 동작하며, 이 저장소를 `~/.claude/`에 심볼릭 링크로 설치해 곧바로 사용합니다. 2026-05-22에 두 개의 출처에서 모은 자료를 정리·재배선한 결과물입니다.

## 한눈에 보기

| 디렉터리 | 항목 수 | 설명 |
|---|---:|---|
| `agents/` | 48 | 위임 가능한 서브에이전트 (planner, reviewers, build-resolvers, devops, translator-docs, deep-researcher 등) |
| `commands/` | 53 | 슬래시 커맨드 (frontmatter 기반 markdown) |
| `skills/` | 125 | 도메인 지식·워크플로 정의 (DB / FastAPI / Obsidian 플러그인 / AI / 글쓰기 등) |
| `rules/` | 36 | common 레이어 + 언어별(typescript / python / rust / web) |
| `hooks/` | 29 | 이벤트 기반 훅 매처 (실행 스크립트 44종) |
| `mcp-configs/` | — | MCP 서버 설정 샘플 |
| `scripts/` | — | 훅 핸들러 / 설치 / CI 검증 / 세션 관리 도구 |
| `tests/` | — | 1527개 테스트 (검증기 + 라이브러리 + 훅 + 통합) |
| `docs/` | — | 장문 가이드(글쓰기 / 보안)와 steering 규칙 |

상세 인덱스는 `docs/COMMAND-REGISTRY.json`에 자동 생성되어 있습니다.

## 대상 워크로드

Python(데이터 분석 / FastAPI), Rust, React + Vite + TypeScript, Obsidian 플러그인, RDBMS / MongoDB / DuckDB / DynamoDB, AWS + Bedrock, Hugging Face 기반 실시간 STT, Node.js, 창작·기술 블로깅·PPT 작성.

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
- **프론트엔드**: `obsidian-plugin-develop`(TypeScript + i18n + Chromium + 릴리스 체크리스트), `vite-patterns`, `frontend-patterns`
- **AI / 클라우드**: `claude-api`, `aws-bedrock`, `aws-cloud`, `realtime-stt-huggingface`, `cost-aware-llm-pipeline`, `ai-regression-testing`
- **글쓰기**: `markdown-writing`, `article-writing`, `brand-voice`, `crosspost`, `frontend-slides`, `tech-blogging`, `creative-writing`, `ppt-authoring`
- **한글 AI 티 제거**: `humanize-korean` — AI가 쓴 한글 글의 번역투·관용구·기계적 병렬·피동태 남용 등 10대 카테고리 패턴을 탐지·윤문(`/humanize`·`/humanize-redo`, Fast/strict 모드). epoko77-ai/im-not-ai 통합.

## AWS Bedrock 워크플로 (최적화 포인트)

이 하네스는 "같은 모델을 AWS 계정·IAM·과금 경계 안에서" 쓰는 시나리오를 1급으로 다룹니다.

- **`aws-bedrock` 스킬** — Converse API, `bedrock-runtime` 모델 호출(Claude / Nova / Llama / Mistral / Cohere / Titan), Bedrock Agents·Knowledge Bases(관리형 RAG), Guardrails(PII·금칙어·문맥 필터), Titan/Cohere 임베딩, prompt caching, provisioned throughput, 크로스 리전 inference profile. Bedrock vs 직접 provider SDK 선택 기준표 포함.
- **`aws-cloud` 스킬** — IAM 최소 권한, VPC 엔드포인트·PrivateLink, 리전 레지던시, CloudWatch / CloudTrail 관측, 비용 가드레일.
- **`cost-aware-llm-pipeline` 스킬** — 토큰·비용 추적과 모델 라우팅으로 Bedrock 호출 비용을 통제.
- **`claude-api` 스킬** — Bedrock과 Anthropic 직접 SDK를 함께 쓸 때의 스트리밍·tool use·캐싱 패턴.
- **연계 에이전트** — `devops`(plan·dry-run 우선의 AWS 변경), `security-reviewer`(IAM·자격증명·SDK 호출 경로 점검), `architect`(추론 파이프라인·리트라이/백오프 설계).

워크로드 설치 시 `--backend=ai,cloud` (또는 `--workload=ai,cloud`) 를 고르면 위 자산만 추려서 들어옵니다. 관련 트리거 키워드: `bedrock-runtime`, `Converse`, `InvokeModel`, `BedrockAgent`, `retrieve_and_generate`, `guardrail`, `inference profile`, `provisioned throughput`.

## 설치

설치는 6개 톱레벨 카테고리(**백엔드 / 프론트엔드 / 플러그인 / 데이터 분석 / 데이터 설계 / 글쓰기**) 로 시작해서 카테고리별 sub-옵션(언어·엔진·플랫폼) 을 다중 선택하는 방식입니다. 선택된 sub-옵션이 워크로드 키로 변환되고, 그 키와 교집합인 자산만 `~/.claude/` 에 파일별 심볼릭 링크로 들어갑니다. 저장소에서 수정한 내용은 즉시 반영됩니다.

### 대화형 메뉴

```bash
./install.sh                                    # 카테고리 + sub-옵션 메뉴를 띄움
```

번호를 콤마로 입력하면 됩니다 (예: `1,4` → 백엔드 + 데이터 분석). 각 카테고리 안에서도 같은 방식으로 sub-옵션을 다중 선택합니다 — 빈 줄 / `all` 은 전체 선택입니다.

### CLI 플래그 (비대화형)

대화형 없이 같은 결과를 얻으려면:

```bash
./install.sh --all                              # 모든 카테고리 · 모든 sub-옵션
./install.sh --category=backend --backend=python                # FastAPI 등 파이썬 백엔드만
./install.sh --category=backend --backend=python,cloud          # 백엔드(파이썬 + AWS·Docker)
./install.sh --category=data-analysis --data-analysis=duckdb,python  # DuckDB + 파이썬 분석
./install.sh --category=data-design --data-design=mysql         # MySQL 가이드라인만 (Postgres 제외)
./install.sh --category=plugin --plugin=obsidian                # Obsidian 플러그인 + 프론트
./install.sh --category=writing                                 # 글쓰기 자산만
```

| 카테고리 | sub-옵션 |
|---|---|
| `backend` | `python`, `rust`, `nodejs`, `cloud`, `ai` |
| `frontend` | `react-vite-ts` |
| `plugin` | `obsidian`, `chrome` (예약), `claude` (예약) |
| `data-analysis` | `duckdb`, `python` |
| `data-design` | `mysql`, `postgres`, `mongodb`, `dynamodb` |
| `writing` | (sub-옵션 없음) |

> sub-옵션 플래그(`--backend=...` 등)를 명시하면 해당 카테고리는 자동으로 활성화되므로 `--category=` 는 생략 가능합니다.

### 그 외 옵션

```bash
./install.sh --dry-run                          # 변경 없이 미리 보기
./install.sh --uninstall                        # 모두 제거 (선택과 무관하게 전체 정리)
./install.sh --force                            # 기존 파일 덮어쓰기
./install.sh --with-hooks                       # ~/.claude/settings.json 에 훅 병합
./install.sh --with-hooks --dry-run             # 병합 결과 미리 보기
./install.sh --with-hooks --uninstall           # 하네스가 추가한 훅만 정리 (사용자 훅 보존)
```

저수준 워크로드 키를 직접 다루고 싶으면 `--workload=python-backend,mysql` / `--skip-workload=ai,nodejs` 도 그대로 사용할 수 있습니다 (메뉴 플래그보다 우선).

### Windows

```powershell
.\install.ps1                                                         # 대화형 (Windows Terminal)
.\install.ps1 -All
.\install.ps1 -Category backend -Backend python,cloud
.\install.ps1 -DataDesign mysql,postgres -WithHooks
```

Windows 10+ + Developer Mode 또는 관리자 권한이 필요합니다 (심볼릭 링크).

### 자산 분류 방식

각 자산의 그룹은 frontmatter 의 `workloads:` 키로 결정됩니다 (`workloads: [python-backend]`, `workloads: [obsidian, frontend]` 등). 키가 없거나 frontmatter 자체가 없는 파일은 `scripts/install/workloads.js` 의 휴리스틱으로 폴백 분류됩니다 (rules/ 는 부모 폴더 기준). 일괄 재태깅은 `node scripts/install/tag-assets.js --dry-run` 으로 미리보고 `--apply` 로 적용합니다.

전체 워크로드 키 목록: `core, python-backend, python-data, rust, nodejs, cloud, ai, frontend, obsidian, plugin-chrome, plugin-claude, mysql, postgres, mongodb, dynamodb, writing`.

훅 병합은 `id`(`pre:bash:dispatcher`, `stop:cost-tracker` 등) 기준으로 멱등하게 동작하며, 변경 전 `settings.json.bak.<ISO>` 백업을 남깁니다. 사용자가 수동으로 추가한 훅 항목은 그대로 보존됩니다.

`hooks/prompt-pack.json`은 실행되지 않는 참고용 프롬프트 모음으로, `hooks/README-prompt-pack.md`를 참고해 세션이나 `CLAUDE.md`에 직접 붙여 사용합니다.

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
| `GITHUB_TOKEN` | MCP github 서버, work-items 동기화 |
| `CLAUDE_HOME` | 기본값 `~/.claude` 재정의 |
| `HARNESS_HOOK_PROFILE` | 훅 프로파일 (`minimal` / `standard` / `strict`) |
| `HARNESS_DISABLED_HOOKS` | 비활성화할 훅 ID 목록(쉼표 구분) |
| `HARNESS_OBSERVER_DIR` | 옵저버 출력 디렉터리 |
| `HARNESS_GH_SHIM` | 테스트용 gh shim 활성화 |
| `HARNESS_SESSION_RECORDING_DIR` | 세션 녹화 출력 경로 |

훅 동작은 환경 변수만으로 조정합니다. 자세한 키 목록은 `hooks/README.md`를 참고하세요.

## MCP 서버

샘플 설정은 `mcp-configs/mcp-servers.json`과 `.mcp.json`에 있습니다 — github, context7, exa, memory, playwright, sequential-thinking. 컨텍스트 윈도 보호를 위해 동시 활성 서버는 10개 이하로 유지합니다. 토큰 같은 비밀값은 환경 변수나 OS 키체인에서 spawn 시점에 주입하고 절대 커밋하지 않습니다.

## 자주 쓰는 슬래시 커맨드

- 시작: `/plan`, `/feature-dev`, `/tdd-workflow`
- 리뷰: `/code-review`, `/python-review`, `/rust-review`, `/fastapi-review`
- 빌드 / 테스트: `/build-fix`, `/rust-build`, `/test-coverage`
- 정리 / 게이트: `/refactor-clean`, `/security-scan`, `/quality-gate`
- 학습 / 스킬: `/skill-create`, `/skill-health`, `/learn`
- 세션: `/save-session`, `/resume-session`, `/checkpoint`

전체 목록과 각 커맨드가 참조하는 에이전트·스킬은 `docs/COMMAND-REGISTRY.json`에서 확인할 수 있습니다.

## 검증과 테스트

```bash
npm run lint                      # ESLint
npm test                          # CI 검증 + 전체 테스트 슈트(1517개)
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
