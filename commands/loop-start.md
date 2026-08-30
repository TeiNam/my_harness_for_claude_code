---
description: Start a managed autonomous loop pattern with safety defaults and explicit stop conditions.
workloads: [core]
---

# Loop Start Command

Start a managed autonomous loop pattern with safety defaults.

## Usage

`/loop-start [pattern] [--mode safe|fast]`

- `pattern` — **단일 세션 루프만 다룬다**(병렬 패턴은 Orca 담당, 아래 주석 참고):
  - `sequential` (기본): 한 번에 한 작업, 게이트 통과 후 다음으로
  - `continuous-pr`: 엄격한 CI/PR 통제가 필요할 때
- `--mode`:
  - `safe` (default): strict quality gates and checkpoints
  - `fast`: reduced gates for speed

## Flow

1. Confirm repository state and branch strategy.
2. Select loop pattern and model tier strategy.
3. Enable loop instrumentation — the core hook stack deliberately excludes it:
   ```bash
   node scripts/install/merge-hooks.js --optional   # loop detection, compaction, lesson capture
   ```
   `--mode safe` additionally wants `HARNESS_HOOK_PROFILE=strict` (blocking gates + Stop-time tests).
   When the loop is done, re-merge without `--optional` to drop back to the core 2 groups.
4. Create loop plan and write runbook under `.claude/plans/`.
5. Print commands to start and monitor the loop.

> Termination is the design, not an afterthought: state `max_turns`, the "no
> progress" signal (diff unchanged / same error twice), and the cost ceiling
> before starting. See the 루프 제어 table in `docs/hooks-policy.md` for which
> asset covers which failure mode.

> 여러 워크트리·에이전트로 쪼개 돌리려면 이 커맨드가 아니라 Orca 쪽 다중 에이전트
> 조율(task DAG · dispatch · worker-start)을 쓴다 — `docs/orca-dependencies.md` §3.

## Required Safety Checks

- Verify tests pass before first loop iteration.
- Ensure `HARNESS_HOOK_PROFILE` is not disabled globally.
- Ensure loop has explicit stop condition.

## Arguments

$ARGUMENTS:
- `<pattern>` optional (`sequential|continuous-pr`)
- `--mode safe|fast` optional
