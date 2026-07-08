# Changelog

All notable changes, grouped by commit date.

## 2026-07-09

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

