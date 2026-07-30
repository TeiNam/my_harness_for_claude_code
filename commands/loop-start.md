---
description: Start a managed autonomous loop pattern with safety defaults and explicit stop conditions.
workloads: [core]
---

# Loop Start Command

Start a managed autonomous loop pattern with safety defaults.

## Usage

`/loop-start [pattern] [--mode safe|fast]`

- `pattern` — 선택 기준은 아래 한 줄이면 충분하다:
  - `sequential` (기본): 한 번에 한 작업, 게이트 통과 후 다음으로
  - `continuous-pr`: 엄격한 CI/PR 통제가 필요할 때
  - `rfc-dag`: RFC 를 의존성 DAG 로 분해해 병렬 진행할 때
  - `infinite`: 탐색적 병렬 생성 (반드시 종료 조건을 명시)
- `--mode`:
  - `safe` (default): strict quality gates and checkpoints
  - `fast`: reduced gates for speed

## Flow

1. Confirm repository state and branch strategy.
2. Select loop pattern and model tier strategy.
3. Enable required hooks/profile for the chosen mode.
4. Create loop plan and write runbook under `.claude/plans/`.
5. Print commands to start and monitor the loop.

## Required Safety Checks

- Verify tests pass before first loop iteration.
- Ensure `HARNESS_HOOK_PROFILE` is not disabled globally.
- Ensure loop has explicit stop condition.

## Arguments

$ARGUMENTS:
- `<pattern>` optional (`sequential|continuous-pr|rfc-dag|infinite`)
- `--mode safe|fast` optional
