# Model Routing Policy

Authoritative policy for which Claude model each task and agent runs on. This
is the single source of truth; `performance.md`, `commands/model-route.md`, and
the agent frontmatter all defer to it.

## Current Lineup (2026-07)

| Alias | Resolves to | Character |
|-------|-------------|-----------|
| `opus` | **Opus 4.8** | Deepest reasoning. Architecture, ambiguity, adversarial review, hard debugging. Also runs Fast mode (`/fast`) — same model, faster output. |
| `sonnet` | **Sonnet 5** | Best coding model. Default for implementation, refactors, PR review. Handles ~90% of coding. |
| `haiku` | **Haiku 4.5** | ~90% of Sonnet's capability at ~3× cost savings. Mechanical edits, search, doc scaffolding, high-frequency workers. |

> **Use aliases, never version IDs.** Agent frontmatter must say `model: sonnet`,
> not `model: claude-sonnet-5`. Aliases auto-resolve to the current lineup, so
> the harness follows model upgrades without a mass re-tag. The one place a
> pinned ID belongs is application code calling the API (see `skills/claude-api`).

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

**Default to Sonnet 5.** Escalate to Opus 4.8 when: the first Sonnet attempt
failed, the task spans 5+ files, it's an architectural decision, or it's
security-critical. Drop to Haiku 4.5 for anything deterministic and low-risk.

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

- Orchestrator on `sonnet` (or `opus` if the plan itself is the hard part).
- Fan-out workers on the cheapest model sufficient for their leaf task —
  usually `haiku` for search/extract, `sonnet` for edits.
- Adversarial verify / judge stages on `opus` — that's where reasoning depth
  pays for itself.

## Fast Mode

`/fast` (Opus 4.8/4.7) keeps Opus reasoning with faster output. Prefer it over
downgrading to Sonnet when you need Opus-level judgment but want lower latency —
it does **not** swap in a smaller model.

## Cross-Model: Codex

For a genuinely independent second opinion (different model family, not just a
re-prompt), route to the OpenAI Codex CLI via `skills/codex-cli`. Use it for
adversarial review of Claude-authored code and for large mechanical edits you
want offloaded. Treat its output as a proposal to verify, never as ground truth.
