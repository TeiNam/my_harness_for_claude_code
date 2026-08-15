# Model Routing Policy

Authoritative policy for which Claude model each task and agent runs on. This
is the single source of truth; `performance.md`, `commands/model-route.md`, and
the agent frontmatter all defer to it.

## Current Lineup (2026-07, post Opus 5 launch)

| Alias | Resolves to | Character |
|-------|-------------|-----------|
| `opus` | **Opus 5** | Top tier here. Deepest reasoning: architecture, ambiguity, adversarial review, hard debugging, long-horizon autonomous runs, final high-stakes judge. Same price as Opus 4.8 ($5/$25). Also runs Fast mode (`/fast`) — same model, ~2.5× faster output at premium price (Claude API only). Escalate *within* the tier via effort (`high` → `xhigh` → `max`), not to another model. |
| `sonnet` | **Sonnet 5** | Best coding model. Default for implementation, refactors, PR review. Handles ~90% of coding. |
| `haiku` | **Haiku 4.5** | ~90% of Sonnet's capability at ~3× cost savings. Mechanical edits, search, doc scaffolding, high-frequency workers. |

> **Use aliases, never version IDs.** Agent frontmatter must say `model: sonnet`,
> not `model: claude-sonnet-5`. Aliases auto-resolve to the current lineup, so
> the harness follows model upgrades without a mass re-tag. The one place a
> pinned ID belongs is application code calling the API (see `skills/claude-api`).

### Opus 5 → Opus 4.8 fallback

Opus 5 is the `opus` target, but fall back to **Opus 4.8** when Opus 5 can't serve
the task:

- **Safety-classifier refusal** (`stop_reason: "refusal"`, mostly `category: "cyber"`)
  — retry on Opus 4.8. In API code, opt in to server-side fallbacks by default:
  `fallbacks: "default"` with beta `server-side-fallback-2026-07-01` (or an explicit
  `fallbacks: [{"model": "claude-opus-4-8"}]`).
- **Web fetch tool needed** — Opus 5 doesn't have it; use Opus 4.8 (or Sonnet 5).
- **Priority Tier capacity** — Opus 5 doesn't support Priority Tier; capacity-pinned
  workloads stay on Opus 4.8.
- **Platform gaps** — anywhere `claude-opus-5` isn't served yet, use `claude-opus-4-8`.

Opus 5 behavioral deltas that affect agent prompts: thinking is **on by default**
(omitting `thinking` runs adaptive; `disabled` + `xhigh`/`max` effort → 400); it
**self-verifies unprompted** (strip carried-over "double-check your work" scaffolding);
it delegates to subagents **more eagerly** (cap spawning where fan-out isn't wanted);
default responses run longer (prompt explicitly for target length).

## Task → Model

| Task | Model | Why |
|------|-------|-----|
| Exploration / file search | `haiku` | Fast, cheap, enough to locate code |
| Single-file / mechanical edits | `haiku` | Clear instructions, low blast radius |
| Doc scaffolding / codemaps | `haiku` | Structure is simple |
| Multi-file implementation | `sonnet` | Best coding/latency balance |
| Refactors | `sonnet` | Holds moderate context, reliable diffs |
| PR / code review | `sonnet` | Catches nuance in context |
| Implementing a fix whose cause + remedy are already known | `sonnet` | Nothing left to reason about — just apply it |
| Scanning input against a supplied rubric / taxonomy | `sonnet` | Lookup against given criteria, not open judgment |
| Rewriting / polishing spans already flagged by a detector | `sonnet` | The what-to-fix decision is upstream |
| Complex architecture | `opus` | Needs deep reasoning |
| Diagnosing a cause that is *not* yet known | `opus` | Open search space; wrong guess costs a whole cycle |
| Security analysis | `opus` | Can't afford a missed vuln |
| Ambiguous / underspecified work | `opus` | Reasoning about intent |
| Debugging system-wide bugs | `opus` | Must hold the whole system in mind |
| Overnight / long-horizon autonomous runs | `opus` at `xhigh` | Deepest reasoning available; raise effort, not tier |
| Final adversarial verify on high-stakes output | `opus` at `xhigh`/`max` | Highest-ceiling judge when a miss is expensive |
| Independent cross-family second opinion | **Codex** | Different model family — catches what re-prompting Claude cannot (see below) |

**Default to Sonnet 5.** Escalate to Opus 5 when: the first Sonnet attempt
failed, the task spans 5+ files, it's an architectural decision, or it's
security-critical. Opus 5 is the ceiling — past it, raise **effort**
(`high` → `xhigh` → `max`) rather than reaching for another tier, then get a
**cross-family** opinion from Codex. Drop to Haiku 4.5 for anything
deterministic and low-risk.

## Agent Class → Model

### The deciding question: is the box open or closed?

Reasoning depth only pays when the *shape of the answer* is undecided. If the
criteria, the diagnosis, or the fix is already given and the agent's job is to
execute against it, Opus burns thinking tokens on a problem that has no search
space left. That's the single most common waste in the fleet.

**Closed box → `sonnet`.** The rubric/taxonomy/spec is supplied, the cause is
known, the output format is fixed:

- Scan input against a supplied checklist or taxonomy → structured report
- Rewrite/polish spans a detection report already flagged
- Implement a fix whose cause and remedy are already established
- Build/type-error repair, codemods, mechanical integration, PR/CHANGELOG drafting
- Write to a given outline in a given voice

**Open box → `opus`.** The answer's shape is genuinely undetermined, or a miss
is expensive and unrecoverable:

- Design decisions: what should exist, how it should be structured (`architect`, `planner`, `code-architect`)
- Diagnosis when the cause is *not* yet known (system-wide debugging, stuck loops)
- Judging whether meaning/fact survived a transformation — an open-ended
  equivalence call over arbitrary content (`content-fidelity-auditor`, `tech-fidelity-auditor`)
- Finding what the taxonomy *doesn't* cover yet (`naturalness-reviewer`,
  `doc-clarity-reviewer`, taxonomist/gap-analyzer agents)
- Security review, adversarial review, ambiguous requirements
- Multi-source synthesis with no fixed answer shape (`deep-researcher`)

**`haiku`** — mechanical, high-frequency: `doc-updater`, `docs-lookup`, and any
future search/scaffold worker.

### Two traps

1. **"It's an important pipeline, so `opus` everywhere."** Importance is not
   reasoning depth. A detector reading a 40-pattern taxonomy is doing lookup, not
   reasoning — `sonnet`. Uniform-`opus` pipelines are how a 5-stage flow costs 5×
   what it needs to.
2. **"It's just a fix, so `sonnet`."** True only once the cause is *established*.
   Finding the cause is open-box work; applying the known fix is closed-box.
   Split the stages rather than tiering the whole thing up.

When the two axes disagree — closed box but an expensive miss — the miss wins.
Pick by *worst-case* cost of a wrong answer, not the average. A reviewer that
gates a merge is `opus` even if most reviews are easy.

## Multi-Agent Orchestration

Orchestration itself runs in **Orca `orchestration`**, not in the Claude Code
session (see CLAUDE.md → Orca Integration): Orca owns the worktrees, terminals,
and blocking waits, so two coordinators over one work set is the failure mode to
avoid. The tiering rules below apply to the agents Orca spawns.

- Orchestrate on `sonnet` (or `opus` if the plan itself is the hard part) —
  subagents inherit the session model unless overridden.
- Fan-out workers on the cheapest model sufficient for their leaf task —
  usually `haiku` for search/extract, `sonnet` for edits.
- Adversarial verify / judge stages on `opus` — that's where reasoning depth
  pays for itself. Where a missed defect is very expensive (security gate,
  production migration), run `opus` at `xhigh`/`max` **and** add a Codex axis;
  two model families disagreeing is a stronger signal than one model retried.
- **Tier per stage, not per pipeline.** A detect → fix → judge flow is
  `sonnet` → `sonnet` → `opus`, not `opus` × 3. Tiering the whole pipeline to its
  hardest stage is the default failure mode; the closed/open box test above is
  applied stage by stage.
- Opus 5 delegates to subagents more eagerly than 4.8 — in orchestrator prompts,
  state explicitly when NOT to spawn (single-file reads, sequential steps).
- Effort routing inside a tier is cheaper than jumping tiers: `low` for
  mechanical workers, default `high`, `xhigh`/`max` for the hardest
  verify/judge stages.

## Fast Mode

`/fast` (Opus 5, and Opus 4.8 as legacy) keeps Opus reasoning with ~2.5× faster
output. Prefer it over downgrading to Sonnet when you need Opus-level judgment
but want lower latency — it does **not** swap in a smaller model. Opus 5 fast
mode is Claude API only (not Bedrock/Vertex/Foundry).

## Cross-Model: Codex

With Opus 5 as the ceiling, the remaining axis of escalation is **sideways, not
up**: a different model family. Route to the OpenAI Codex CLI via the codex
plugin (`codex:rescue` skill / `codex:codex-rescue` agent — install per
`docs/plugin.md`). Treat its output as a proposal to verify, never as ground truth.

### When to hand a subagent to Codex

Codex earns the handoff where **independence** or **grind** is the value, not
where harness-specific context is. Delegate to Codex when:

| Situation | Why Codex over another Claude subagent |
|-----------|----------------------------------------|
| Adversarial review of Claude-authored code | Claude reviewing Claude shares blind spots — same training, same failure modes. A second family is the only way to break correlation |
| Tie-break after two Claude attempts disagree | A third Claude opinion correlates with the first two; Codex doesn't |
| Large mechanical edits (rename across N files, codemod) | Offloads grind without spending Opus context; verify the diff after |
| Second diagnosis when Claude is stuck in a loop | Fresh framing beats re-prompting the model that got stuck |

Keep on a Claude subagent when the task needs harness context (rules, skills,
workload tags, project conventions), tool orchestration, or Korean-language
output — Codex starts cold on all of it.

**The rule that makes this pay off:** never let Codex be the *only* reader of
something that matters. Its value is as a disagreeing second voice; a finding
only Codex reports still needs Claude to confirm against the actual code, and
findings both families flag independently are the high-confidence ones.

**Review model: CLI default.** 2-way cross review (`/cross-review`) does not pin
the Codex axis — `codex exec` runs without `--model`, so the local CLI's
configured default applies. Name the actual model in the report. Change the
default in the Codex CLI config, not in the command.
