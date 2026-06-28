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

Plugins ship **agents · commands · skills** only. `rules/`, `hooks/`, and
`mcp-configs/` aren't per-plugin component types in Claude Code — those still
install via `./install.sh` (the two paths coexist).

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

`source` is committed (symlinks + copies both survive `git clone`), so a
GitHub-hosted marketplace serves directly.
