---
paths:
  - "**/*.py"
  - "**/*.pyi"
workloads: [python-backend, python-data]
---
# Python Coding Style

> This file extends [common/coding-style.md](../common/coding-style.md) with Python specific content.

## Environment: uv First (MANDATORY)

All Python environment and dependency management goes through **uv** — never bare `pip`, `python -m venv`, `virtualenv`, or `conda`.

Before any Python work, check uv exists and bootstrap if missing:

```bash
command -v uv >/dev/null || curl -LsSf https://astral.sh/uv/install.sh | sh
```

Then:

```bash
uv init            # new project (creates pyproject.toml)
uv venv            # create .venv (existing project without one)
uv add <pkg>       # add dependency (writes pyproject.toml + uv.lock)
uv add --dev <pkg> # dev dependency
uv sync            # install from lockfile
uv run <cmd>       # run inside the env — no manual activation needed
```

- One-off tool without installing: `uvx <tool>` (e.g. `uvx ruff check .`).
- Never mix `pip install` into a uv-managed env — it bypasses the lockfile.
- Legacy `requirements.txt` project: `uv pip install -r requirements.txt` is the transitional form; prefer migrating to `pyproject.toml` + `uv add`.
- One-off script that needs a package: `uv run --no-project --with <pkg> python script.py` — nothing is installed globally, and `--no-project` keeps uv from creating a `uv.lock`/`.venv` in whatever project you are standing in.
- No exceptions for other tools. If a project uses `poetry`, `pdm`, `pipenv`, `conda`, or bare `pip` + `requirements.txt`, propose moving it to uv first — `uvx migrate-to-uv` for Poetry, Pipenv, pip-tools, and pip; for PDM or Conda, `uv init` and re-add the dependencies from the old manifest with `uv add`. Review the diff and remove the old lockfile in the same commit. Until the user agrees, change nothing about its dependencies — do not run the old tool and do not add a `uv.lock` beside its lockfile.
- Python itself also comes from uv (`uv python install`), not pyenv or the system installer.

### Python Version

- Prefer a **well-supported stable Python** — not a pre-release, not an
  end-of-life minor. Python has no formal "LTS"; each minor gets ~5 years of
  support, so pick one still in active bugfix/security support.
- **Check the web for the current recommended/supported version before
  installing** — the target minor moves each year, so don't hardcode it.

```bash
uv python list                  # available versions
uv python install <version>     # install the version you verified
```

## Standards

- Follow **PEP 8** conventions
- Use **type annotations** on all function signatures

## Immutability

Prefer immutable data structures:

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class User:
    name: str
    email: str

from typing import NamedTuple

class Point(NamedTuple):
    x: float
    y: float
```

## Formatting

- **black** for code formatting
- **isort** for import sorting
- **ruff** for linting

## Reference

See skill: `python-patterns` for comprehensive Python idioms and patterns.
