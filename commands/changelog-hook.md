---
description: Install a native git pre-commit hook that regenerates CHANGELOG.md grouped by commit date
argument-hint: [target-dir | blank for current repo]
workloads: [core]
---

# Install changelog pre-commit hook

Install a dependency-free git `pre-commit` hook into the target repo (`$1`, or
the current repo). It rebuilds `CHANGELOG.md` from `git log`, grouped by commit
date, and stages it into the commit being created — so it ships in the same
commit and pushes (CLI **or** GitKraken / any GUI) automatically. Native git
hooks run for every client, unlike Claude Code hooks which only fire on Claude's
own tool calls.

## Steps

1. Resolve the repo root: `git -C "${1:-.}" rev-parse --show-toplevel`. If it
   fails, stop — not a git repo.

2. Check `git -C <root> config core.hooksPath`. If already set to something
   other than `.githooks`, warn the user (their hooks live elsewhere) and ask
   before overriding. Otherwise create `<root>/.githooks/` and set
   `git -C <root> config core.hooksPath .githooks`.

3. Write `<root>/.githooks/pre-commit` with the script below and `chmod +x` it.

4. Verify: run `git -C <root> commit --allow-empty -m "chore: test changelog hook"`,
   confirm `CHANGELOG.md` is part of that commit
   (`git -C <root> show --stat HEAD`), then `git -C <root> reset --hard HEAD~1`
   to undo the test commit. Report the generated CHANGELOG head to the user.

## Hook script

```sh
#!/bin/sh
# pre-commit: rebuild CHANGELOG.md grouped by commit date, stage into THIS commit.
git_dir=$(git rev-parse --git-dir 2>/dev/null) || exit 0
for state in rebase-merge rebase-apply MERGE_HEAD CHERRY_PICK_HEAD; do
  [ -e "$git_dir/$state" ] && exit 0
done

root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
out="$root/CHANGELOG.md"

# No commits yet (initial commit) → git log fails; exit quietly.
git rev-parse HEAD >/dev/null 2>&1 || exit 0

{
  printf '# Changelog\n\nAll notable changes, grouped by commit date.\n'
  git log --date=short --pretty=format:'%cd%x1f%s%x1f%h' | awk -F'\037' '
    $1 != prev { printf "\n## %s\n\n", $1; prev = $1 }
    { printf "- %s (%s)\n", $2, $3 }
  '
  printf '\n'
} > "$out" || exit 0

git add "$out" 2>/dev/null
exit 0
```

## Notes

- **One-line lag**: the commit being created isn't in `git log` yet (no hash),
  so its own line appears on the *next* commit. Everything before it is in this
  commit. No extra commit needed — it rides your normal commits.
- **`.gitignore`**: do NOT ignore `CHANGELOG.md` — it must be tracked to push.
- Works with GitKraken, SourceTree, CLI, IDE git — all honor `core.hooksPath`.
```
