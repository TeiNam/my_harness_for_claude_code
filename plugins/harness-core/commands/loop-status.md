---
description: Inspect active loop state, progress, failure signals, and recommended intervention.
workloads: [core]
---

# Loop Status Command

Inspect active loop state, progress, and failure signals.

This slash command can only run after the current session dequeues it. If you
need to inspect a wedged or sibling session, run the bundled script from another
terminal:

```bash
node scripts/loop-status.js --json
```

The script scans local Claude transcript JSONL files under
`~/.claude/projects/**` and reports stale `ScheduleWakeup` calls or `Bash`
tool calls that have no matching `tool_result`.

## Usage

`/loop-status [--watch]`

## What to Report

- active loop pattern
- current phase and last successful checkpoint
- failing checks (if any)
- estimated time/cost drift
- recommended intervention (continue/pause/stop)

## Cross-Session CLI

- `node scripts/loop-status.js --json` emits machine-readable status for recent
  local Claude transcripts.
- `node scripts/loop-status.js --home <dir>` scans a different home directory
  when inspecting another local profile or mounted workspace.
- `node scripts/loop-status.js --transcript <session.jsonl>` inspects one
  transcript directly.
- `node scripts/loop-status.js --bash-timeout-seconds 1800` adjusts the stale
  Bash threshold.
- `node scripts/loop-status.js --exit-code` exits `2` when stale loop or tool
  signals are found, or `1` when transcripts cannot be scanned.
- `--exit-code` with `--watch` requires `--watch-count` so watchdog scripts do
  not wait forever for a process exit.
- `node scripts/loop-status.js --watch` refreshes status until interrupted.
- `node scripts/loop-status.js --watch --watch-count 3 --exit-code` refreshes a
  bounded number of times, then exits with the highest status seen.
- `node scripts/loop-status.js --watch --watch-count 3` emits a bounded watch
  stream for scripts and handoffs.
- `node scripts/loop-status.js --watch --write-dir ~/.claude/loops` maintains
  `index.json` and per-session JSON snapshots for sibling terminals or
  watchdog scripts.

## Watch Mode

When `--watch` is present, refresh status periodically. With `--json`, each
refresh is emitted as one JSON object per line so another terminal or script can
consume the stream.

## Snapshot Files

Use `--write-dir <dir>` when a separate process needs to inspect loop state
without waiting for the current Claude session to dequeue `/loop-status`. The
CLI writes:

- `index.json` with one row per inspected session.
- `<session-id>.json` with the full status payload for that session.

These files are snapshots of local transcript analysis. They do not control or
timeout Claude Code runtime tool calls.

## Arguments

$ARGUMENTS:
- `--watch` optional
