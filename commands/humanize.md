---
description: 한글 AI 티 제거 — humanize-korean 실행 (경로는 shim의 route_hint 로 자동 결정, --strict 시 heavy 고정)
argument-hint: "[윤문할 텍스트 또는 파일 경로] [장르:..|강도:..|--strict|가볍게]"
workloads: [writing]
origin: im-not-ai (epoko77-ai/im-not-ai) v2.3.2
---

# /humanize — 한글 AI 티 제거

`humanize-korean` 스킬을 발동해 인자로 전달된 한글 텍스트(또는 파일)를 윤문한다.

## 입력
$ARGUMENTS

## 동작
1. 인자가 비면: "윤문할 텍스트를 붙여넣어 주세요" 안내 후 종료.
2. 인자가 파일 경로(.txt/.md)면 `Read`로 본문 로드.
3. 인자가 텍스트면 그대로 입력으로 사용.
4. `humanize-korean` 스킬 SKILL.md 절차(Phase 0 → 결과 전달)를 따른다. 경로는 **Phase 1 shim 이 산출한 `route_hint`** 가 정한다 — light 1콜 / standard 2콜 / heavy 3콜. 사용자 명시(`--strict`·"가볍게")가 route_hint 보다 우선한다.
5. 결정적 게이트를 건너뛰지 않는다: 서법 복원 → 주입 쉼표 제거 → `verify_gates.py`. 이 셋이 **의미 함축**(유보·요구가 단언으로, 앵커 어휘가 동의어로 사라지는 것)을 막는 층이다.
6. 결과 전달:
   - 한 줄 상태(경로 / 변경률 / 등급 / 자체검증 통과) — 변경률은 게이트 스크립트 출력값
   - 윤문본 본문(마크다운 블록)
   - `final.md` 끝 `<!-- HUMANIZE-SUMMARY -->` 블록의 핵심 표
   - 등급 B 이하면 "`/humanize-redo` 또는 `--strict` 로 heavy 재실행 가능" 안내

## 옵션 (인자 끝에 자연어로)
- `장르: 칼럼|리포트|블로그|공적` — 장르 명시 (생략 시 첫 300자로 자동 추정)
- `강도: 보수|기본|적극` — 윤문 강도 (기본값: 기본. light 경로는 항상 보수)
- `--strict` / `정밀 모드` — heavy 경로 강제 (진단 → 겨냥 윤문 → finalize)
- `가볍게` / `빠르게만` — light 경로 강제

## 참고
- 슬림 룰북(윤문 콜): `skills/humanize-korean/references/quick-rules.md`
- 진단 인덱스(진단 콜): `skills/humanize-korean/references/diagnosis-rules.md`
- 분류 체계 SSOT: `skills/humanize-korean/references/ai-tell-taxonomy.md`
