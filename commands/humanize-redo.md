---
description: 2차 윤문 / 부분 재실행 — 가장 최근 윤문 결과를 heavy 경로(진단→윤문→finalize)로 다시 다듬는다 (카테고리·문단·강도 지정 가능)
argument-hint: "[조정 지시 — 예: \"번역투만 다시\" \"이 문단만\" \"강도 낮춰\"]"
workloads: [writing]
origin: im-not-ai (epoko77-ai/im-not-ai) v2.3.2
---

# /humanize-redo — 2차 윤문 / 부분 재실행

cwd 기준 가장 최근 `_workspace/{run_id}/`를 찾아 `humanize-korean` 스킬의 **heavy 경로 P1(진단)** 부터 재실행한다.

## 사용자 지시
$ARGUMENTS

## 동작
1. `Glob`으로 `_workspace/YYYY-MM-DD-*/final.md`(또는 `01_input.txt`)를 매칭해 최신 `run_id` 식별. 없으면 "이전 실행이 없습니다. `/humanize`로 시작하세요" 안내 후 종료.
2. 기존 `final.md`를 새 입력으로 삼는다. 이전 산출물은 `final_prev.md`로 백업한다.
3. 사용자 지시를 진단 범위로 번역한다:
   - **카테고리 지정**("번역투만", "관용구만", "이모지만") → `02_diagnosis.md`의 지배 패턴을 해당 카테고리로 한정
   - **문단 지정**("이 문단만", "두 번째 문단만") → 해당 문단만 입력으로 새 run_id 생성
   - **강도 조정**("강도 낮춰"·"보수적으로" → 지배 패턴 3개, "강도 높여" → 6개)
   - **롤백 요청**("이 변경 되돌려줘") → `humanize-finalizer`의 국소 보정으로 처리(전체 재작성 금지)
   - 지시 없음·"2차 윤문해줘" → 지배 패턴 전체 대상 heavy 재실행
4. heavy 경로 그대로 진행: P1 진단 → shim `--diagnosis` 결합 → P2 윤문 → Phase 2.4 서법 복원·주입 쉼표 제거 → P2.5 `verify_gates.py` → P3 `humanize-finalizer`.
5. 최종 출력: 변경 비교(이전 등급 → 신규 등급) + `09_finalize.json` 판정 요지.

## 루프 한도
최대 round 3. 그 이상 미해결이거나 finalize 가 `verdict=hold_and_report`면 사람 검토를 권고한다.

## 주의
- **재윤문은 의미 함축의 주 위험 구간이다.** 같은 문장을 두 번 다듬으면 앵커 어휘가 동의어로 밀려나기 쉽다. 매 round 마다 `verify_gates.py`를 원문(`01_input.txt`) 기준으로 다시 돌린다 — 직전 `final.md` 가 아니라 **최초 원문**과 비교해야 누적 드리프트가 보인다.

## 참고
- 풀 파이프라인 신규 실행은 `/humanize`.
- 분류 체계 SSOT: `skills/humanize-korean/references/ai-tell-taxonomy.md`
