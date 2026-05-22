# CLAUDE.md

Guidance for Claude Code working in this repository.

## Project Overview

Personal Claude Code harness — a curated set of agents, skills, commands, hooks, rules, and MCP configs tailored to the owner's workloads.

This is **not** a published plugin. It is a working, standalone harness: trim, edit, and rewrite freely.

## Owner's Primary Workloads

When picking agents/skills/rules to apply, bias toward what's relevant to these:

- **Python**: general coding, data analysis (pandas/polars/duckdb), FastAPI
- **Rust**: general coding
- **Frontend**: React + Vite + TypeScript, Obsidian plugin development
- **Data**: RDBMS modeling (Postgres/MySQL), MongoDB, DuckDB
- **Cloud / AI**: AWS, Amazon Bedrock, Hugging Face models for real-time speech transcription
- **Node.js**: server + tooling
- **Writing**: creative writing, tech blogging, presentation (PPT) authoring

## Layout

- `agents/` — subagents available for delegation
- `skills/` — domain knowledge / workflow definitions
- `commands/` — slash commands (markdown with `description:` frontmatter)
- `hooks/` — trigger-based hook configs (JSON + handler scripts)
- `rules/` — always-follow guidelines (common + per-language)
- `mcp-configs/` — MCP server configurations
- `scripts/` — Node.js utilities for hooks, install/uninstall, audits
- `tests/` — test suite for `scripts/`
- `docs/` — long-form reference (writing guides, security guide, steering rules)

## High-value Agents

- `rdbms-data-modeler` — forces target-DB confirmation (Aurora MySQL / MySQL / Aurora PG / PG), then routes to `mysql-guideline` or `postgres-guideline` skill before writing DDL.
- `article-writer` — long-form articles, guides, blog posts, newsletters in distinctive voice
- `content-creator` — platform-native social content (X, LinkedIn, newsletter, video scripts)
- `devops` — AWS / Docker / Terraform / K8s; always plans/dry-runs before mutations
- `translator-docs` — Korean / English bidirectional translation + README/API docs
- `deep-researcher` — multi-source web research with citations

The longer reviewer/architect agents (`code-reviewer`, `python-reviewer`, `typescript-reviewer`, `rust-reviewer`, `architect`, etc.) are kept alongside shorter counterparts — they overlap but are more detailed.

## High-value Skills for Owner's Workloads

Filled-in (real content, not placeholder):

- **DB**: `skills/postgres-guideline/`, `skills/mysql-guideline/`, `skills/mongodb-guideline/`, `skills/dynamodb-guideline/` — schema / index / partitioning / sharding / connection
- **Frontend**: `skills/obsidian-plugin-develop/` (TypeScript + i18n + Chromium + release checklist), `skills/vite-patterns/`, `skills/frontend-patterns/`
- **AI**: `skills/claude-api/` (Anthropic SDK), `skills/foundation-models-on-device/`, `skills/ai-regression-testing/`, `skills/cost-aware-llm-pipeline/`, `skills/aws-bedrock/`, `skills/realtime-stt-huggingface/`
- **Cloud**: `skills/aws-cloud/` (IAM, S3, Lambda, ECS/Fargate, RDS, networking, cost guardrails)
- **Backend**: `skills/fastapi-backend-best-practices/` (api-design, async-patterns, deployment, domain-modeling, project-structure, security, testing), `skills/python-patterns/`, `skills/rust-patterns/`
- **Writing**: `skills/markdown-writing/`, `skills/article-writing/`, `skills/brand-voice/`, `skills/crosspost/`, `skills/frontend-slides/`, `skills/tech-blogging/`, `skills/creative-writing/`, `skills/ppt-authoring/`

## Still Placeholder Skills

None — all previously-scaffolded skills are now filled in. If new placeholders
are added later, list them here so they're easy to find and complete.

## Hooks (status)

- `hooks/hooks.json` — main hook stack. Install via `./install.sh --with-hooks` (or `install.ps1 -WithHooks`), which merges entries into `~/.claude/settings.json` keyed by `id`. Re-runs are idempotent; user-added entries are preserved. `--with-hooks --dry-run` previews the change; `--with-hooks --uninstall` removes only harness-owned ids.
- `scripts/install/merge-hooks.js` — the underlying merger; can be called directly when you don't want the symlink step. Tests live at `tests/scripts/install/merge-hooks.test.js`.
- `hooks/prompt-pack.json` — two reference-only prompts (`ref:pre-write-guard`, `ref:review-on-stop`). Not runnable; see `hooks/README-prompt-pack.md` for what they overlap with and how to wire them up if needed.

## Running Tests

```bash
node tests/run-all.js
node tests/lib/utils.test.js
node tests/hooks/hooks.test.js
```

## Key Commands (subset)

- `/tdd-workflow` (skill) / `/plan` / `/feature-dev` — start work
- `/code-review` / `/python-review` / `/rust-review` / `/fastapi-review`
- `/build-fix` / `/rust-build` / `/test-coverage`
- `/refactor-clean` / `/security-scan` / `/quality-gate`
- `/skill-create` / `/skill-health` / `/learn`
- `/save-session` / `/resume-session` / `/checkpoint`

## Language

@rules/common/korean-language.md

## README Conventions

@rules/common/readme-rule.md

## Code Style (Node parts)

- Node.js >=18, plain CommonJS in `scripts/`
- No TypeScript in this harness's own scripts (plain `.js`)
- File naming: lowercase with hyphens
- Hook scripts: prefer small, focused scripts (~200 lines is a good target for new hooks). Larger files are fine for orchestrators, lifecycle hooks (session-start, mcp-health-check), and gates (gateguard, block-no-verify) — split when a single file mixes concerns, not just because it's long.
- Hook scripts must exit 0 on non-critical errors so they never block the user's tool call.

## Origin

Originally assembled on 2026-05-22 from two sources, then trimmed to remove plugin-bootstrap dependencies and run standalone. Selection criteria: only what maps to the workloads above. Enterprise/healthcare/blockchain/mobile-only material was intentionally left out.

Some files still carry references to the original projects — replace as you customize.
