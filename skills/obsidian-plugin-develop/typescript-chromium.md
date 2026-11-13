# TypeScript, DOM, and Lifecycle Patterns

## Contents

- TypeScript patterns
- Lifecycle and cleanup
- Views
- DOM
- Pop-out windows
- CSS — theme integration
- Error handling
- Dev/production branching
- Path and custom suggesters
- CodeMirror 6 editor integration

The snippets here pass `tsc` and `eslint-plugin-obsidianmd` 0.5.1 with zero findings (checked 2026-11-13).

## TypeScript patterns

### Narrow with instanceof, never cast

```typescript
import { TFile, TFolder } from 'obsidian';

export function describe(file: unknown): string {
  if (file instanceof TFile) return file.extension; // `as TFile` is reported
  if (file instanceof TFolder) return 'folder';
  return '';
}
```

### async/await, no promise chains

```typescript
async processAllFiles(files: TFile[]): Promise<string[]> {
  return Promise.all(files.map((file) => this.app.vault.cachedRead(file)));
}
```

A promise you do not await needs `void`: `void this.refresh();`. Do not `await` a `Setting` chain; its `then()` is for chaining, not a promise.

### Dates

`moment` is bundled with Obsidian. Call `window.moment()`; never `import moment from 'moment'` (it would bundle a second copy). For a type, use `moment.Moment` from a type-only import.

## Lifecycle and cleanup

Ask of every resource: who owns it, and how long should it live? Register it on the component that owns it and Obsidian releases it on unload.

```typescript
// Obsidian events
this.registerEvent(this.app.metadataCache.on('changed', (file) => this.handleChange(file)));

// DOM events on long-lived targets (window, document)
this.registerDomEvent(activeDocument, 'keydown', (evt) => {
  if (evt.key === 'Escape') this.closePanel();
});

// Intervals — through window, and registered
this.registerInterval(window.setInterval(() => this.poll(), 60_000));
```

- A listener on an element you created needs no cleanup: it dies with the element.
- A listener on `window` or `document` added with `addEventListener` leaks unless removed in `onunload()` / `onClose()`.
- Workers, sockets, third-party library instances, and large caches are released in `onunload()`.
- Group a feature's resources in a `Component` subclass and attach it with `this.addChild(new MyWidget(this.app))`; children unload before their parent.
- In a modal, create a `Component`, `load()` it in the constructor, register on it in `onOpen()`, and `unload()` it in `onClose()`.

### MarkdownRenderer needs an owner

```typescript
// In an ItemView: the view owns the rendered content and cleans it up on close.
await MarkdownRenderer.render(this.app, markdown, this.contentEl, sourcePath, this);
```

Passing the plugin (lives until disabled) or an inline `new Component()` (never unloaded) leaks, and is reported as an error.

## Views

```typescript
export const VIEW_TYPE = 'clip-notes-view';

// Return a new view each time. Do not keep the instance on the plugin.
this.registerView(VIEW_TYPE, (leaf) => new ClipNotesView(leaf));

// Views are deferred until their tab is visible (1.7.2+). Reveal, then check the type.
async function getOpenView(app: App): Promise<ClipNotesView | null> {
  const leaf = app.workspace.getLeavesOfType(VIEW_TYPE).first();
  if (!leaf) return null;
  await app.workspace.revealLeaf(leaf);
  return leaf.view instanceof ClipNotesView ? leaf.view : null;
}
```

- `leaf.view as ClipNotesView` after a `getViewType()` check is wrong: a deferred leaf holds a `DeferredView`.
- To touch a view without revealing it, `await leaf.loadIfDeferred()` — sparingly, it removes the startup optimization.
- Keep the view constructor cheap; Obsidian reopens every saved view on startup. Do not call `detachLeavesOfType()` in `onunload()`.

## DOM

```typescript
// createEl helpers: XSS-safe and typed. innerHTML/outerHTML are errors.
const card = containerEl.createDiv({ cls: 'clip-notes-card' });
card.createEl('h3', { text: item.title, cls: 'clip-notes-card-title' });
card.createSpan({ text: formatDate(item.date, locale) });
el.setText(userInput); // user input always as text
el.empty();            // clear children

// Large lists: build once, append once.
renderList(labels: string[]): void {
  const fragment = createFragment((frag) => {
    for (const label of labels) frag.createDiv({ cls: 'clip-notes-item', text: label });
  });
  this.contentEl.empty();
  this.contentEl.appendChild(fragment);
}

// Debounce with Obsidian's helper.
import { debounce } from 'obsidian';
const refresh = debounce(() => this.render(), 200, true);
this.registerEvent(this.app.vault.on('rename', refresh));

// Defer heavy first paint.
window.requestAnimationFrame(() => this.renderContent());
```

## Pop-out windows

Each pop-out window has its own `window`, `document`, and constructors, so the globals refer to the main window only.

| Instead of | Use |
|------------|-----|
| `document.body.appendChild(el)` | `someEl.doc.body.appendChild(el)` (the window that element is in) |
| `document`, `window` for "the focused window" | `activeDocument`, `activeWindow` |
| `el instanceof HTMLElement`, `evt instanceof MouseEvent` | `el.instanceOf(HTMLElement)`, `evt.instanceOf(MouseEvent)`, `evt.targetNode?.instanceOf(HTMLElement)` |
| `setTimeout(…)`, `globalThis` | `window.setTimeout(…)`, `window` |
| One-time change to `document.body` | Apply per window from `workspace.on('window-open')`, undo on `window-close` |

Renderers that hold a context (canvas, WebGL) re-initialize in `el.onWindowMigrated(callback)`.

## CSS — theme integration

No inline styles and no `<style>` elements. Put classes in `styles.css` and use Obsidian's variables so themes and snippets can restyle the plugin. Prefix every class with the plugin ID.

```css
.clip-notes-card {
  background: var(--background-secondary);
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--radius-m);
  padding: var(--size-4-3);
  color: var(--text-normal);
}
.clip-notes-card-title {
  color: var(--text-accent);
  font-size: var(--font-ui-medium);
}
```

Common variables: `--background-primary`, `--background-secondary`, `--text-normal`, `--text-muted`, `--text-accent`, `--interactive-accent`, `--background-modifier-border`, `--background-modifier-error`, `--font-ui-small/medium/large`, `--radius-s/m/l`. For a value computed at runtime, `el.setCssProps({ '--clip-notes-width': `${width}px` })` and read the variable in CSS.

## Error handling

```typescript
import { Notice, requestUrl } from 'obsidian';

async function fetchData(): Promise<string | null> {
  try {
    const response = await requestUrl({ url: 'https://api.example.com/data' });
    return response.text;
  } catch (error) {
    console.error('[clip-notes] request failed', error); // error/warn/debug are accepted; log is not
    new Notice('Request failed.');
    return null;
  }
}
```

## Dev/production branching

```typescript
declare const DEV: boolean; // defined by esbuild (`define: { DEV: … }`)
if (DEV) console.debug('[clip-notes] state', state); // removed from the production bundle
```

## Path and custom suggesters

For a file or folder path in settings, use the declarative controls; they include vault autocomplete:

```typescript
{ name: 'Template folder location', control: { type: 'folder', key: 'templateFolder' } },
{ name: 'Default template', control: { type: 'file', key: 'template', filter: (file) => file.extension === 'md' } },
```

Write an `AbstractInputSuggest` subclass only for what those do not cover (tags, commands, your own entities), in a modal, or when supporting Obsidian below 1.13.0. Do not copy the old `TextInputSuggest` class; it is reported.

```typescript
import { AbstractInputSuggest, type App } from 'obsidian';

export class TagSuggest extends AbstractInputSuggest<string> {
  constructor(app: App, private readonly inputEl: HTMLInputElement, private readonly tags: string[]) {
    super(app, inputEl);
  }

  protected getSuggestions(query: string): string[] {
    const lower = query.toLowerCase();
    return this.tags.filter((tag) => tag.toLowerCase().includes(lower)).slice(0, 20);
  }

  renderSuggestion(tag: string, el: HTMLElement): void {
    el.setText(tag);
  }

  selectSuggestion(tag: string): void {
    this.setValue(tag);
    this.inputEl.trigger('input'); // fires the Setting's onChange
    this.close();
  }
}

// In getSettingDefinitions(): a render callback, which must save by itself.
{
  name: 'Default tag',
  render: (setting) => {
    setting.addSearch((search) => {
      new TagSuggest(this.app, search.inputEl, this.plugin.knownTags());
      search.setValue(this.plugin.settings.defaultTag).onChange(async (value) => {
        this.plugin.settings = { ...this.plugin.settings, defaultTag: value };
        await this.plugin.saveSettings();
      });
    });
  },
},
```

## CodeMirror 6 editor integration

`@codemirror/*` and `@lezer/*` are provided by Obsidian at runtime: keep them `external` in the build so they are not bundled. Install the ones you import as `devDependencies` at the exact versions `obsidian` lists as peers (`npm view obsidian peerDependencies` — 2026-11: `@codemirror/state` 6.7.6, `@codemirror/view` 6.43.13); the linter warns about an import that is in no dependency list.

```typescript
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

export function createEditorExtension(onChange: (view: EditorView) => void): Extension {
  return EditorView.updateListener.of((update) => {
    if (update.docChanged) onChange(update.view);
  });
}

// main.ts — register one array and mutate it in place to reconfigure
private editorExtension: Extension[] = [];

onload(): void {
  this.registerEditorExtension(this.editorExtension);
}

updateEditorExtension(): void {
  this.editorExtension.length = 0; // keep the same array reference
  this.editorExtension.push(createEditorExtension((view) => this.onDocChange(view)));
  this.app.workspace.updateOptions(); // flush to all open editors
}
```
