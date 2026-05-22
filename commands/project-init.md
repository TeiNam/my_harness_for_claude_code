---
description: Detect a project's stack and produce a dry-run harness onboarding plan.
---

# /project-init

Create a safe, reviewable harness onboarding plan for the current project. This command should start in dry-run mode and only write files after explicit user approval.

## Usage

```text
/project-init
/project-init --dry-run
```

## Safety Rules

1. Default to dry-run. Do not modify `CLAUDE.md`, settings files, rules, skills, or install state until the user approves the concrete plan.
2. Preserve existing project guidance. If `CLAUDE.md` or `.claude/settings.local.json` already exists, inspect it and propose a merge/append plan instead of overwriting.
3. Use the harness installer (`./install.sh`). Do not hand-copy files or clone arbitrary remotes as an install shortcut.
4. Keep permissions narrow. Any generated settings should match detected build/test/lint tools and avoid broad shell access.
5. Report exactly what would change before applying anything.

## Detection Inputs

Read the current project root and detect stack signals from:

- package manager files: `package.json`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`
- language manifests: `pyproject.toml`, `requirements.txt`, `go.mod`, `Cargo.toml`, `pom.xml`, `build.gradle`, `build.gradle.kts`
- framework files: `next.config.*`, `vite.config.*`, `tailwind.config.*`, `Dockerfile`, `docker-compose.yml`

## Planning Flow

1. Detect stacks from project files and show the evidence for each match.
2. Map detected stacks to the relevant harness rules and skills (e.g. `rules/python/`, `rules/typescript/`, `skills/postgres-guideline/`).
3. Run the harness install in dry-run mode:

```bash
./install.sh --dry-run
```

4. Summarize detected stacks, recommended rules/skills, target paths, and files that would be changed.
5. Ask for approval before running `./install.sh` without `--dry-run`.

## Output Contract

Return:

1. detected stack evidence
2. recommended rules/skills based on stacks
3. exact dry-run command used
4. exact apply command to run after approval
5. files/directories that would be created or changed
6. warnings about existing files, broad permissions, or missing scripts

## CLAUDE.md Guidance

If the user wants a `CLAUDE.md` starter, generate it separately from the installer plan and keep it minimal:

- build command, if detected
- test command, if detected
- lint/typecheck command, if detected
- dev server command, if detected
- repo-specific notes from existing package scripts or manifests

Never replace an existing `CLAUDE.md` without showing a diff and receiving approval.

## Related

- `install.sh` / `install.ps1` for symlink-based install
- `rules/`, `skills/`, `agents/` for content the installer surfaces
