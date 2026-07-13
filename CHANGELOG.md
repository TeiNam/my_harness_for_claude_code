# Changelog

All notable changes, grouped by commit date.

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

