# my_harness_for_claude_code

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933.svg)
![Python](https://img.shields.io/badge/Python-3.12-3776AB.svg)
![ESLint](https://img.shields.io/badge/ESLint-9.x-4B32C3.svg)
![Tests](https://img.shields.io/badge/tests-1468%20passing-brightgreen.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/teinam)

개인 워크로드(Python / Rust / TypeScript / 데이터베이스 / 클라우드 / 글쓰기)에 맞춰 큐레이션한 Claude Code 하네스 — agents, skills, slash commands, hooks, rules, MCP 설정을 한곳에 모았습니다.

플러그인 부트스트랩 없이 단독으로 동작하며, 이 저장소를 `~/.claude/`에 심볼릭 링크로 설치해 곧바로 사용합니다. 2026-05-22에 두 개의 출처에서 모은 자료를 정리·재배선한 결과물입니다.

## 한눈에 보기

| 디렉터리 | 항목 수 | 설명 |
|---|---:|---|
| `agents/` | 36 | 위임 가능한 서브에이전트 (planner, reviewers, build-resolvers, devops, translator-docs, deep-researcher 등) |
| `commands/` | 50 | 슬래시 커맨드 (frontmatter 기반 markdown) |
| `skills/` | 123 | 도메인 지식·워크플로 정의 (DB / FastAPI / Obsidian 플러그인 / AI / 글쓰기 등) |
| `rules/` | 33 | common 레이어 + 언어별(typescript / python / rust / web) |
| `hooks/` | 28 | 이벤트 기반 훅 매처 (실행 스크립트 45종) |
| `mcp-configs/` | — | MCP 서버 설정 샘플 |
| `scripts/` | — | 훅 핸들러 / 설치 / CI 검증 / 세션 관리 도구 |
| `tests/` | — | 1468개 테스트 (검증기 + 라이브러리 + 훅 + 통합) |
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

## 설치

이 하네스는 `~/.claude/_harness/`에 심볼릭 링크로 설치됩니다. 저장소에서 수정한 내용이 즉시 반영됩니다.

```bash
./install.sh                         # 설치
./install.sh --dry-run               # 미리 보기
./install.sh --uninstall             # 제거
./install.sh --force                 # 기존 파일 덮어쓰기
./install.sh --with-hooks            # ~/.claude/settings.json 에 훅 병합까지 수행
./install.sh --with-hooks --dry-run  # 병합 결과 미리 보기
./install.sh --with-hooks --uninstall # 하네스가 추가한 훅만 정리(사용자 훅 보존)
```

Windows: `install.ps1` (Windows 10+ Developer Mode 또는 관리자 권한 필요).

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
npm test                          # CI 검증 + 전체 테스트 슈트(1468개)
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
