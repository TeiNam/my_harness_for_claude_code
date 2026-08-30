# Agent Orchestration

## Subagent Routing (overrides "PROACTIVELY" / "MUST BE USED" phrasing everywhere)

**Delegation is the default whenever the work has a shape.** Any "use PROACTIVELY",
"MUST BE USED", or "immediately" wording elsewhere marks a *candidate*; this section
decides which vehicle carries it.

This **reverses** the previous rule — "default is inline work, a subagent is the
exception" (dropped 2026-08-30). That rule was right for its time: cold agents ran
with no harness context, no rubric, no skills, so inline work was simply better
work. The premise is gone. CLAUDE.md and `rules/` reach every non-fork subagent
automatically, 38 of 46 agents preload their rubric through `skills:`, and `fork`
carries the entire conversation. Delegating no longer costs quality, so the only
open question is *which vehicle*.

| The work is… | Vehicle |
|---|---|
| a role with a standing rubric (review, audit, translate, resolve build errors) | the matching `agents/` entry — **delegate, don't deliberate** |
| dependent on what just happened in this conversation | **`fork`** (`/subtask`; `/fork-as <agent>` when a rubric also applies) |
| broad reading where only the conclusion matters (repo-wide search, audit) | `Explore` or a cold agent — keeps the transcript out of the main context |
| 2+ genuinely independent tasks | parallel `Agent` calls in a single message |
| answerable by one tool call (a grep, a file read, a test run) | inline — delegation has a floor cost and a one-liner is below it |
| fan-out, a task DAG, a coordinator loop | Orca `orchestration`, not this session |

Hard limits remain, but they cap **concurrency and recursion** — not frequency:

- **Max 3 concurrent** unless the user asks for more scale. Beyond that it is Orca's.
- **No chains** — never spawn an agent whose main job is to spawn more. The
  `subagent:budget` hook pins every subagent as a leaf, and a fork cannot fork.
- **No reviewer after every edit.** Delegate review when there is something to review
  — a finished change, a non-trivial diff, security-sensitive code — not per keystroke.
- **Smell test** — if writing the agent prompt takes longer than doing the task, do
  the task.

Rationale for the shape of the cap: concurrency and recursion multiply cost
super-linearly, so they stay bounded. A single delegation is cheap and now carries
the harness with it, so it is no longer rationed.

## Frontmatter Conventions

Beyond `name` / `description` / `tools` / `model`, two fields carry harness policy.

**`skills:` — preload the agent's rubric.** The field injects each skill's *full*
SKILL.md body at startup, not its description, so a cold agent stops guessing at
domain rules it cannot see. Rules:

1. **Workload alignment.** Preload only a skill whose `workloads:` intersects the
   agent's, or a `core` skill (those are always installed). Otherwise a user who
   installed just that agent's workload gets a broken preload.
2. **Rubric only.** Preload what *is* the agent's standard of judgment, not what
   might help — the body is paid on every invocation (currently ~10KB ≈ 2.7k
   tokens on average; `mle-reviewer` at 22KB is the ceiling). Everything else
   stays reachable through the Skill tool.
3. **Cap at 2**, and 3 only when one is tiny (`devops` + `safety-guard`).
4. **Skip `lab` agents** — they are `--workload=...,lab` manual-only, so their
   companion skills may not be installed.

**`tools:` — always keep `Skill` in the allowlist.** An explicit `tools:` list *is* the
entire pool; only omitting the field inherits everything. A list without `Skill`
therefore locks the agent out of every skill — harness and plugin alike — and
`skills:` only covers what you named up front. All 46 agents now carry `Skill`
(2026-08-30), which is what makes plugin skills (ponytail, superpowers,
ui-ux-pro-max, easy-rdbms) reachable from inside a subagent: `skills:` guarantees the
rubric, `Skill` covers the rest on demand. The cost is the skill listing in the
subagent's context — throttle with `skillListingMaxDescChars` /
`skillListingBudgetFraction` in `settings.json` if it grows.

**`effort:` — pin depth only at the extremes.** It *overrides* session effort, so
pinning the middle would fight the user's `/effort`.

| Class | Setting |
|---|---|
| `opus`, open box (design, unknown-cause diagnosis, multi-source synthesis) | `effort: high` |
| `opus`, unrecoverable miss (security, fidelity audit, taxonomy discovery) | `effort: xhigh` |
| `haiku`, mechanical high-frequency | `effort: low` |
| `sonnet`, closed box (30 agents) | **unset** — inherits the session |

This is the frontmatter form of the tiering rule in `model-routing.md`: reach for
effort before reaching for a higher tier. Deliberately still unused: `memory:`,
`isolation:`, `maxTurns:`, `permissionMode:`, `experimental.cacheTtl` — adopt
them per agent when there is a reason, not as a sweep.

## Available Agents

Located in `~/.claude/agents/`:

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| planner | Implementation planning | Complex features, refactoring |
| architect | System design | Architectural decisions |
| tdd-guide | Test-driven development | New features, bug fixes |
| code-reviewer | Code review | After writing code |
| security-reviewer | Security analysis | Before commits |
| build-error-resolver | Fix build errors | When build fails |
| e2e-runner | E2E testing | Critical user flows |
| refactor-cleaner | Dead code cleanup | Code maintenance |
| doc-updater | Documentation | Updating docs |
| rust-reviewer | Rust code review | Rust projects |
| harmonyos-app-resolver | HarmonyOS app development | HarmonyOS/ArkTS projects |

## Agent Candidates by Situation

Subject to the Subagent Gate above (these are candidates, not auto-spawns):
1. Complex feature requests (multi-phase, 5+ files) - **planner** agent
2. Security-sensitive or large (5+ files) changes - **code-reviewer** agent
3. Architectural decision with system-wide impact - **architect** agent
4. TDD process explicitly requested - **tdd-guide** agent

Small edits, single-file fixes, and doc changes: review inline yourself, no agent.

## Parallel Task Execution

When the gate justifies multiple agents, launch independent ones in parallel
(max 3 concurrent unless the user asked for more):

```markdown
# GOOD: Parallel execution
Launch 3 agents in parallel:
1. Agent 1: Security analysis of auth module
2. Agent 2: Performance review of cache system
3. Agent 3: Type checking of utilities

# BAD: Sequential when unnecessary
First agent 1, then agent 2, then agent 3
```

## Multi-Perspective Analysis

For complex problems, use split role sub-agents:
- Factual reviewer
- Senior engineer
- Security expert
- Consistency reviewer
- Redundancy checker
