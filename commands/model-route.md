---
description: Recommend the best model tier for the current task based on complexity, risk, and budget.
workloads: [core]
---

# Model Route Command

Recommend the best model tier for the current task by complexity and budget.

## Usage

`/model-route [task-description] [--budget low|med|high]`

## Routing Heuristic

First ask: **is the box open or closed?** Reasoning depth only pays when the
shape of the answer is undecided. Criteria already supplied, or cause and fix
already established → nothing left to search → `sonnet`.

- `haiku` (Haiku 4.5): deterministic, low-risk mechanical changes, search
- `sonnet` (Sonnet 5): default — implementation, refactors, scanning against a
  supplied rubric, rewriting what a detector already flagged, applying a fix
  whose cause is known (~90% of coding)
- `opus` (Opus 5.5, default effort `medium`): architecture, security, deep/adversarial review, ambiguous
  requirements, diagnosing an unknown cause, judging whether meaning survived
- `fable` (Fable 5.1): the one rung above Opus (~2.5× per token) — a single final-judge
  call on an unrecoverable-miss gate after `opus` at `xhigh`/`max` still missed;
  never a standing agent assignment
- Codex (cross-family): independent second opinion, tie-break, mechanical grind — not a Claude tier

Tier **per stage, not per pipeline**: detect → fix → judge is
`sonnet` → `sonnet` → `opus`, not `opus` × 3.

Default to Sonnet 5; escalate to Opus 5.5 on failed first attempt, 5+ files,
architectural, or security-critical work. Past Opus the ladder is: raise
**effort** (`high` → `xhigh` → `max`) → `fable` for one unrecoverable-miss
judging call → a cross-family opinion from Codex. If Opus/Fable refuses
(safety classifier), fall back per model-routing.md → Refusals and fallback
(Fable 5.1 → Opus 4.8 / Opus 5). Fast mode keeps Opus reasoning at lower
latency — Claude API only, so not on Bedrock. For a
cross-family second opinion, route to Codex (codex plugin — `codex:rescue`).

**Factor the current session model** (visible in the environment — Fable 5.1 and
Opus 5.5 both serve as the daily main). Switching up (Opus 5.5 → Fable 5.1)
mid-session keeps thinking; to come down, recommend a fresh session.
Alias resolution is provider-dependent (Bedrock: `sonnet` → Sonnet 4.5 unless
`ANTHROPIC_DEFAULT_SONNET_MODEL` is pinned) — name the model that will actually run. The tier recommendation is
session-agnostic, but the *route to it* is not: on a Fable session the `fable`
rung is a `fork` (inherits the model, shares prompt cache — forks always
inherit and ignore overrides); on an Opus/Sonnet session, reach it with a
one-off `model: fable` override on the Agent call. A rung the session already
runs on is always cheapest via fork.

Full policy: `docs/rules-reference/model-routing.md`.

## Required Output

- recommended model
- confidence level
- why this model fits
- how to reach it from the current session model (fork vs per-call override)
- fallback model if first attempt fails

## Arguments

$ARGUMENTS:
- `[task-description]` optional free-text
- `--budget low|med|high` optional
