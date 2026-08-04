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
- `opus` (Opus 5): architecture, security, deep/adversarial review, ambiguous
  requirements, diagnosing an unknown cause, judging whether meaning survived
- Codex (cross-family): independent second opinion, tie-break, mechanical grind — not a Claude tier

Tier **per stage, not per pipeline**: detect → fix → judge is
`sonnet` → `sonnet` → `opus`, not `opus` × 3.

Default to Sonnet 5; escalate to Opus 5 on failed first attempt, 5+ files,
architectural, or security-critical work. Opus 5 is the ceiling — past it raise
**effort** (`high` → `xhigh` → `max`), then get a cross-family opinion from
Codex rather than looking for a higher Claude tier. If Opus 5 refuses (safety classifier) or lacks a
needed feature (web fetch, Priority Tier), fall back to Opus 4.8. Fast mode keeps
Opus reasoning at lower latency — prefer it over downgrading when you need
Opus-level judgment fast. For a cross-family second opinion, route to Codex
(codex plugin — `codex:rescue`).

Full policy: `rules/common/model-routing.md`.

## Required Output

- recommended model
- confidence level
- why this model fits
- fallback model if first attempt fails

## Arguments

$ARGUMENTS:
- `[task-description]` optional free-text
- `--budget low|med|high` optional
