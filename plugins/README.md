# Plugins (generated — do not hand-edit)

`/plugin` marketplace view of the harness. Native `/plugin` already does
"install only what you need", so the harness is split into **one plugin per
workload group**. Pick `harness-frontend`, `harness-mysql`, … individually.

## Use it

```bash
claude plugin marketplace add <this repo>     # github owner/repo, url, or ./path
claude plugin                                 # browse, install per-plugin
# or directly:
claude plugin install harness-mysql@harness
```

Plugins ship **agents · commands · skills** per workload, plus one standalone
**`harness-mcp`** (the MCP servers as a `.mcp.json`; API keys are `${ENV}`
refs, so set them in your environment). `rules/` and `hooks/` aren't shippable
per-plugin — `rules/` isn't a plugin component type, and the hooks rely on
`HARNESS_HOOK_PROFILE` env gating a plugin can't set.

To add those after a `/plugin` install, run the in-CLI `/harness-setup` for
guidance, or directly:

```bash
# rules + hooks only — skips agent/command/skill the plugins already provide
./install.sh --rules-only --with-hooks --all
```

Plain `./install.sh` (without `--rules-only`) would re-symlink
agents/commands/skills too, making each appear twice. The paths coexist.

## Regenerate

This tree is built from the flat `agents/ commands/ skills/` + their
`workloads:` frontmatter. After adding or editing an asset:

```bash
npm run marketplace:build      # rebuild plugins/ + .claude-plugin/marketplace.json
npm run marketplace:check      # CI guard: fails if committed output is stale
```

- **Skills** are directory symlinks back to `../../../skills/<name>` — zero
  duplication. (`/plugin` discovery follows directory symlinks.)
- **Agents/commands** are real file copies — `/plugin` discovery ignores
  *file* symlinks, so symlinking them would silently drop them. `--check`
  compares copied content against source to catch drift.
- `--copy` materialises skills as real dirs too (Windows / git without
  `core.symlinks`).
- **`harness-mcp/.mcp.json`** is generated from `mcp-configs/mcp-servers.json`,
  with `YOUR_*_HERE` key placeholders rewritten to `${ENV}` refs (no secret
  literal is committed). `--check` flags it stale when the source changes.

`source` is committed (symlinks + copies both survive `git clone`), so a
GitHub-hosted marketplace serves directly.
