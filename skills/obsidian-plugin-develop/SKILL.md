---
name: obsidian-plugin-dev
description: >
  Use when creating, modifying, reviewing, releasing, or submitting an Obsidian community plugin, and before tagging a release or submitting to the community directory. Covers the automated review (what blocks installation), manifest rules, declarative settings (1.13+), i18n, core API patterns, build, and release. Triggers: "obsidian plugin", "옵시디언 플러그인", "community plugin", "community directory", "plugin review", "BRAT", "obsidian API", "eslint-plugin-obsidianmd".
origin: harness
workloads: [frontend, obsidian]
---

# Obsidian Plugin Development

Synced 2026-11-13 against the official sources: developer docs (`obsidianmd/obsidian-developer-docs`, 2026-10-21), the review linter `eslint-plugin-obsidianmd` 0.5.1, `obsidian` typings 1.14.4, and the current sample plugin. The example code in this skill was type-checked, linted with the official plugin (0 findings), and built before it was written down.

## Safety

- A GitHub release and a community directory submission are public and start the automated review. Run the "Release workflow" below end to end, then tag, release, or submit only after the user approves.
- A published plugin `id` can never change (it would orphan every install, its settings, and its hotkeys). Settle the `id` and `name` with the user before the first submission.
- Command IDs are stable too: do not rename one after release, users' hotkeys point at it.

## Toolchain

Use the newest versions that the review tooling accepts. Look them up (`npm view <pkg> dist-tags.latest`); the pins below are what was verified on 2026-11-13.

| Tool | Use | Constraint |
|------|-----|-----------|
| `obsidian` | latest (1.14.4) | Types only; the linter reads them for `no-unsupported-api` |
| `eslint-plugin-obsidianmd` | latest (0.5.1) | The same rules the directory scanner runs |
| `typescript` | latest **6.0.x** (6.0.3) | Not 7: `typescript-eslint` 8 requires `<6.1.0`, npm refuses `typescript@7` |
| `eslint` | 10.x or 9.x | On 10, npm prints `ERESOLVE` peer warnings (harmless); with `strict-peer-deps` use 9 |
| `esbuild` | latest (0.28.2) | |
| Node.js | 20.19+, 22.13+, or 24+ | Node 18 is no longer supported by the linter |

TypeScript 6 changes two things the older sample code relied on:

- `moment()` imported from `obsidian` is not callable (namespace import under forced `esModuleInterop`). Call `window.moment()` instead. Never `import moment from 'moment'`.
- `@types/*` are no longer picked up automatically. A desktop-only plugin that uses Node APIs adds `"types": ["node"]` to `tsconfig.json`.

## Project Structure

```
your-plugin/
├── src/
│   ├── main.ts              # Lifecycle only: onload, registrations
│   ├── settings.ts          # Settings interface + defaults
│   ├── settings-tab.ts      # Declarative settings tab
│   ├── i18n/                # en.ts (complete), ko.ts, index.ts
│   ├── views/  modals/  utils/
├── styles.css               # All CSS lives here (no <style> elements)
├── manifest.json
├── versions.json            # Only changes when minAppVersion changes
├── LICENSE                  # Required; a license GitHub recognizes
├── README.md                # Required; excerpt shown on the listing
├── eslint.config.mjs
├── esbuild.config.mjs
├── tsconfig.json
└── package.json             # "build" must be the production build
```

Do not commit `main.js` in a TypeScript project: it is build output and belongs in the release (the scanner warns). Keep `main.ts` minimal and split files past ~300 lines.

## manifest.json

```json
{
  "id": "clip-notes",
  "name": "Clip Notes",
  "version": "1.0.0",
  "minAppVersion": "1.13.2",
  "description": "Generate notes from clipboard content with templates.",
  "author": "Your Name",
  "authorUrl": "https://example.com",
  "isDesktopOnly": false
}
```

Required: `id`, `name`, `version`, `minAppVersion`, `description`, `author`, `isDesktopOnly`. Optional: `authorUrl`, `fundingUrl`, `helpUrl`. Any other field is reported.

- `id`: lowercase letters and hyphens, unique, does not contain `obsidian`, does not end with `plugin`. For local development the plugin folder name must equal the `id`.
- `name`: unique across plugins and themes; no "Obsidian" or parts of it ("Obsi-", "-sidian", a leading "Ob"), no "Plugin"; Basic Latin; no emoji or punctuation except hyphen, `+`, parentheses; not a core feature name ("Live Preview", "Bases"). The name can be changed later in `manifest.json`; an invalid new name delists the plugin.
- `description`: 10–250 characters, ends with a period, starts with an action ("Generate…", "Sync…"), does not contain "Obsidian", does not refer to itself ("This plugin…", "A plugin that…"), does not repeat or start with the name, no emoji.
- `minAppVersion`: the lowest version that has every API you call. The linter reports any API newer than this (`no-unsupported-api`), so either raise it or guard with `requireApiVersion()`. Declarative settings need `1.13.0`, the `secret` control `1.13.2`.
- `isDesktopOnly`: `true` if you use Node.js or Electron APIs without a platform guard.
- `fundingUrl`: only real funding links (string, or `{ "Label": "url" }`); omit otherwise.
- `version`: `x.y.z` only. The release tag must be identical, with no leading `v`.

## Automated Review

Every release is scanned in four sections: **Manifest**, **Releases**, **Source code**, **Build verification** (the scanner runs your `build` script and checks that the release assets match the committed source). Each result is an Error, Warning, Recommendation, or Pass. **Errors make the plugin uninstallable until fixed**; warnings and disclosures appear on the public scorecard.

The source-code section is `eslint-plugin-obsidianmd`. Run it locally before every release (setup and the full rule list: `review-rules.md`).

### Errors

| Do not | Do instead |
|--------|-----------|
| `eval()`, `new Function()`, string arguments to timers | Plain functions |
| `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write` | `createEl()` / `createDiv()` / `createSpan()` / `setText()`; `el.empty()` to clear |
| Creating `<style>` or `<link>` elements | `styles.css` (Obsidian loads it) |
| Regex lookbehind `(?<=…)` in a mobile-capable plugin | Rewrite; on iOS < 16.4 it stops the whole plugin from loading |
| `eslint-disable` with no rule name, or with no explanation | `// eslint-disable-next-line rule-name -- reason` |
| Sample leftovers (`MyPlugin`, `SampleSettingTab`, sample commands) | Rename and delete |
| `el.style.color = …` and other fixed inline styles | CSS classes + `var(--text-normal)`; `setCssProps()` for dynamic values |
| HTML headings in settings; a "General", "Settings", or plugin-name heading | No top heading; `setHeading()` or a `group` for later sections |
| `navigator.userAgent` / `navigator.platform` for OS detection | `Platform.isMacOS`, `Platform.isMobile`, … |
| Passing the plugin or `new Component()` to `MarkdownRenderer.render()` | Pass the view or modal that shows the content |
| `detachLeavesOfType()` in `onunload()` | Nothing: Obsidian restores the leaves |
| Storing a view instance on the plugin | Return `new MyView(leaf)` from `registerView`; look it up with `getLeavesOfType()` |
| Calling an API newer than `minAppVersion` | Raise `minAppVersion` or guard with `requireApiVersion()` |

### Warnings (fix them: they show on the scorecard)

- `console.log` — only `console.warn`, `console.error`, and `console.debug` are accepted.
- Global `app` / `window.app` → `this.app`. `globalThis` → `window`.
- `fetch`, `axios`, `got`, `ky`, `node-fetch` → `requestUrl()`.
- `localStorage` → `app.saveLocalStorage()` / `app.loadLocalStorage()` (per vault).
- Command ID or name containing the plugin ID/name or the word "command"; default hotkeys.
- `as TFile` / `as TFolder` casts → `instanceof` checks.
- `vault.delete()` / `vault.trash()` → `fileManager.trashFile()`.
- Hardcoded `.obsidian` → `vault.configDir`.
- `getFiles().find(…)` to locate a path → `getFileByPath()` / `getFolderByPath()`.
- Bare `setTimeout`/`setInterval`/`requestAnimationFrame` → `window.setTimeout(…)`; `document` → `activeDocument` or `el.doc`; `x instanceof HTMLElement` → `x.instanceOf(HTMLElement)` (pop-out windows).
- Node built-ins imported without a `Platform.isDesktopApp` guard (unless `isDesktopOnly`).
- `Object.assign(DEFAULT_SETTINGS, data)` (mutates the defaults) → `{ ...DEFAULT_SETTINGS, ...data }`.
- A settings tab with only `display()`; `this.display()` to refresh → `getSettingDefinitions()` and `this.update()`.
- `editor-paste` / `editor-drop` handlers that skip `evt.defaultPrevented` or `evt.preventDefault()`.

### Policy (removal from the directory)

Not allowed at all: obfuscated code, ads loaded from the network, static ads outside the plugin's own UI, client-side telemetry, self-updating or installing dependencies at runtime. Allowed only when disclosed in the README: see "README Disclosures".

## i18n

Follow the language the user chose in Obsidian with `getLanguage()` (1.8.7+), not `navigator.language` or `localStorage.getItem('language')`. Keep a language override as the first setting.

```typescript
// i18n/en.ts — the default language, must be complete
export const en = {
  settings: {
    language: {
      name: 'Language',
      desc: 'Select the display language.',
      options: { auto: 'Same as the app', en: 'English', ko: '한국어' },
    },
    templateFolder: { name: 'Template folder location', desc: 'Folder that holds your note templates.' },
    openOnLaunch: { name: 'Open panel on launch' },
    advanced: { heading: 'Advanced' },
    apiKey: { name: 'API key', desc: 'Select a secret to use for the remote service.' },
  },
  commands: { openPanel: 'Open panel' },
  ui: { error: 'An error occurred.' },
} as const;

// Same keys, any strings: a missing key in another locale is a compile error.
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };
export type Translations = Widen<typeof en>;
```

```typescript
// i18n/index.ts
import { getLanguage } from 'obsidian';
import { en, type Translations } from './en';
import { ko } from './ko'; // export const ko: Translations = { … }

export type SupportedLocale = 'en' | 'ko';
export type LanguageSetting = SupportedLocale | 'auto';

const LOCALES: Record<SupportedLocale, Translations> = { en, ko };

function isSupported(code: string): code is SupportedLocale {
  return code in LOCALES;
}

export function detectLocale(setting: LanguageSetting): SupportedLocale {
  if (setting !== 'auto') return setting;
  const appLanguage = getLanguage(); // e.g. "ko", "pt-BR"
  if (isSupported(appLanguage)) return appLanguage;
  const base = appLanguage.split('-')[0] ?? 'en';
  return isSupported(base) ? base : 'en';
}

export function createI18n(locale: SupportedLocale): Translations {
  return LOCALES[locale];
}

export type { Translations };
```

UI text is sentence case ("Template folder location", not "Template Folder Location"). The scanner skips `i18n/`, `locales/`, `translations/` directories, so the wording there is on you. Plurals, dates, and refreshing open views: `i18n-patterns.md`.

## main.ts

```typescript
import { Notice, Plugin, type TFile } from 'obsidian';
import { createI18n, detectLocale, type LanguageSetting, type Translations } from './i18n';
import { DEFAULT_SETTINGS, type ClipNotesSettings } from './settings';
import { ClipNotesSettingTab } from './settings-tab';

export default class ClipNotesPlugin extends Plugin {
  settings!: ClipNotesSettings;
  t!: Translations;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.t = createI18n(detectLocale(this.settings.language));
    this.addSettingTab(new ClipNotesSettingTab(this.app, this));

    this.addCommand({
      id: 'open-panel', // no plugin id, no "command", no default hotkey
      name: this.t.commands.openPanel,
      callback: () => this.openPanel(),
    });

    // Startup work and vault 'create' listeners wait for the layout:
    // during startup Obsidian fires 'create' for every existing file.
    this.app.workspace.onLayoutReady(() => {
      this.registerEvent(
        this.app.vault.on('create', (file) => {
          void this.onFileCreated(file.path);
        }),
      );
      if (this.settings.openOnLaunch) this.openPanel();
    });

    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        if (file) this.onFileOpen(file);
      }),
    );
  }

  // No onunload(): everything above is registered and cleaned up by Obsidian.

  async loadSettings(): Promise<void> {
    const stored = (await this.loadData()) as Partial<ClipNotesSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...stored };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async changeLanguage(language: LanguageSetting): Promise<void> {
    this.settings = { ...this.settings, language };
    this.t = createI18n(detectLocale(language));
    await this.saveSettings();
  }

  /** The secret value lives in SecretStorage; settings only hold its name. */
  getApiKey(): string | null {
    return this.app.secretStorage.getSecret(this.settings.apiKeySecret);
  }

  private openPanel(): void {
    new Notice(this.t.commands.openPanel);
  }

  private onFileOpen(file: TFile): void {
    console.debug('[clip-notes] opened', file.path);
  }

  private async onFileCreated(path: string): Promise<void> {
    const file = this.app.vault.getFileByPath(path);
    if (!file) return;
    await this.app.vault.process(file, (content) => content.trimEnd() + '\n');
  }
}
```

Keep `onload()` to registrations: it runs before the user can interact with the app. Anything created outside the `register*` helpers (workers, sockets, third-party library instances) must be released in `onunload()`.

## settings-tab.ts (declarative, 1.13.0+)

`display()` is deprecated since 1.13.0. Describe the settings with `getSettingDefinitions()`; Obsidian renders them, indexes them for settings search, and saves `control` values to `this.plugin.settings[key]` for you.

```typescript
import { type App, PluginSettingTab, type SettingDefinitionItem } from 'obsidian';
import type { LanguageSetting } from './i18n';
import type ClipNotesPlugin from './main';

export class ClipNotesSettingTab extends PluginSettingTab {
  plugin: ClipNotesPlugin;

  constructor(app: App, plugin: ClipNotesPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  // Called on every update() and once at registration for settings search: keep it cheap.
  getSettingDefinitions(): SettingDefinitionItem[] {
    const t = this.plugin.t;
    return [
      // General settings first, with no heading.
      {
        name: t.settings.language.name,
        desc: t.settings.language.desc,
        // render: this setting has a side effect (rebuild the translations), so no `control`.
        render: (setting) => {
          setting.addDropdown((dropdown) => {
            dropdown
              .addOptions(t.settings.language.options)
              .setValue(this.plugin.settings.language)
              .onChange(async (value) => {
                await this.plugin.changeLanguage(value as LanguageSetting);
                this.update(); // re-run getSettingDefinitions() with the new strings
              });
          });
        },
      },
      {
        name: t.settings.templateFolder.name,
        desc: t.settings.templateFolder.desc,
        // control: Obsidian reads/writes this.plugin.settings[key] and calls saveData() itself.
        control: { type: 'folder', key: 'templateFolder' },
      },
      {
        name: t.settings.openOnLaunch.name,
        control: { type: 'toggle', key: 'openOnLaunch' },
      },
      // Later sections get a heading. No "settings" in the heading text.
      {
        type: 'group',
        heading: t.settings.advanced.heading,
        items: [
          {
            name: t.settings.apiKey.name,
            desc: t.settings.apiKey.desc,
            control: { type: 'secret', key: 'apiKeySecret' }, // 1.13.2+
          },
        ],
      },
    ];
  }
}
```

- Control types: `toggle`, `text`, `textarea`, `number`, `slider`, `dropdown`, `file`, `folder`, `color`, `secret`. Each takes `key`, optional `defaultValue`, `validate` (return a string to reject and show it inline), and `disabled`.
- One definition has exactly one of `control`, `render` (full control of the row; **does not auto-save**), or `action` (clickable row). Use `visible: () => boolean` to hide a row based on another setting.
- Structure with `type: 'group'`, `type: 'list'` (add/delete/reorder), and `type: 'page'` (sub-page).
- Refresh with `this.update()`. `this.display()` does nothing once definitions exist.
- `validate` is a UI gate only. Re-validate stored data in `loadSettings()`.
- Supporting Obsidian below 1.13.0: keep the old `display()` next to `getSettingDefinitions()` (1.13+ skips `display()`), and keep both in sync. Prefer raising `minAppVersion` instead.
- Style: one control per row, descriptions of one sentence, no textarea in the main tab, warnings and multi-field input go in a modal.

## Core API Patterns

```typescript
// Files — direct lookup, atomic background edits, user's trash setting
const file = app.vault.getFileByPath(normalizePath(userPath));
await app.vault.process(file, (content) => content.replace('old', 'new'));
await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => { fm['tags'] = ['new']; });
await app.fileManager.trashFile(file);
const pluginDir = `${app.vault.configDir}/plugins/clip-notes`;

// Active note — use the Editor API (keeps cursor, selection, folds), not vault.modify()
const editor = app.workspace.getActiveViewOfType(MarkdownView)?.editor;

// Views are deferred until visible (1.7.2+) — check with instanceof, never cast leaf.view
const leaf = app.workspace.getLeavesOfType(VIEW_TYPE).first();
if (leaf) {
  await app.workspace.revealLeaf(leaf); // loads the view
  if (leaf.view instanceof ClipNotesView) leaf.view.refresh();
}

// Network, per-vault storage, secrets
const response = await requestUrl({ url: 'https://api.example.com/data' });
app.saveLocalStorage('clip-notes-last-run', String(Date.now()));
const apiKey = app.secretStorage.getSecret(settings.apiKeySecret); // never store keys in data.json

// Platform — guard Node modules instead of setting isDesktopOnly for one feature
if (Platform.isDesktopApp) {
  const { homedir } = await import('node:os');
}

// Paste/drop — let other handlers win, and claim the event when you insert
plugin.registerEvent(app.workspace.on('editor-paste', (evt, editor) => {
  if (evt.defaultPrevented) return;
  editor.replaceSelection(transform(evt.clipboardData?.getData('text/plain') ?? ''));
  evt.preventDefault();
}));
```

Prefer the Vault API over `vault.adapter` (cached, serialized). Prefer `async`/`await` over promise chains. More patterns (pop-out windows, Component lifecycle, custom suggesters, CodeMirror): `typescript-chromium.md`.

## README Disclosures

State each that applies, with the reason: network use (which services, why), required payment or account, access to files outside the vault, static ads inside the plugin's UI, server-side telemetry (link a privacy policy), closed-source code (case by case). The scanner lists clipboard and network access as disclosures on the scorecard regardless. In the listing, set the payment type honestly: **Free**, **Optional payment** (a paid third-party service or paid extras), or **Paid**.

## Build

```javascript
// esbuild.config.mjs
import esbuild from 'esbuild';
import process from 'node:process';
import { builtinModules } from 'node:module';

const prod = process.argv[2] === 'production';

const context = await esbuild.context({
  banner: { js: '/* THIS IS A GENERATED/BUNDLED FILE BY ESBUILD. Source: see the GitHub repository. */' },
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: [
    'obsidian', 'electron',
    '@codemirror/autocomplete', '@codemirror/collab', '@codemirror/commands', '@codemirror/language',
    '@codemirror/lint', '@codemirror/search', '@codemirror/state', '@codemirror/view',
    '@lezer/common', '@lezer/highlight', '@lezer/lr',
    ...builtinModules,
  ],
  format: 'cjs',
  target: 'es2021',
  logLevel: 'info',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  minify: prod,
  define: { DEV: JSON.stringify(!prod) },
  outfile: 'main.js',
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
```

`package.json` scripts: `"dev": "node esbuild.config.mjs"`, `"build": "tsc --noEmit --skipLibCheck && node esbuild.config.mjs production"`, `"lint": "eslint ."`. The scanner builds with the first of `build`, `build:plugin`, `compile` it finds, so `build` must be the production build. Run ESLint from the project root (`eslint .`, not `eslint src`): the manifest and LICENSE checks only run that way.

## Release Workflow

Order matters. If a step fails, fix it and go back to step 1.

1. `npm run build` — type-check and production bundle pass.
2. `npm run lint` — zero errors; resolve warnings or justify each one.
3. Walk `release-checklist.md` (manifest, README disclosures, LICENSE, versions).
4. Push, then in the community directory run **Review branch → Run preview scan** on the branch. Fix every Error and go back to step 1.
5. Show the user the version, tag, and what will be published. Wait for approval.
6. Tag (`x.y.z`, no `v`) → the release workflow builds, attests, and drafts the release → publish it.
7. First release only: submit the repository in the community directory. Later releases are picked up automatically.

## Practical Tips

1. Mobile: no Node/Electron APIs, no regex lookbehind, keep memory small; test on iOS and Android when `isDesktopOnly` is `false`.
2. Editor extensions: mutate the registered array in place, then `app.workspace.updateOptions()`.
3. Command callbacks: `callback` (always), `checkCallback` (conditional — use its `checking` argument), `editorCallback` (needs an editor).
4. Settings migration: version the stored data and convert in `loadSettings()`.
5. Large lists: build in `createFragment()` and append once.
6. React to settings changed by sync or another device with `onExternalSettingsChange()` (1.5.7+).
7. Debug-only code: `declare const DEV: boolean;` and `if (DEV) { … }` — esbuild removes it in production.

## Reference Files

| File | Open when |
|------|-----------|
| `review-rules.md` | Setting up ESLint, reading a review result, or checking how a specific rule is scored |
| `release-checklist.md` | Before tagging a release, submitting, or managing the listing (ownership, private source, archive) |
| `typescript-chromium.md` | Writing views, DOM, pop-out window support, Component lifecycle, suggesters, CodeMirror |
| `i18n-patterns.md` | Plurals, dates, refreshing views after a language change, adding a language |
