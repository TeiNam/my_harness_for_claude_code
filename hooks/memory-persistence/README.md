# Memory Persistence Hooks

These lifecycle hook definitions document the harness's memory persistence contract for manual
installs. **Every hook listed here now lives in the opt-in stack** (`hooks/hooks-optional.json`),
so none of it runs under the default `minimal` profile.

That is deliberate, not drift. The four lifecycle groups were demoted on 2026-08-16 because each
one either wrote a file no code reads under `minimal`, or was already covered by a command that a
human invokes — `docs/hooks-policy.md` records the per-hook reasoning. The core stack is two
groups: `pre:bash:dispatcher` and `subagent:budget`.

To run this contract:

```bash
node scripts/install/merge-hooks.js --optional          # add the opt-in stack
# then raise the profile — the opt-in stack is standard+ only
#   settings.json: env.HARNESS_HOOK_PROFILE = "standard"
```

The executable implementations live in `scripts/hooks/`:

- `session-start.js` loads bounded prior context, detects project state, and prepares session metadata.
- `pre-compact.js` captures state before context compaction.
- `session-end.js` persists session-end summaries when transcript metadata is available.
- `session-activity-tracker.js` records tool usage and file activity for status and observability.

The installed hook graph is `hooks/hooks.json` (core) plus `hooks/hooks-optional.json` (opt-in).
This directory is the human-readable lifecycle definition surface; nothing executes it.

## Lifecycle Contract

All of these require `--optional` **and** `HARNESS_HOOK_PROFILE=standard` or `strict`.

| Event | Hook | Purpose | Blocking |
|---|---|---|---|
| `SessionStart` | `session:start` | Load bounded prior context and project metadata | no |
| `PreCompact` | `pre:compact` | Save state before compaction | no |
| `PostToolUse` | `post:session-activity-tracker` | Record tool and file activity for harness metrics | no |
| `Stop` | `stop:session-end` | Persist session state after each response | no (async) |
| `Stop` | `stop:format-typecheck` | Batch quality gate after edits | yes on hook failure |
| `Stop` | `stop:check-console-log` | Audit modified files for debug logging | warn/error by hook output |
| `SessionEnd` | `session:end:marker` | Clear the observer lease `session:start` wrote | no (async) |

`session:start` and `session:end:marker` are a pair — the first writes an observer lease, the
second clears it. Enabling one without the other leaks leases. Note that no shipped code *starts*
the observer, so the lease bookkeeping is inert until something does.

## Operator Expectations

- Keep persistence local by default.
- Avoid sending transcripts or tool traces to hosted services unless a user explicitly enables an integration.
- Bound context loaded at session start with `HARNESS_SESSION_START_MAX_CHARS` (default 8000).
- Allow opt-out with `HARNESS_SESSION_START_CONTEXT=off`.
- Keep lifecycle hooks profile-gated through `HARNESS_HOOK_PROFILE` and `HARNESS_DISABLED_HOOKS`.

## Related Files

- `hooks/hooks.json` — core stack (2 groups)
- `hooks/hooks-optional.json` — where every hook above actually lives
- `hooks/README.md`
- `docs/hooks-policy.md` — why these are opt-in, and the retirement history
- `scripts/hooks/session-start.js`
- `scripts/hooks/pre-compact.js`
- `scripts/hooks/session-end.js`
- `scripts/hooks/session-activity-tracker.js`
