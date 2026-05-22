# Reference prompt pack

`prompt-pack.json` is **not** an active Claude Code hook file. It is a small set of reminder prompts kept around as ready-made copy-paste material:

| Entry | Use when | Source intent |
|---|---|---|
| `ref:pre-write-guard` | About to write a long file or a `.md` outside docs/ | Block writes >800 lines, scan for secrets, warn on misplaced doc files |
| `ref:review-on-stop` | Wrapping up a task | Quick review (security, error handling, stray `console.log`, missing tests) |

Each entry's `_prompt` field is the actual text — `id`, `matcher`, and the surrounding object are there so the file is parseable by anyone who later wants to wrap the prompts as real Claude Code commands.

## Overlap with the active stack

Everything these prompts ask for is already enforced (or close enough) by hooks already wired into `hooks/hooks.json`:

- doc-location warnings → `scripts/hooks/doc-file-warning.js`
- console.log audit on Stop → `scripts/hooks/check-console-log.js`
- post-edit quality gate → the `post:edit-write:quality-gate` hook chain
- 800-line write block → see the "Block large file creation" recipe in `hooks/README.md`

So in normal use you don't need to wire these up. They exist as a portable prompt pack you can paste into a session, fold into `CLAUDE.md` as durable instructions, or convert into a runnable `command` hook later.

## Activation options

1. **Paste on demand** — copy the `_prompt` text into the conversation when the situation arises.
2. **Bake into CLAUDE.md** — convert the rules to durable instructions (e.g. "Block writes over 800 lines", "Always check for secrets in `.md` writes outside docs/").
3. **Wrap as a `command` hook** — write a small Node script that prints the text to stderr from a PreToolUse hook (Claude Code surfaces stderr from those hooks).

## How `hooks/hooks.json` itself is installed

For the active stack, `install.sh` / `install.ps1` symlink `hooks/` into `~/.claude/hooks/_harness/` and the repo root into `~/.claude/_harness/`; they do **not** write into `~/.claude/settings.json`. Merge the entries from `hooks/hooks.json` into your settings file by hand. The inline bootstrap in each command resolves the harness root via `CLAUDE_PLUGIN_ROOT` first, then `~/.claude/_harness/`, then `~/.claude/plugins/_harness/`.
