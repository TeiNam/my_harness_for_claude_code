# Changelog

All notable changes, grouped by commit date.

## 2026-08-14

- fix(install): 심볼릭 링크된 skills 디렉토리에서도 orphan 을 찾는다 (2b4532b)
- fix(check-drift): 복구 안내에 --skip-workload 를 실어 보낸다 (d479da1)
- fix(check-drift): hasHarnessHooks 도 merge-hooks 의 소유권 판정을 재사용 (dd729ad)
- fix(check-drift): 복구 안내의 재설치에 --with-hooks 를 붙인다 (f297972)
- fix(install): 소유권 마커에서 CLAUDE_PLUGIN_ROOT 제거 — 범용 값이라 오탐원 (4c4d5dc)
- fix(install): 인자 없는 설치가 bash 3.2 에서 죽던 문제 + 회귀 테스트 (36fd93a)
- fix(install): bash 3.2 에서 조용히 죽던 orphan 스캔, CLAUDE_HOME 인용 (0bdf99b)
- fix(check-drift): 복구 안내에 검사한 CLAUDE_HOME 을 실어 보낸다 (f18d71c)
- fix(install): orphan 복구 안내 정확화, Windows 경로 정규화, ps1 한계 명시 (28a4e3f)
- fix(install): id 충돌은 이벤트별로, 직계 링크 스캔은 skills 로 한정 (5e4516f)
- fix(install): uninstall·비대상 이벤트는 id 가 아니라 실행 스크립트로만 판정 (b94db1a)
- docs: Loop Control 표의 루프 서명 설명을 실제 구현(입력 전체 해시)에 맞춤 (8481960)
- fix: 6차 리뷰 반영 — 동작 불가한 컨텍스트 경고 제거, id 충돌 경고 추가 (ca01805)
- fix: 5차 리뷰 반영 — 루프 서명은 입력 전체, orphan 스캔은 설치 형태로 제한 (a9c2295)
- fix(loop): 해시 절단을 전부 제거 — MultiEdit·긴 Bash 명령까지 구분 (888f9cc)
- fix: 3차 리뷰 반영 — 경로 정규화·해시 절단·dry-run 부작용 (3a10328)
- feat(loop): 루프 제어를 명문화하고 루프 감지 오탐을 고친다 (c3b801b)
- fix(install): 2차 리뷰 반영 — 소유권 판정을 링크 타깃·런처 기준으로 (c23a9f4)
- fix(install): orphan 링크 탐지·정리 — 선언 기반 uninstall 의 사각지대 (11367a3)
- refactor(orca): Orca 와의 역할 분리 명문화, 죽은 statusline 경로 제거 (cf9f816)
- refactor(docs): CLAUDE.md 30.8KB → 14.7KB, 카탈로그·설치 상세를 docs 로 분리 (ef054b0)

## 2026-08-13

- refactor(rules): 상시 로드를 불변 제약 4개로 축소 (15.4k → 1.8k tok) (3fe9e0c)
- refactor(hooks): 코어 스택 7그룹으로 축소, 기본 프로파일 minimal (af5209a)

## 2026-08-04

- refactor(agents): 모델 티어를 "박스가 열려 있는가" 기준으로 재정렬 (#17) (5803867)
- chore(tests): subagent-budget 테스트 포맷 정리 (#16) (c89fd0e)

## 2026-08-03

- fix(hooks): 리뷰 에이전트에는 findings 압박 없는 예산 브리프 적용 (#15) (faee6d9)
- fix(hooks): 서브에이전트에 ponytail 예산 브리프 주입 (subagent:budget) (#14) (35130c8)
- fix(rules): 서브에이전트 남발 통제 게이트 추가 (#13) (51e1cc9)

## 2026-08-02

- fix(mcp): mcp<2 핀을 카탈로그(SSOT)로 이전 (#12) (ba903f0)
- fix(install): build-mcp-config 가 미인식 인자에 config 를 덮어쓰지 않게 (#11) (e3bbf7e)
- fix(mcp): uvx 서버에 mcp<2 핀 + terraform 프록시 라우팅 추가 (#10) (ca050ce)

## 2026-07-31

- chore: npm test 초록화 + v0.3.0 승격 + 중복 자산 정리 (-2,606줄) (#9) (ff86b41)
- refactor(skills): 메뉴 비노출 lab 스킬 30개 제거 (-7,426줄) (#8) (f853b40)
- refactor: 산출물 0인 자기진화 스택 제거 (-13,062줄) (#7) (627dd9f)
- refactor(skills): Apple 스킬 23개 카테고리 제거 (-155,912줄, 레포의 50%) (#6) (36b4ef6)
- refactor(models): Fable 티어 제거 — Opus 5 를 천장으로, 그 위는 effort·Codex (#5) (5f74354)

## 2026-07-30

- feat(ci): 훅 카운트 정합 검증 + cross-review blast radius 프리앰블 (#4) (547079f)

## 2026-07-26

- feat(git): 커밋→푸시→PR→머지 파이프라인 강제 (#3) (c14070c)
- chore(mcp): 프로젝트 .mcp.json 을 context7 만 남기도록 축소 (f438430)
- chore(plugin): motion-creative 동반 플러그인 목록에서 제거 (6daa711)
- refactor(cross-review): Codex 모델 핀 제거 — CLI 기본 모델 사용 (28b3af8)
- feat(cross-review): Codex 리뷰 축 모델을 gpt-5.6-sol로 고정 (3450c44)
- chore(release): v0.2.0 — 플러그인 이중 노출 정리·자산 재편 기록 (6d7ac70)
- fix(install): check-drift 기본 워크로드를 설치 매니페스트에서 읽도록 수정 (2edcc02)
- docs(rules): uv 섹션 중복 정리 — 리베이스로 겹친 두 uv 규약을 하나로 병합 (71c7b9d)
- refactor(skills): 동반 플러그인과 중복인 스킬 4종 제거·참조 재배선 (2ab738a)
- feat(models): Opus 5 라인업 반영·Fable 5 티어 신설, Python 환경 uv-first 전환 (905751c)

## 2026-07-21

- docs(rules): Python 환경 규약 추가 — uv 기본 + 안정 버전 웹체크 (3b579e0)

## 2026-07-19

- feat(skills): MySQL 개발·네이밍 가이드 두 문서 반영·고도화 (57a5bd3)

## 2026-07-16

- feat(skills): archify 다이어그램 스킬 추가 (문서·목록 반영) (aaf971b)

## 2026-07-14

- chore(mcp): proxy config 에 exa·brave-search·aws-documentation 추가 (0cf1d96)
- fix(install): skill 을 ~/.claude/skills/ 최상위에 링크 (자동 발견 복구) (0c1dedb)

## 2026-07-13

- docs: README·CLAUDE.md 에 aws-finops·analysis-methodology 스킬 반영 (2166e85)
- refactor(skills): data-analysis 스킬 → analysis-methodology 로 rename (40c0147)
- feat(skills): aws-finops + data-analysis 스킬 신설 (2-way 리뷰 반영) (97b4508)
- fix(workloads): devops 성격 자산을 [cloud, devops] 로 재분류 (52b6229)
- style(install): select-workloads 에러 메시지 줄바꿈 (linter) (4c125fa)
- refactor(commands): /cross-review 를 2-way(Claude+Codex)로 — kiro 제거 (eda80b2)
- style(install): build-mcp-config 경고 메시지 들여쓰기 (linter) (17f0675)
- fix(install): 3-way 리뷰 발견 2건 — 오설치 유발 플래그 처리 수정 (055aff0)
- refactor(install): 메뉴를 도메인 축 6대분류로 재편 + research·report 워크로드 분리 (5d150dd)
- feat(mcp): AWS MCP 2차 배치(42종) + research·integration·aws-rds 워크로드 + core 축소 (3004320)
- feat(mcp): AWS MCP 서버군 + devops·finops·data-analysis 워크로드 신설 (7144a13)
- feat(mcp): 워크로드별 선택 빌드 — 필요한 MCP 만 config.json 에 담아 기동 (9f4e72c)
- docs: README MCP proxy 항목에 docker 미설치 안내 흐름 반영 (--with-mcp·colima) (5461539)
- fix(install): MCP proxy — docker 미설치·데몬 미동작 시 설치·재실행 안내 명확화 (2b89ec2)
- feat(install): --with-mcp (-WithMcp) 플래그로 MCP proxy 비대화형 기동 (60e49bb)
- feat(mcp): drift 6개 서버 harness 편입 (obsidian·drawio·fetch·token-optimizer·aws-documentation·terraform) (f637483)
- feat(hooks): stop:command-registry — commands/*.md 변경 시 레지스트리 자동 재생성 (61c754d)
- docs: /cross-review·stop:run-tests 반영 (README·hooks README·레지스트리 카운트 갱신) (ccdbc73)
- feat(hooks): stop:run-tests — 소스 변경 시 프로젝트 테스트 자동 실행 (strict, 비차단) (7f2df60)
- feat(commands): /cross-review — codex·kiro-cli 교차 모델 코드리뷰 (2ac763b)
- feat(install): --no-core 플래그로 baseline core 제외 지원 (5b0a8bc)

## 2026-07-11

- docs: 설계 문서 상태를 구현 완료로 갱신 (9ddd9c3)
- docs: README·CLAUDE.md 3단계 메뉴·apple/social 3분할·매니페스트 반영 (405947f)
- feat(install): 글로벌 상태 검사·매니페스트 기록 플로우 (install.sh/ps1) (e55e314)
- feat(install): 방향키 체크박스 3-tier 대화형 메뉴 (b10474b)
- feat(install): apple/social 3분할 + manifest·check-global + menu 상세 tier (ef7157f)
- docs: 설치 설계 리뷰 반영 — detailOptions leaf 부착·교차소속·별칭 확정 (30a472a)
- docs: 대화형 세분화 설치 설계 문서 추가 (4eb5ee1)

## 2026-07-09

- docs: README 모델 라우팅 섹션 추가 + 테스트 수·CHANGELOG 동기화 (bffdc58)
- feat(models): 모델별 라우팅 정책 + Codex·문서생성 스킬 추가 (bb28acc)

## 2026-07-03

- chore(skills): 유니코드 세이프티 자동 정리 및 android 스킬 추가 (ba5298c)
- feat(skills): 소셜 콘텐츠·랜딩페이지·Apple 플랫폼 스킬 세트 통합 (4e64898)
- feat(mcp): 샘플 카탈로그에 agent-browser·higgsfield·zapier MCP 추가 (e0e5bc0)

## 2026-07-01

- docs: 매니페스트 수치를 실제 코드와 동기화 (757c43d)
- feat(skills): ai-tui 스킬 추가 — 터미널 에이전트 초기화면·두뇌 크로스 언어 레퍼런스 (e9d6e5d)

## 2026-06-28

- feat(install): 워크로드 설치 후 hooks·mcp 추가 설치 프롬프트 (c737b36)
- docs(common): MCP 변경에 맞춰 공통 영역 문서·설정 동기화 (6f49c9c)
- i18n(skills): 한글 작성 스킬 6종을 영어로 번역 (토큰 절감) (2155577)
- feat(skills): mysql-guideline 에 개발 원칙·안티패턴·JDBC ref 2개 추가 (d374522)
- feat(skills): RDBMS 공통 네이밍 규칙 rdbms-naming 신규 + guideline 정렬 (04d58df)
- feat(skills): mongodb-patterns 신규 + motor→PyMongo Async 정정 (647e146)
- docs(rules): paths frontmatter 자동로드 컨벤션을 README 에 문서화 (ae48977)
- refactor(commands): /pr 와 중복인 /prp-pr 제거 (53→52) (2fdc994)
- refactor(hooks): strict 프로파일 차별화 — 차단형 훅 2종을 strict 전용으로 (e8296f1)
- refactor(agents): humanize 메타 유지보수 에이전트 7종을 lab 그룹으로 격리 (74a8906)
- refactor(agents): core 마이크로 리뷰어 3종을 code-reviewer 로 흡수 (6526b53)
- docs(mcp): 템플릿을 .mcp.json 7개 구성에 동기화 (0b0173a)
- feat(mcp): github remote 전환 + brave/sentry/time 추가, memory/seq-thinking 제거 (ecb33f5)

## 2026-06-20

- refactor(git): changelog 훅을 post-commit → pre-commit 으로 전환 (c50e51b)
- docs(changelog): post-commit 훅 산출 CHANGELOG.md 추가 (76c8c75)
- feat(git): 날짜별 CHANGELOG 자동 생성 post-commit 훅 추가 (3424c5e)

## 2026-06-19

- feat(skills): tech-writer 기술 문서 작성·윤문 스킬 통합 (2722f5e)
- refactor(install): 메타/실험 스킬 31종을 메뉴 비노출 lab 그룹으로 격리 (73bbda0)

## 2026-06-18

- refactor(learning): continuous-learning v1 완전 제거 (9fa805b)
- style(humanize): unicode-safety 게이트 위반 이모지 정리 (498a849)
- Merge remote-tracking branch 'origin/main' (dd08618)
- test(harness): npm test 완전 녹색화 + drawio 스킬 커밋 (26f1b36)
- chore(harness): 글로벌 최소화 + 드리프트 감지 + 학습 명령 통합 (db37ee8)

## 2026-06-13

- docs: update command registry and README counts for humanize-korean (1075607)
- feat(writing): integrate humanize-korean (한글 AI 티 제거) from im-not-ai (c6990b4)

## 2026-06-04

- fix(hooks): capture-lessons uses systemMessage, not additionalContext (756afbf)
- docs: highlight AWS Bedrock optimization in README (afea97b)
- feat(hooks): add lightweight lessons-learned self-evolution mechanism (422993a)
- fix(hooks): retune context-monitor thresholds for 1M-context models (3a8a4ce)

## 2026-05-23

- fix(hooks): resolve harness root via CLAUDE_PROJECT_DIR for project-local installs (7454930)
- feat(install): add workload-tagged install with 2-tier menu (14aab45)
- feat(rules): add korean-language and readme-rule common rules (38d42f9)
- docs: rewrite README with verified counts, install/test workflow, and badges (c140fb3)

## 2026-05-22

- test: drop unused catalog validator helpers and schema path constants (e900438)
- chore: fix unicode safety violations and skill frontmatter format (6212e3c)
- Initial commit: personal Claude Code harness (7dc94e1)

