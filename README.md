# my_harness_for_claude_code

Personal Claude Code harness — agents, skills, commands, hooks, rules, and MCP configs tuned to my actual workloads.

Originally assembled on 2026-05-22 from two source sets, then trimmed and rewired to run standalone — no plugin bootstrap, no upstream dependencies.

## What's here

| Folder | Purpose |
|---|---|
| `agents/` | Subagents (planner, reviewers, build-resolvers, rdbms-data-modeler, article-writer, content-creator, devops, translator-docs, deep-researcher) |
| `commands/` | Slash commands |
| `skills/` | Domain knowledge + workflow definitions |
| `rules/` | common, python, rust, typescript, web |
| `hooks/` | Hook scripts + `hooks.json` config |
| `mcp-configs/` | MCP server configurations |
| `scripts/` | Hook handlers, audits, install tooling |
| `tests/` | Test suite for the scripts |
| `docs/` | Long-form references (writing guides, security guide, steering rules for API design / dependencies / docs / observability / refactoring / Korean responses) |

## Workloads this harness targets

Python, Rust, React+Vite+TS, Obsidian plugin dev, RDBMS / MongoDB / DuckDB / DynamoDB, AWS + Bedrock, real-time STT with Hugging Face, Node, creative writing, tech blogging, PPT authoring.

## Highlight agents

- `rdbms-data-modeler` — confirms target DB (MySQL / Aurora MySQL / PG / Aurora PG) then routes to the matching guideline skill before writing any DDL
- `article-writer`, `content-creator` — writing/social workflow
- `devops` — AWS / Docker / Terraform / K8s with dry-run-first discipline
- `translator-docs` — KO / EN translation + docs
- `deep-researcher` — cited multi-source web research

## Highlight skills

- `postgres-guideline/` · `mysql-guideline/` · `mongodb-guideline/` · `dynamodb-guideline/` — schema / index / partitioning / sharding / connection
- `obsidian-plugin-develop/` — TypeScript + i18n + Chromium + release checklist
- `fastapi-backend-best-practices/` — 7 sub-areas (api-design, async-patterns, deployment, domain-modeling, project-structure, security, testing)
- `claude-api/` — Anthropic SDK patterns (Python + TS, streaming, tool use, caching)
- `markdown-writing/`, `foundation-models-on-device/`, `ai-regression-testing/`

## Still placeholder skills (fill as you go)

`duckdb-patterns`, `aws-cloud`, `aws-bedrock`, `realtime-stt-huggingface`, `python-data-analysis`, `ppt-authoring`, `creative-writing`, `tech-blogging`.

## Install

This harness installs into `~/.claude/` via symlinks. Edits in this repo take effect immediately.

```bash
./install.sh                 # install
./install.sh --dry-run       # preview
./install.sh --uninstall     # remove
./install.sh --force         # overwrite existing files at the target
```

PowerShell version: `install.ps1` (requires Windows 10+ Developer Mode or Administrator).

Hooks in `hooks/hooks.json` are NOT auto-installed — merge them into `~/.claude/settings.json` by hand. `hooks/prompt-pack.json` is a separate prompt-reference file (not runnable) you can paste into a session or fold into `CLAUDE.md`; see `hooks/README-prompt-pack.md`.

## See also

`CLAUDE.md` — what Claude Code reads at session start.
