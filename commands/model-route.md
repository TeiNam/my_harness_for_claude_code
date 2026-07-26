---
description: Recommend the best model tier for the current task based on complexity, risk, and budget.
workloads: [core]
---

# Model Route Command

Recommend the best model tier for the current task by complexity and budget.

## Usage

`/model-route [task-description] [--budget low|med|high]`

## Routing Heuristic

- `haiku` (Haiku 4.5): deterministic, low-risk mechanical changes, search
- `sonnet` (Sonnet 5): default for implementation and refactors — ~90% of coding
- `opus` (Opus 5): architecture, security, deep review, ambiguous requirements
- `fable` (Fable 5): longest-horizon autonomous runs, final high-stakes judge — ~2× Opus cost

Default to Sonnet 5; escalate to Opus 5 on failed first attempt, 5+ files,
architectural, or security-critical work; escalate to Fable 5 only when Opus 5
at `xhigh` effort isn't enough. If Opus 5 refuses (safety classifier) or lacks a
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
