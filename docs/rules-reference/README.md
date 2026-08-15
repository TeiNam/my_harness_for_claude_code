# Rules

## The one rule about rules

**An installed rule without `paths:` frontmatter is loaded into every session of every
project.** `rules/` is therefore a context budget, not a documentation folder. Anything
that is only true *sometimes* — a procedure, a checklist, a policy you consult when the
topic comes up — belongs in `docs/rules-reference/` (this folder) and gets read on demand.

## Structure

```
rules/
├── common/          # ALWAYS loaded, every session. Invariants only, <12KB total.
│   ├── coding-style.md      # immutability, file size, naming
│   ├── git-workflow.md      # branch → commit → push → PR → merge
│   ├── korean-language.md   # output language
│   └── security.md          # secrets, input validation
├── typescript/      # gated on **/*.ts, **/*.tsx, **/*.js, **/*.jsx
├── python/          # gated on **/*.py
├── rust/            # gated on **/*.rs
└── web/             # gated on **/*.tsx, **/*.css, **/*.html, …

docs/rules-reference/   # NOT installed → costs no context. Read when relevant.
├── testing.md · patterns.md · performance.md · hooks.md
├── code-review.md · development-workflow.md · agents.md
├── model-routing.md · readme-rule.md
└── README.md (this file)
```

- **common/** contains universal principles — no language-specific code examples. Two tests
  in `tests/scripts/install/workloads.test.js` enforce the whitelist and the size budget,
  and require every non-common rule file to declare `paths:`.
- **Language directories** extend the reference docs with framework-specific patterns and
  code examples. Each file links to its counterpart under `../../docs/rules-reference/`.

## Installation

### Option 1: Install Script (Recommended)

There is no rules-only flag. A rule directory is tagged with `workloads:` like any other asset,
so it arrives with the workload that owns it:

```bash
./install.sh --dev=frontend           # rules/typescript/ + rules/web/  (workload: frontend)
./install.sh --dev=python             # rules/python/                   (workload: python-backend)
./install.sh --dev=rust               # rules/rust/                     (workload: rust)
./install.sh --dev=frontend,python    # both
./install.sh --data=python-data       # the python-data-tagged rule file
```

`rules/common/` carries no `workloads:` tag — it is baseline and installs regardless of what you
select. The four language directories are the only ones that exist; see the Structure block above.

### Option 2: Manual Installation

> **Important:** Copy entire directories — do NOT flatten with `/*`.
> Common and language-specific directories contain files with the same names.
> Flattening them into one directory causes language-specific files to overwrite
> common rules, and breaks the relative `../common/` references used by
> language-specific files.
>
> Use the harness-owned namespace below for user-level Claude installs. Flat
> package-level destinations can collide with other rule packs and do not
> match the main README guidance.

```bash
# Create the harness rule namespace once.
mkdir -p ~/.claude/rules/_harness

# Install common rules (required for all projects)
cp -r rules/common ~/.claude/rules/_harness/

# Install language-specific rules based on your project's tech stack.
# These four are the only language directories in this harness.
cp -r rules/typescript ~/.claude/rules/_harness/
cp -r rules/python ~/.claude/rules/_harness/
cp -r rules/rust ~/.claude/rules/_harness/
cp -r rules/web ~/.claude/rules/_harness/

# Copy only what your project actually uses — every installed rule costs context.
```

For project-local rules, use the same namespace under the project root:

```bash
mkdir -p .claude/rules/_harness
cp -r rules/common .claude/rules/_harness/
cp -r rules/typescript .claude/rules/_harness/
```

## Rules vs Skills

- **Rules** define standards, conventions, and checklists that apply broadly (e.g., "80% test coverage", "no hardcoded secrets").
- **Skills** (`skills/` directory) provide deep, actionable reference material for specific tasks (e.g., `python-patterns`, `rust-testing`).

Language-specific rule files reference relevant skills where appropriate. Rules tell you *what* to do; skills tell you *how* to do it.

## Adding a New Language

To add support for a new language (e.g., `go/`):

1. Create a `rules/go/` directory
2. Add files that extend the common rules:
   - `coding-style.md` — formatting tools, idioms, error handling patterns
   - `testing.md` — test framework, coverage tools, test organization
   - `patterns.md` — language-specific design patterns
   - `hooks.md` — PostToolUse hooks for formatters, linters, type checkers
   - `security.md` — secret management, security scanning tools
3. Add a YAML frontmatter block so the rule auto-loads when matching files are
   edited, plus a `workloads:` tag for install selection:
   ```
   ---
   paths:
     - "**/*.go"
   workloads: [go]
   ---
   ```
   - `paths:` is a list of globs. Claude Code loads the rule automatically when
     an edited file matches. Use the language's file extensions.
   - **Every non-common rule file must declare `paths:`** — all four language
     directories do (typescript 5/5, python 6/6, rust 5/5, web 7/7), and
     `tests/scripts/install/workloads.test.js` enforces it. `common/` is the only
     exception: it is language-agnostic and always loaded, which is exactly why it
     is capped at four files.
4. After the frontmatter, each file should start with:
   ```
   > This file extends [common/xxx.md](../common/xxx.md) with <Language> specific content.
   ```
5. Reference existing skills if available, or create new ones under `skills/`.

For non-language domains like `web/`, follow the same layered pattern when there is enough reusable domain-specific guidance to justify a standalone ruleset.

## Rule Priority

When language-specific rules and common rules conflict, **language-specific rules take precedence** (specific overrides general). This follows the standard layered configuration pattern (similar to CSS specificity or `.gitignore` precedence).

- `rules/common/` defines universal defaults applicable to all projects.
- `rules/python/`, `rules/rust/`, `rules/typescript/`, `rules/web/` override those defaults where language idioms differ.

### Example

`common/coding-style.md` recommends immutability as a default principle. A language-specific `python/coding-style.md` can override this:

> pandas and numpy expose in-place operations (`df.drop(..., inplace=True)`, `arr += 1`) that are idiomatic in analysis code — see [common/coding-style.md](../common/coding-style.md) for the general principle, but in-place mutation is acceptable on a locally-owned frame.

### Common rules with override notes

Rules in `rules/common/` that may be overridden by language-specific files are marked with:

> **Language note**: This rule may be overridden by language-specific rules for languages where this pattern is not idiomatic.
