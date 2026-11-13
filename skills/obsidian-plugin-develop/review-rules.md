# Automated Review Rules

## Contents

- How the review works
- Run the checks locally
- What the scanner builds and skips
- Severity in the scanner
- Rule catalog
- Checks only the directory makes
- Disable comments

Source: `eslint-plugin-obsidianmd` 0.5.1 (README, `docs/configuration.md`, rule docs) and the community directory docs, read 2026-11-13. The scanner's severities differ from the plugin's recommended config; this file lists the scanner's.

## How the review works

After each GitHub release the directory scans the plugin and files results in four sections:

| Section | Checks |
|---------|--------|
| Manifest | `manifest.json` at the HEAD of the default branch |
| Releases | The release whose tag equals `version`: `main.js`, `manifest.json`, `styles.css` if used; artifact attestation |
| Source code | `eslint-plugin-obsidianmd` over the plugin source, plus dependency vulnerabilities, obfuscation, malware |
| Build verification | Runs your build and compares the output with the release assets |

Each result is an **Error**, **Warning**, **Recommendation**, or **Pass**. A plugin with errors cannot be installed from Obsidian until a new release fixes them. Results feed the public **Scorecard** (passed checks, disclosures such as clipboard or network access, other notes). Popular, featured, and flagged plugins are also reviewed by hand.

A release is picked up periodically. To trigger it: **… → Check for new releases** or **Request review**. To scan without releasing: **Review branch → Run preview scan** (any branch, tag, or commit).

## Run the checks locally

```sh
npm i -D eslint eslint-plugin-obsidianmd obsidian typescript@6
```

```js
// eslint.config.mjs
import { defineConfig, globalIgnores } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';

export default defineConfig([
  // Build output and Node build scripts are not plugin code.
  globalIgnores(['node_modules', 'main.js', 'esbuild.config.mjs']),
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: { projectService: { allowDefaultProject: ['eslint.config.*'] } },
    },
    rules: {
      // Until the first submission: also check the id (it can never change afterwards).
      'obsidianmd/validate-manifest': ['warn', { checkId: true }],
    },
  },
]);
```

- Run `eslint .` from the project root. `eslint src` never visits `manifest.json`, `package.json`, or `LICENSE`, so their checks silently do nothing.
- The recommended config already includes ESLint core and typescript-eslint's type-checked rules. Do not add them again.
- `obsidian` must be installed: without it `no-unsupported-api` reports nothing.
- Install notes (Node 20.19+/22.13+/24+, TypeScript below 6.1, ESLint 10 peer warnings): SKILL.md → Toolchain.
- English locale files (`en.json`, `en.ts`): `obsidianmd.configs.recommendedWithLocalesEn` adds sentence-case checks. `ui/sentence-case` for inline strings is off by default; enable it with `['warn', { brands: [...], acronyms: [...] }]` (these lists replace the built-in ones).

## What the scanner builds and skips

- **Build script**: the first of `build`, `build:plugin`, `compile` in `package.json`. It must be the production build.
- **Skipped paths** (name your files the same way to keep them out of the scan): `node_modules`, `dist`, `build`, `pkg`, `.obsidian`, `test-vault`, `esbuild.config.mjs`, `version-bump.mjs`, `*.test.*`, `*.spec.*`, `test/`, `tests/`, `__tests__/`, `mocks/`, `__mocks__/`, `e2e/`, `*.cjs`, `*.mjs`, `*.cts`, `*.mts`, `vite*`, `scripts/`, `docs/`, `i18n/`, `i18next/`, `locale/`, `locales/`, `translations/`, `l10n/`, `automation/`, and tool configs by name (`eslint.config.*`, `jest.config.*`, …). A plugin's own `config.ts` is still linted.
- **Bundled JavaScript** is skipped (`*.min.js`, files under `dist`/`build`/`out`/`release`, a root `main.js` with a bundler banner).
- **Committed `main.js`**: warned about in a TypeScript project. It is build output; keep it out of the repository.
- **Web workers** (`*.worker.ts`, `workers/`): the window-only rules do not apply.

## Severity in the scanner

**Always errors (security findings):** `no-eval`, `no-implied-eval`, `no-new-func`, `no-unsanitized/method`, `no-unsanitized/property`, `obsidianmd/no-forbidden-elements`, `obsidianmd/regex-lookbehind`, `eslint-comments/no-unlimited-disable`.

**Errors for recently submitted plugins** (the newest scanner layer — assume it applies to any new plugin): `sample-names`, `no-sample-code`, `settings-tab/no-manual-html-headings`, `settings-tab/no-problematic-settings-headings`, `platform`, `no-plugin-as-component`, `detach-leaves`, `no-static-styles-assignment`, `no-view-references-in-plugin`, `no-unsupported-api`, and the disable-comment rules `eslint-comments/require-description`, `disable-enable-pair`, `no-restricted-disable`.

**Warnings:** most other rules, including `no-console` and the command-ID rules.

**Recommendations** (weigh less than warnings): `@typescript-eslint/no-deprecated`, `no-unused-vars`, `obsidianmd/prefer-abstract-input-suggest`.

**Not run by the scanner** (it checks these itself or they misfire at scale): `no-undef`, `restrict-template-expressions`, `import/no-unresolved`, `validate-manifest`, `validate-license`, and the three sentence-case rules. Keep them on locally: they mirror the Manifest section.

## Rule catalog

| Rule | Reports | Fix |
|------|---------|-----|
| `commands/no-default-hotkeys` | `hotkeys` on a command | Remove; users assign hotkeys |
| `commands/no-plugin-id-in-command-id`, `no-command-in-command-id` | Plugin ID or "command" in a command ID | Bare ID such as `open-panel` |
| `commands/no-plugin-name-in-command-name`, `no-command-in-command-name` | Plugin name or "command" in a command name | The UI already shows the plugin name |
| `commands/check-callback-uses-checking` | `checkCallback` that ignores `checking` | Return the condition when `checking`, act otherwise |
| `detach-leaves` | `detachLeavesOfType()` in `onunload` | Remove it |
| `editor-drop-paste` | Handler that never reads `evt.defaultPrevented`, or inserts without `evt.preventDefault()` | Check first, claim the event after inserting |
| `hardcoded-config-path` | `.obsidian` in a string | `this.app.vault.configDir` |
| `no-await-chainable` | `await new Setting(…)` (its `then` is for chaining) | Remove the `await` |
| `no-forbidden-elements` | Creating `<style>` or `<link>` (allowed inside a shadow root) | `styles.css` |
| `no-global-this` | `global`, `globalThis` | `window` / `activeWindow` |
| `no-misused-promises` | A promise where none is handled | `void promise` or wrap in a sync callback |
| `no-nodejs-modules` | Node built-in import without a desktop guard | `if (Platform.isDesktopApp) { await import('node:fs') }`, or `isDesktopOnly: true` |
| `no-plugin-as-component` | Plugin or `new Component()` as the `MarkdownRenderer.render()` component | The view/modal, or a component you unload |
| `no-sample-code`, `sample-names` | Sample plugin code and class names | Delete and rename |
| `no-static-styles-assignment` | `el.style.x = 'fixed'`, fixed values in `setCssStyles()` | CSS class; `setCssProps()` only for computed values |
| `no-tfile-tfolder-cast` | `x as TFile`, `x as TFolder` | `instanceof TFile` |
| `no-unsupported-api` | API whose `@since` is above `minAppVersion` | Raise `minAppVersion` or guard with `requireApiVersion()` |
| `no-view-references-in-plugin` | `this.view = new MyView(leaf)` in `registerView` | Return the view; find it via `getLeavesOfType()` |
| `object-assign` | `Object.assign(DEFAULT_SETTINGS, data)` | `{ ...DEFAULT_SETTINGS, ...data }` |
| `platform` | `navigator.userAgent` / `navigator.platform` | `Platform` |
| `prefer-abstract-input-suggest` | The copied `TextInputSuggest` class | `AbstractInputSuggest`, or the `file`/`folder` controls |
| `prefer-active-doc` | `document` (and changes to `document.body`/`head`) | `activeDocument`, `el.doc`; per-window state via `workspace.on('window-open')` |
| `prefer-create-el` | `document.createElement()` | `createEl()`, `createDiv()`, `createSpan()`, `createSvg()`, `createFragment()` |
| `prefer-file-manager-trash-file` | `vault.delete()`, `vault.trash()` | `fileManager.trashFile()` (1.6.6+) |
| `prefer-get-language` | `localStorage.getItem('language')`, `i18next-browser-languagedetector` | `getLanguage()` (1.8.7+; returns `"en"` where the old call returned `null`) |
| `prefer-instanceof` | `x instanceof HTMLElement` on DOM nodes and events | `x.instanceOf(HTMLElement)`, `evt.targetNode?.instanceOf(…)` |
| `prefer-window-timers` | Bare `setTimeout`, `setInterval`, `requestAnimationFrame` | `window.setTimeout(…)`; register intervals with `registerInterval()` |
| `regex-lookbehind` | `(?<=…)`, `(?<!…)` in a literal or a `new RegExp()` string (not reported when `isDesktopOnly` is `true`) | Match the preceding text in a group instead |
| `settings-tab/prefer-setting-definitions` | A tab without `getSettingDefinitions()` | Declarative settings |
| `settings-tab/prefer-update-over-display` | `this.display()` to refresh | `this.update()` |
| `settings-tab/no-deprecated-display` | A leftover `display()` once `minAppVersion` ≥ 1.13.0 | Delete it |
| `settings-tab/require-display` | No `display()` while `minAppVersion` < 1.13.0 | Keep both, or raise `minAppVersion` |
| `settings-tab/no-manual-html-headings` | `createEl('h2')` in settings | `setHeading()` or a `group` |
| `settings-tab/no-problematic-settings-headings` | "General", "Settings", or the plugin name as a heading; "settings" in a heading | No top heading; "Advanced", not "Advanced settings" |
| `validate-manifest` | Missing/extra fields, name and description wording | SKILL.md → manifest.json |
| `validate-license` | The sample plugin's `Dynalist Inc.` copyright line left as is | Your own name |
| `vault/iterate` | `getFiles().find(f => f.path === …)` | `getFileByPath()` |
| `no-console` | `console.log`, `console.info` | `console.debug` / `warn` / `error`, or remove |
| `no-restricted-globals` | `app`, `fetch`, `localStorage` | `this.app`, `requestUrl()`, `app.saveLocalStorage()` |
| `no-restricted-imports` | `axios`, `got`, `ky`, `ofetch`, `superagent`, `node-fetch`, `moment` | `requestUrl()`; `window.moment()` (type-only `moment` imports are fine) |

## Checks only the directory makes

Not covered by ESLint, so check them by hand (`release-checklist.md`):

- `id` and `name` already taken; `version` format; placeholder, email address, or URL in `author`; name length and capitals.
- `authorUrl` and `fundingUrl`: valid, reachable HTTPS, no raw IP, not the Obsidian website (`authorUrl` also not a GitHub repository).
- A license GitHub recognizes (a "Custom license" result is a warning).
- Release assets present and matching the build; artifact attestations verified.
- Known vulnerable dependencies; obfuscated code.

## Disable comments

Disable comments are honoured, but they are reviewed: name the rule and say why.

```ts
// eslint-disable-next-line obsidianmd/prefer-active-doc -- the status bar exists only in the main window
document.body.addClass('clip-notes-ready');
```

A bare `// eslint-disable` or `/* eslint-disable */` with no rule name is an error for every plugin. `validate-manifest` cannot be silenced inside `manifest.json` (comments break JSON parsing and unknown keys are reported); use the rule's `allowedWords` or `ignore` options in `eslint.config.mjs`.
