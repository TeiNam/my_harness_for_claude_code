---
name: lessons-learned
description: 반복되는 교정에서 추출한 한 줄 교훈을 한 파일에 누적하는 경량 학습 로그. 같은 유형의 리뷰 지적·빌드 실패 패턴·사용자 정정이 반복될 때, 세션을 넘어 같은 실수를 되풀이하지 않도록 한다. /learn(패턴→skill 추출)보다 가볍고, continuous-learning-v2의 instinct(자동 관찰)보다 명시적이다.
inclusion: manual
workloads: [core]
origin: harness
---

# Lessons Learned (경량 교훈 로그)

자기진화 메커니즘의 한 단계다. 반복된 교정에서 짧고 재사용 가능한 교훈을
한 줄씩 뽑아 누적한다 — 같은 실수를 두 번 하지 않기 위해서.

과거 작업과 닮은 일을 시작할 때, 리뷰할 때, 반복되는 실패를 고칠 때 이
steering 을 수동으로(또는 `capture-lessons` hook 제안 흐름으로) 끌어온다.

## 우리 하네스의 다른 학습 장치와의 경계

| 장치 | 무게 | 산출물 | 언제 |
|------|------|--------|------|
| **lessons-learned** (이 skill) | 가벼움 | 한 줄 교훈 (한 파일 누적) | 반복 교정이 보일 때 |
| `/learn` | 중간 | skill 파일 1개/패턴 | 비자명한 문제를 풀었을 때 |
| `continuous-learning-v2` (instinct) | 자동 | instinct → `/promote`·`/evolve` | 상시 관찰 |

교훈이 안정적으로 반복되면 **steering 규칙(rule)으로 승격**하라 — 그게 마지막 단계다.

## 항목이 추가되는 방식

- `capture-lessons` hook(Stop 이벤트)은 한 줄 교훈을 **제안만** 한다. 이 파일을 자동으로 편집하지 않는다.
- 항목은 **사용자 확인 후에만** 기록한다. 사용자 자산 변경을 추적 가능하게 유지하기 위해서다.
- 각 교훈은 실행 가능한 한 줄로 유지한다.
- `/lessons` 커맨드로 로그를 조회하거나, 수동으로 추가하거나, 규칙으로 승격한다.

## 교훈 카테고리

- **Review findings** — 반복되는 코드리뷰 지적 (에러 처리 누락, 가변 변경 대신 불변 업데이트, 입력 검증 누락 등).
- **Build failure patterns** — 반복되는 컴파일/린트/테스트 실패와 그 근본 수정.
- **User corrections** — 사용자가 두 번 이상 명시적으로 줘야 했던 지시.

## 항목 포맷

매칭되는 카테고리 아래에 한 줄씩 추가한다:

```
- [YYYY-MM-DD] (category) <트리거 / 맥락> -> <규칙으로 진술한 교훈>
```

예:

```
- [2026-06-04] (build) bun test 가 watch 로 걸려 멈춤 -> 항상 `bun test`(단발) 로 실행한다.
- [2026-06-04] (review) async 함수에서 에러 미처리 반복 -> 외부 호출은 try/catch 또는 Result 로 감싼다.
```

## Lessons

### Review findings

<!-- 여기에 리뷰 교훈을 한 줄씩 추가 -->

### Build failure patterns

<!-- 여기에 빌드 교훈을 한 줄씩 추가 -->

### User corrections

<!-- 여기에 사용자 정정 교훈을 한 줄씩 추가 -->
