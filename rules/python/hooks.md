---
paths:
  - "**/*.py"
  - "**/*.pyi"
workloads: [python-backend, python-data]
---
# Python Hooks

> This file extends [common/hooks.md](../common/hooks.md) with Python specific content.

## PostToolUse Hooks

Configure in `~/.claude/settings.json`. Run tools through the project's uv env (`uv run ruff`, `uv run mypy`) or standalone via `uvx` — not bare global installs:

- **black/ruff**: Auto-format `.py` files after edit (`uv run ruff format` / `uvx ruff format`)
- **mypy/pyright**: Run type checking after editing `.py` files (`uv run mypy`)

## Warnings

- Warn about `print()` statements in edited files (use `logging` module instead)
