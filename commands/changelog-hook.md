---
description: Install a native git post-commit hook that regenerates CHANGELOG.md grouped by commit date
argument-hint: [target-dir | blank for current repo]
workloads: [core]
---

# Install changelog post-commit hook

Install a dependency-free git `post-commit` hook into the target repo (`$1`, or
the current repo). It rebuilds `CHANGELOG.md` from `git log`, grouped by commit
date, and stages it so the next commit carries it — push (CLI **or** GitKraken /
any GUI) sends it automatically. Native git hooks run for every client, unlike
Claude Code hooks which only fire on Claude's own tool calls.

## Steps

1. Resolve the repo root: `git -C "${1:-.}" rev-parse --show-toplevel`. If it
   fails, stop — not a git repo.

2. Check `git -C <root> config core.hooksPath`. If already set to something
   other than `.githooks`, warn the user (their hooks live elsewhere) and ask
   before overriding. Otherwise create `<root>/.githooks/` and set
   `git -C <root> config core.hooksPath .githooks`.

3. Write `<root>/.githooks/post-commit` with the script below and `chmod +x` it.

4. Verify: run `git -C <root> commit --allow-empty -m "chore: test changelog hook"`,
   confirm `CHANGELOG.md` was created/updated, then
   `git -C <root> reset --hard HEAD~1` to undo the test commit. Report the
   generated CHANGELOG head to the user.

## Hook script

```sh
#!/bin/sh
# post-commit: rebuild CHANGELOG.md grouped by commit date, then stage it.
# Lands on the NEXT commit (no amend → safe during rebase/merge/cherry-pick).
git_dir=$(git rev-parse --git-dir 2>/dev/null) || exit 0
for state in rebase-merge rebase-apply MERGE_HEAD CHERRY_PICK_HEAD; do
  [ -e "$git_dir/$state" ] && exit 0
done

root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
out="$root/CHANGELOG.md"

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

- **One-commit lag**: the latest commit's own line appears on the *next* commit
  (the hook can't stage into the commit that triggered it without amending).
  Acceptable for a date-grouped log; to avoid it, replace the final `git add`
  with a guarded `--amend --no-verify` (loses the safety of not rewriting HEAD).
- **`.gitignore`**: do NOT ignore `CHANGELOG.md` — it must be tracked to push.
- Works with GitKraken, SourceTree, CLI, IDE git — all honor `core.hooksPath`.
```
