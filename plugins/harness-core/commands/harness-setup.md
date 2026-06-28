---
description: Finish a /plugin install — show how to add the hooks and rules that plugins can't ship.
workloads: [core]
---

# Harness Setup

You installed this harness via `/plugin`. Plugins carry **agents, commands,
skills, and MCP servers** — but Claude Code plugins can't ship two things:

- **hooks** — they rely on a `HARNESS_HOOK_PROFILE` env var that a plugin
  can't set, and would double-fire alongside any other install.
- **rules** — `rules/` is not a plugin component type.

So those install from the repo, via the bundled `install.sh`.

## What to tell the user

Print this guidance verbatim (adjust the clone path if they already have the
repo). Do **not** run any install command yourself — these touch the user's
`~/.claude` and must be their explicit choice.

````
하네스의 hooks·rules 는 플러그인으로 안 깔립니다. 레포에서 install.sh 로 보충하세요:

  git clone https://github.com/TeiNam/my_harness_for_claude_code
  cd my_harness_for_claude_code

  # rules + hooks 만 설치 (플러그인이 이미 깐 agent/command/skill 은 건너뜀)
  ./install.sh --rules-only --with-hooks --all

  # 또는 워크로드별로:  ./install.sh --rules-only --with-hooks --category=backend

끄고 싶을 때:  ./install.sh --uninstall
````

## Why `--rules-only`

If they ran plain `./install.sh`, it would symlink agents/commands/skills into
`~/.claude/<kind>/_harness/` — duplicating what the plugin already provides, so
each agent/command would appear twice. `--rules-only` installs just the rules
and (with `--with-hooks`) merges the hook stack, leaving the plugin as the sole
source of agents/commands/skills.

## Notes

- The hook stack defaults to the `minimal` profile (set
  `HARNESS_HOOK_PROFILE=standard` in `~/.claude/settings.json` for the strict
  set). Mention this only if they ask why few hooks fire.
- Windows users run `install.ps1 -WithHooks -RulesOnly` if that flag exists;
  otherwise point them at the PowerShell installer's `--help`.
