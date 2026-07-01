---
name: ai-tui
description: 터미널 AI 에이전트(Claude Code·stocker 스타일)의 초기화면(intro screen)과 에이전트 두뇌(프롬프트·스킬·MCP·사용룰)를 세팅하는 크로스 언어 레퍼런스 스킬. Node(pi-tui)·Rust(ratatui)·Python(textual/rich) 3개 언어의 TUI 초기화면 구현 틀과, 언어 중립 에이전트 설정 규약을 제공한다. 트리거 — "터미널 에이전트 만들어", "TUI 에이전트", "CLI 에이전트 초기화면", "claude code 같은 화면", "ratatui/textual/pi-tui로 에이전트", "터미널 AI 껍데기", "intro screen", "터미널 챗봇 UI", "에이전트 프롬프트·MCP·룰 세팅". 순수 웹 UI, 단순 CLI 스크립트, TUI가 아닌 백엔드 에이전트는 대상이 아니다.
origin: harness
workloads: [ai, rust, nodejs, python-backend]
---

# AI TUI — 터미널 AI 에이전트 초기화면·두뇌 세팅 레퍼런스

Claude Code · stocker 같은 **터미널 AI 에이전트**를 새로 만들 때, (1) 초기 접속화면(intro screen)과 (2) 에이전트 두뇌(프롬프트·스킬·MCP·사용룰)를 언어별로 세팅하는 틀을 제공한다.

> 기준 구현: `stocker` (bun + `@mariozechner/pi-tui`) — `src/components/intro.ts`, `src/cli.ts`, `src/components/hint-bar.ts`, `src/theme.ts`

## When to Activate

- 터미널에서 도는 AI 에이전트/챗봇의 **초기화면·입력창·힌트바**를 짤 때
- 그 에이전트의 **시스템 프롬프트·스킬 로딩·MCP 연동·사용 룰**을 세팅할 때
- Node/Rust/Python 중 어느 걸로 갈지 결정하고 그 언어의 최소 골격을 얻을 때

대상 아님: 웹 UI, GUI 앱, TUI 없는 백엔드 에이전트, 한 번 출력하고 끝나는 단순 CLI 스크립트.

## 경로 규약

레퍼런스는 스킬 디렉터리에 설치된다. `${CLAUDE_SKILL_DIR}` = 이 SKILL.md가 위치한 디렉터리(런타임 주입).

- `${CLAUDE_SKILL_DIR}/references/node-pi-tui.md` — Node/TypeScript (pi-tui, stocker 원본)
- `${CLAUDE_SKILL_DIR}/references/rust-ratatui.md` — Rust (ratatui + crossterm)
- `${CLAUDE_SKILL_DIR}/references/python-textual.md` — Python (textual / rich)
- `${CLAUDE_SKILL_DIR}/references/agent-brain-setup.md` — 프롬프트·스킬·MCP·사용룰 (언어 중립)

## Step 0: 언어 선택

먼저 이 한 줄을 출력하고 시작한다:

```
ai-tui — lang: {node|rust|python} / scope: {intro | brain | both}
```

언어가 안 정해졌으면 결정 트리:

| 조건 | 언어 | 레퍼런스 |
|------|------|----------|
| 이미 LangChain/Vercel AI SDK 생태계, 빠른 반복, npm 자산 재사용 | **Node** | `node-pi-tui.md` |
| 단일 바이너리 배포, 저지연, 메모리 안전, 성능 우선 | **Rust** | `rust-ratatui.md` |
| 데이터/ML 파이프라인 옆, 위젯 풍부한 화면, 파이썬 자산 재사용 | **Python** | `python-textual.md` |

두 개가 비슷하면 **이미 팀이 쓰는 언어**를 택하고 넘어간다. 새 언어를 배우는 비용이 TUI 라이브러리 차이보다 항상 크다.

## 초기화면 6요소 (언어 중립)

터미널 에이전트 초기화면은 거의 항상 이 조합이다. 위→아래:

| 순서 | 요소 | 역할 | 필수 |
|------|------|------|------|
| 1 | 배너 박스 | 제품명 + 버전 (`═` 테두리) | 권장 |
| 2 | ASCII 로고 | 브랜드 각인 | 선택 |
| 3 | 태그라인 | 한 줄 소개 | 권장 |
| 4 | 상태 줄 | 모델 / 작업 디렉터리 / 모드 | 필수 |
| 5 | 입력창(editor) | 프롬프트 입력 | 필수 |
| 6 | 힌트 바 | 단축키 · 슬래시 커맨드 | 권장 |

### 3대 설계 원칙 (언어 불문)

1. **트리를 한 번만 조립하고 재사용한다.** 갱신마다 `clear()` 후 재생성 금지 — 텍스트/가시성만 바꾼다. (즉시형인 Rust는 이걸 "상태 구조체 하나 + 매 프레임 렌더"로 뒤집어 구현한다.)
2. **색은 팔레트에서만 꺼내 쓴다.** 하드코딩 금지. **로고 전용 색은 브랜드 primary와 분리한다.**
3. **초기화면과 대화 로그는 같은 트리에 공존한다.** intro는 맨 위에 남고, 대화는 그 아래 로그에 쌓인다.

### 렌더링 모델 차이 (언어 선택에 직결)

- **유지형(retained)** — pi-tui(Node), textual(Python): 위젯 트리를 한 번 만들고 바뀐 부분만 갱신
- **즉시형(immediate)** — ratatui(Rust): 상태 구조체를 두고 매 프레임 화면을 통째로 다시 그림

둘 다 결과는 같다. 원칙 1은 두 모델에서 표현만 다를 뿐 동일하게 지켜진다.

## 표준 슬래시 커맨드 / 단축키

최소 세트 (모든 언어 동일하게 붙인다):

```
esc          작업 중단 / 입력 지우기
ctrl+c       종료
/model       LLM 프로바이더·모델 전환
/clear       대화 지우기
/help        도움말
↑ / ↓        입력 히스토리 탐색
```

## 에이전트 두뇌 세팅 (프롬프트·스킬·MCP·룰)

TUI 껍데기는 절반이다. 나머지 절반 — 시스템 프롬프트, 스킬 로딩, MCP 연동, 사용 룰 — 은 언어와 무관한 규약이다. `agent-brain-setup.md` 참고. 요지:

- **프롬프트**: 역할·능력·경계·출력형식 4블록. 런타임 컨텍스트(모델/cwd/날짜)는 주입.
- **스킬**: `SKILL.md` 프론트매터(name/description/trigger) + 지연 로딩. description이 활성화를 좌우한다.
- **MCP**: stdio/HTTP 서버를 config로 선언, 툴 스키마는 필요 시 로드.
- **사용 룰**: 안전 경계(파괴적 작업 확인), 도구 사용 규칙, 승인 정책.

## 시작 체크리스트

초기화면:
- [ ] 배너 폭을 상수 하나로 고정했는가
- [ ] 로고는 리터럴로 박제했는가 (런타임 생성 X)
- [ ] 색은 전부 팔레트 경유이고, 로고 색을 primary와 분리했는가
- [ ] 트리를 init에서 한 번만 조립(유지형) 또는 상태 구조체로 관리(즉시형)하는가
- [ ] 모델/상태 줄은 텍스트만 갱신하는가
- [ ] 힌트 바 정렬을 **가시 폭**(ANSI 제외)으로 계산하는가 (Rust/Python 라이브러리는 자동)
- [ ] `esc`·`ctrl+c`·`/help`·`↑↓` 최소 4종을 붙였는가
- [ ] intro와 대화 로그가 같은 트리에 공존하는가

두뇌:
- [ ] 시스템 프롬프트에 역할·경계·출력형식을 명시했는가
- [ ] 파괴적/외부 작업에 확인 게이트를 뒀는가
- [ ] MCP/툴 스키마를 지연 로딩하는가 (컨텍스트 절약)
