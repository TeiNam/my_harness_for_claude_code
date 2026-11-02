# Coding Style

## Immutability (CRITICAL)

ALWAYS create new objects, NEVER mutate existing ones:

```
// Pseudocode
WRONG:  modify(original, field, value) → changes original in-place
CORRECT: update(original, field, value) → returns new copy with change
```

Rationale: Immutable data prevents hidden side effects, makes debugging easier, and enables safe concurrency.

## Core Principles

### KISS (Keep It Simple)

- Prefer the simplest solution that actually works
- Avoid premature optimization
- Optimize for clarity over cleverness

### DRY (Don't Repeat Yourself)

- Extract repeated logic into shared functions or utilities
- Avoid copy-paste implementation drift
- Introduce abstractions when repetition is real, not speculative

### YAGNI (You Aren't Gonna Need It)

- Do not build features or abstractions before they are needed
- Avoid speculative generality
- Start simple, then refactor when the pressure is real

## File Organization

MANY SMALL FILES > FEW LARGE FILES:
- High cohesion, low coupling
- 200-400 lines typical, 800 max
- Extract utilities from large modules
- Organize by feature/domain, not by type

## Error Handling

ALWAYS handle errors comprehensively:
- Handle errors explicitly at every level
- Provide user-friendly error messages in UI-facing code
- Log detailed error context on the server side
- Never silently swallow errors

## Input Validation

ALWAYS validate at system boundaries:
- Validate all user input before processing
- Use schema-based validation where available
- Fail fast with clear error messages
- Never trust external data (API responses, user input, file content)

## Naming Conventions

- Variables and functions: `camelCase` with descriptive names
- Booleans: prefer `is`, `has`, `should`, or `can` prefixes
- Interfaces, types, and components: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Custom hooks: `camelCase` with a `use` prefix

## Code Smells to Avoid

### Deep Nesting

Prefer early returns over nested conditionals once the logic starts stacking.

### Magic Numbers

Use named constants for meaningful thresholds, delays, and limits.

### Long Functions

Split large functions into focused pieces with clear responsibilities.

## Dependencies — Latest Stable

In every language, use the latest stable release of each library or package you add, install, or update.

- Look the version up at the time of writing; versions from training data are stale. Prefer commands that resolve it (`npm i <pkg>`, `uv add <pkg>`, `cargo add <crate>`, `go get <mod>@latest`), or check the registry (`npm view <pkg> dist-tags`, PyPI `https://pypi.org/pypi/<pkg>/json` → `info.version`, `cargo search <crate> --limit 1`).
- Stable only: no alpha/beta/rc/canary unless asked. A registry's `latest` tag can point at a pre-release, so check it.
- Stay within the project's declared constraints (`engines`, `rust-version`, `requires-python`, peer dependencies). If the latest needs a newer toolchain, use the newest compatible version and say so.
- When you touch an existing dependency, move it to the latest stable too. Read the changelog for a major bump, put the upgrade in its own commit, and run the tests.
- Python always goes through uv, in any project: `uv add` / `uv sync` / `uv run --no-project --with <pkg>` / `uvx <tool>` / `uv tool install` / `uv python install` — never `pip`, `pipx`, `poetry`, `pipenv`, `conda`, or `python -m venv`. Details in `rules/python/coding-style.md`.

## Tool Use

- Batch independent reads, searches, and commands into one turn as parallel tool calls instead of one call per turn.
- For small changes, edit only the affected lines; rewrite a whole file only when most of it changes.

## Code Quality Checklist

Before marking work complete:
- [ ] Code is readable and well-named
- [ ] Functions are small (<50 lines)
- [ ] Files are focused (<800 lines)
- [ ] No deep nesting (>4 levels)
- [ ] Proper error handling
- [ ] No hardcoded values (use constants or config)
- [ ] No mutation (immutable patterns used)
- [ ] New or updated dependencies are on the latest stable version (checked, not recalled)
