---
description: Comprehensive PR review using specialized agents
workloads: [core]
---

Run a comprehensive multi-perspective review of a pull request.

## Usage

`/review-pr [PR-number-or-URL] [--focus=comments|tests|errors|types|code|simplify]`

If no PR is specified, review the current branch's PR. If no focus is specified, run the full review stack.

## Steps

1. Identify the PR:
   - use `gh pr view` to get PR details, changed files, and diff
2. Find project guidance:
   - look for `CLAUDE.md`, lint config, TypeScript config, repo conventions
3. Run review agents:
   - `code-reviewer` — the primary reviewer. It now folds in the error-handling,
     type-design, and comment lenses. Map `--focus` to its lenses:
     - `--focus=errors` / `types` / `comments` / `code` → `code-reviewer` restricted to that lens (or full checklist for `code`)
     - no focus → `code-reviewer` full review (all lenses)
   - `pr-test-analyzer` — test coverage/quality (distinct from code-reviewer; keep separate). Runs unless `--focus` excludes it.
   - `refactor-cleaner` — dead code / duplication (`--focus=simplify`).
4. Aggregate results:
   - dedupe overlapping findings
   - rank by severity
5. Report findings grouped by severity

## Confidence Rule

Only report issues with confidence >= 80:

- Critical: bugs, security, data loss
- Important: missing tests, quality problems, style violations
- Advisory: suggestions only when explicitly requested
