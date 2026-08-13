# Agent Orchestration

## Subagent Gate (overrides "PROACTIVELY" / "MUST BE USED" phrasing everywhere)

**Default is inline work in the main loop. A subagent is the exception, not the reflex.**
Any "use PROACTIVELY", "MUST BE USED", or "immediately" wording in other rules or in
agent descriptions marks a *candidate*, not a command — this gate decides.

Spawn a subagent ONLY when at least one of these holds:

1. **User asked** — named an agent, a review, or multi-agent work explicitly.
2. **Context protection** — the task needs reading across many files or produces large
   output where only the conclusion matters (broad search, repo-wide audit).
3. **True parallelism** — 2+ genuinely independent tasks that would otherwise run serially.
4. **A command/skill pipeline requires that agent** (e.g. /humanize strict stages).

Hard limits:

- **Max 3 concurrent subagents** unless the user explicitly asks for more scale
  (workflow / ultracode opt-in).
- **No speculative reviewers** — do not auto-spawn code-reviewer / security-reviewer /
  tdd-guide after every edit. Spawn them when the change is security-sensitive, spans
  5+ files, or the user asks.
- **No agent for what one command answers** — a single grep, test run, or file read
  is done inline.
- **No chains** — never spawn an agent whose main job is to spawn more agents.
- **Smell test** — if writing the agent prompt takes longer than doing the task,
  do the task.

Rationale: Opus 5-class models delegate eagerly by default; uncapped, this multiplies
latency and token cost with no quality gain on small tasks.

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
