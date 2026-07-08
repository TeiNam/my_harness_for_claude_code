---
name: codex-cli
description: Run OpenAI's Codex CLI (codex exec / resume) from inside Claude Code for a cross-model second opinion, adversarial code review, or large mechanical edits. Use when the user says "codex", "ask codex", "second opinion", "have another model check this", or wants heavy refactors offloaded to a different model family.
origin: harness
workloads: [core]
---

# Codex CLI

Codex is OpenAI's coding CLI (`codex`). Running it from inside Claude Code buys
one thing Claude can't give itself: a **genuinely independent opinion from a
different model family**. Use it for adversarial review of Claude-authored code,
tie-breaking a hard decision, or offloading a large mechanical edit.

Treat Codex as a peer, not an authority — see [rules/common/model-routing.md](../../rules/common/model-routing.md#cross-model-codex).

## Preflight

```bash
codex --version   # confirm installed; stop and report if this exits non-zero
```

If Codex isn't on PATH, tell the user to install it (`npm i -g @openai/codex`
or Homebrew) — don't try to work around a missing binary.

## The one-liner that always works

```bash
codex exec --skip-git-repo-check --sandbox read-only "your prompt" </dev/null 2>/dev/null
```

Three details that are non-negotiable:

- **`</dev/null`** — `codex exec` reads stdin and concatenates it with the
  positional prompt. In a non-TTY harness, if stdin is never closed the process
  hangs *forever* (symptom: zero stdout, zero CPU, looks frozen). Always
  redirect stdin from `/dev/null` unless you're deliberately piping.
- **`2>/dev/null`** — suppresses thinking tokens (stderr). Drop it only when the
  user asks to see reasoning or you're debugging.
- **`--skip-git-repo-check`** — always pass it.

Prefer running **synchronously** — Codex emits output only at completion, so a
backgrounded run that gets killed leaves a silently empty file. The turn waits
for the result anyway.

## Sandbox modes — pick the least power needed

| Task | Flags |
|------|-------|
| Review / analysis (default) | `--sandbox read-only` |
| Apply edits in this repo | `--sandbox workspace-write --full-auto` |
| Needs network / broad access | `--sandbox danger-full-access --full-auto` |

Before using `--full-auto`, `--sandbox danger-full-access`, or writing outside
the repo, get explicit user approval (AskUserQuestion) unless already granted.
`-C <DIR>` runs from another directory.

## Model + effort

Codex model/effort are the user's call, not yours to assume. When it matters,
ask once (single AskUserQuestion, two questions): model (`gpt-5.5`, `gpt-5.4`,
`gpt-5.4-mini`, `gpt-5.3-codex`) and effort (`xhigh`/`high`/`medium`/`low`).
Otherwise let Codex use its default.

```bash
codex exec --skip-git-repo-check -m gpt-5.5 \
  --config model_reasoning_effort="high" \
  --sandbox read-only "prompt" </dev/null 2>/dev/null
```

Background timeout by effort (only if you must background it): low 150s,
medium 300s, high 600s, xhigh 1200s.

## Resume a session

```bash
echo "follow-up prompt" | codex exec --skip-git-repo-check resume --last 2>/dev/null
```

Resume inherits the original model/effort/sandbox — pass **no** config flags
unless the user overrides. Flags go between `exec` and `resume`.

## When Codex disagrees with you

Codex has its own knowledge cutoff and can be wrong (model names, recent library
versions, evolved best practices). Don't defer blindly:

1. Trust your own knowledge when confident; state the disagreement to the user.
2. Verify with WebSearch/docs before accepting a surprising claim.
3. To hash it out, resume and identify yourself as a peer AI:
   ```bash
   echo "This is Claude following up. I disagree with [X] because [evidence]. Your take?" \
     | codex exec --skip-git-repo-check resume --last 2>/dev/null
   ```
4. Frame it as a discussion — either side could be wrong. Let the user decide
   genuine ambiguity.

## Good uses in this harness

- **Adversarial review**: after Claude writes non-trivial code, ask Codex
  (read-only) to find bugs Claude might be blind to.
- **Tie-breaker**: two viable designs, ask both models, compare reasoning.
- **Mechanical bulk edit**: a repetitive multi-file rename/port — hand it to
  Codex `workspace-write`, then Claude verifies the diff.

Always verify Codex's output before committing it — it's a proposal, not truth.
