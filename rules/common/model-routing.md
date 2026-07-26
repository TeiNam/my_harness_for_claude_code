# Model Routing Policy

Authoritative policy for which Claude model each task and agent runs on. This
is the single source of truth; `performance.md`, `commands/model-route.md`, and
the agent frontmatter all defer to it.

## Current Lineup (2026-07, post Opus 5 launch)

| Alias | Resolves to | Character |
|-------|-------------|-----------|
| `fable` | **Fable 5** | Frontier tier above Opus. Longest-horizon agentic work, hardest verify/judge stages. Always-on thinking; $10/$50 per MTok (~2× Opus). Not a frontmatter alias — use as a per-call `model` override on the Agent tool. |
| `opus` | **Opus 5** | Deepest reasoning in the standard tiers. Architecture, ambiguity, adversarial review, hard debugging. Same price as Opus 4.8 ($5/$25). Also runs Fast mode (`/fast`) — same model, ~2.5× faster output at premium price (Claude API only). |
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
| Complex architecture | `opus` | Needs deep reasoning |
| Security analysis | `opus` | Can't afford a missed vuln |
| Ambiguous / underspecified work | `opus` | Reasoning about intent |
| Debugging system-wide bugs | `opus` | Must hold the whole system in mind |
| Overnight / long-horizon autonomous runs | `fable` | Sustains multi-hour agentic coherence |
| Final adversarial verify on high-stakes output | `fable` | Highest-ceiling judge when a miss is expensive |

**Default to Sonnet 5.** Escalate to Opus 5 when: the first Sonnet attempt
failed, the task spans 5+ files, it's an architectural decision, or it's
security-critical. Escalate further to Fable 5 only for the longest-horizon or
highest-stakes work — it costs ~2× Opus. Drop to Haiku 4.5 for anything
deterministic and low-risk.

## Agent Class → Model

The agent fleet already encodes this in frontmatter. The classes:

- **`opus`** — reasoning-heavy or high-stakes: `architect`, `planner`,
  `deep-researcher`, `security-reviewer`, and the fidelity/quality auditors
  where a missed regression is expensive (the humanize / tech-writer auditor
  and taxonomist agents).
- **`sonnet`** — implementation, review, and specialist work: the language
  reviewers, `code-*`, `devops`, `tdd-guide`, `refactor-cleaner`, writers,
  build/error resolvers.
- **`haiku`** — mechanical, high-frequency: `doc-updater`, `docs-lookup`, and
  any future search/scaffold worker.

When adding an agent, pick the class by the *worst-case* cost of a wrong
answer, not the average case. A reviewer that gates a merge is `opus` even if
most reviews are easy.

## Multi-Agent Orchestration

- Main loop / orchestrator on `fable` when the session itself runs on Fable 5
  (Claude Code main loop) — subagents inherit it unless overridden. Otherwise
  orchestrate on `sonnet` (or `opus` if the plan itself is the hard part).
- Fan-out workers on the cheapest model sufficient for their leaf task —
  usually `haiku` for search/extract, `sonnet` for edits.
- Adversarial verify / judge stages on `opus` — that's where reasoning depth
  pays for itself. Reserve `fable` for the single final judge on work where a
  missed defect is very expensive (security gate, production migration).
- Opus 5 delegates to subagents more eagerly than 4.8 — in orchestrator prompts,
  state explicitly when NOT to spawn (single-file reads, sequential steps).
- Effort routing inside a tier is cheaper than jumping tiers: `low` for
  mechanical workers, default `high`, `xhigh` for the hardest verify/judge
  stages. Try `opus` at `xhigh` before escalating to `fable`.

## Fast Mode

`/fast` (Opus 5, and Opus 4.8 as legacy) keeps Opus reasoning with ~2.5× faster
output. Prefer it over downgrading to Sonnet when you need Opus-level judgment
but want lower latency — it does **not** swap in a smaller model. Opus 5 fast
mode is Claude API only (not Bedrock/Vertex/Foundry).

## Cross-Model: Codex

For a genuinely independent second opinion (different model family, not just a
re-prompt), route to the OpenAI Codex CLI via the codex plugin
(`codex:rescue` skill / `codex:codex-rescue` agent — install per `docs/plugin.md`). Use it for
adversarial review of Claude-authored code and for large mechanical edits you
want offloaded. Treat its output as a proposal to verify, never as ground truth.
