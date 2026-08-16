# Hooks

Hooks are event-driven automations that fire before or after Claude Code tool executions. They enforce code quality, catch mistakes early, and automate repetitive checks.

## How Hooks Work

```
User request → Claude picks a tool → PreToolUse hook runs → Tool executes → PostToolUse hook runs
```

- **PreToolUse** hooks run before the tool executes. They can **block** (exit code 2) or **warn** (stderr without blocking).
- **PostToolUse** hooks run after the tool completes. They can analyze output but cannot block.
- **Stop** hooks run after each Claude response.
- **SessionStart/SessionEnd** hooks run at session lifecycle boundaries.
- **PreCompact** hooks run before context compaction, useful for saving state.

## Hooks in This Harness

The hook stack is split in two, and **only the first half is installed by default**:

| File | Groups | Scope |
|---|---:|---|
| `hooks/hooks.json` | 2 | **Core.** Hard-to-undo action blocking only: `pre:bash:dispatcher` (Bash preflight), `subagent:budget` (subagent budget brief) |
| `hooks/hooks-optional.json` | 28 | **Opt-in.** Every quality gate, blocking check, and observer hook (`post:quality-gate`, `stop:run-tests`, `pre:write:doc-file-warning`, `post:harness-context-monitor`, `stop:capture-lessons`, `stop:desktop-notify`, …) |

The design rule: hooks own hard-to-undo action blocking, nothing else; quality, observation,
and governance run as commands (`/quality-gate`, `/code-review`, `/cost-report`) when a human
asks for them. The reason is interference, not cost — a warn/block hook firing on every `Edit`
is the biggest source of instructions that contradict each other. **No core hook binds to
`Edit`, `Write` or `Stop`.** The four lifecycle groups (`session:start`, `stop:session-end`,
`stop:cost-tracker`, `session:end:marker`) were demoted to the opt-in stack on 2026-08-16 —
each wrote a file with no reader under `minimal`, or was already covered by a command.
See `docs/hooks-policy.md` for the per-hook rationale.

Add the opt-in stack per project with `node scripts/install/merge-hooks.js --optional`. The
merge is *declarative*: re-running it without `--optional` sweeps that stack back out.

The tables in the sections below cover **both** stacks. Anything but the two core ids above
requires `--optional`.

Memory persistence lifecycle definitions live in `hooks/memory-persistence/`.
The executable hook graph remains `hooks/hooks.json`; the memory persistence directory is the stable contract for SessionStart, PreCompact, observation, activity tracking, and SessionEnd behavior.

## Installing These Hooks

The recommended path is `install.sh --with-hooks` (or `install.ps1 -WithHooks` on Windows). It symlinks the harness into `~/.claude/` *and* merges the two core groups from `hooks/hooks.json` into `~/.claude/settings.json`. The opt-in stack is a separate step (`merge-hooks.js --optional`, see above).

```bash
./install.sh --with-hooks              # install + merge
./install.sh --with-hooks --dry-run    # preview only, no writes
./install.sh --with-hooks --uninstall  # remove symlinks + harness hook ids
```

What the merge guarantees:

- A timestamped backup is written next to `settings.json` (`settings.json.bak.<ISO>`) before any change.
- Re-running the install replaces the harness-owned entries; it never duplicates them. Note that
  `id` is a report-only field — Claude Code drops keys outside its schema when it rewrites
  `settings.json`, so ownership is decided by the script a group invokes (see below).
- Any hook entry the user added is preserved as-is.
- **The merge is declarative.** After it runs, the harness-owned hooks in `settings.json` match
  exactly the set that was merged — every other harness hook is swept out, including ids retired
  from `hooks.json` and id-less groups left by older installs. Ownership is decided by one test:
  does the command invoke a script we ship through our own launcher? Third-party hooks (Orca's
  `~/.orca/agent-hooks/claude-hook.sh`, for one) carry no such marker and survive untouched.
- Because of that sweep, run `--dry-run` first when you are unsure what will be removed.

If you prefer to merge manually, you can call the merger directly:

```bash
node scripts/install/merge-hooks.js --dry-run    # preview, including the sweep list
node scripts/install/merge-hooks.js              # core stack only
node scripts/install/merge-hooks.js --optional   # core + the 24 opt-in groups
node scripts/install/merge-hooks.js --uninstall
```

Each command in `hooks.json` carries a small inline bootstrap that resolves the harness root at runtime via:

1. `CLAUDE_PLUGIN_ROOT` environment variable (highest priority)
2. `~/.claude/scripts/lib/utils.js` — direct install
3. `~/.claude/_harness/` — symlink created by `install.sh`
4. `~/.claude/plugins/_harness/` — alternative layout

If you want to run hooks without `install.sh`, set `CLAUDE_PLUGIN_ROOT=<path to this repo>` in your shell.

### PreToolUse Hooks

| Hook | Matcher | Behavior | Exit Code |
|------|---------|----------|-----------|
| **Dev server blocker** | `Bash` | Blocks `npm run dev` etc. outside tmux — ensures log access | 2 (blocks) |
| **Tmux reminder** | `Bash` | Suggests tmux for long-running commands (npm test, cargo build, docker) | 0 (warns) |
| **Git push reminder** | `Bash` | Reminds to review changes before `git push` | 0 (warns) |
| **Pre-commit quality check** | `Bash` | Runs quality checks before `git commit`: lints staged files, validates commit message format when provided via `-m/--message`, detects console.log/debugger/secrets | 2 (blocks critical) / 0 (warns) |
| **Doc file warning** | `Write` | Warns about non-standard `.md`/`.txt` files (allows README, CLAUDE, CONTRIBUTING, CHANGELOG, LICENSE, SKILL, docs/, skills/); cross-platform path handling | 0 (warns) |
| **Strategic compact** | `Edit\|Write` | Suggests manual `/compact` at logical intervals (every ~50 tool calls) | 0 (warns) |

### PostToolUse Hooks

| Hook | Matcher | What It Does |
|------|---------|-------------|
| **PR logger** | `Bash` | Logs PR URL and review command after `gh pr create` |
| **Build analysis** | `Bash` | Background analysis after build commands (async, non-blocking) |
| **Quality gate** | `Edit\|Write\|MultiEdit` | Runs fast quality checks after edits |
| **Design quality check** | `Edit\|Write\|MultiEdit` | Warns when frontend edits drift toward generic template-looking UI |
| **Prettier format** | `Edit` | Auto-formats JS/TS files with Prettier after edits |
| **TypeScript check** | `Edit` | Runs `tsc --noEmit` after editing `.ts`/`.tsx` files |
| **console.log warning** | `Edit` | Warns about `console.log` statements in edited files |

### Lifecycle Hooks

| Hook | Event | What It Does |
|------|-------|-------------|
| **Session start** | `SessionStart` | Loads previous context and detects package manager |
| **Pre-compact** | `PreCompact` | Saves state before context compaction |
| **Run tests** | `Stop` | Runs project tests (npm/pnpm/yarn/bun test · pytest · cargo test) when source changed this session — non-blocking, warns on failure (strict; `HARNESS_STOP_TESTS=off` to disable) |
| **Command registry** | `Stop` | Regenerates `COMMAND-REGISTRY.json` when `commands/*.md` changed (harness repo only) — non-blocking (standard+) |
| **Console.log audit** | `Stop` | Checks all modified files for `console.log` after each response |
| **Session summary** | `Stop` | Persists session state when transcript path is available |
| **Pattern extraction** | `Stop` | Evaluates session for extractable patterns (continuous learning) |
| **Cost tracker** | `Stop` | Emits lightweight run-cost telemetry markers |
| **Desktop notify** | `Stop` | Sends macOS desktop notification with task summary (standard+) |
| **Session end marker** | `SessionEnd` | Lifecycle marker and cleanup log |

## Customizing Hooks

### Disabling a Hook

Remove or comment out the hook entry in `hooks.json`. If installed as a plugin, override in your `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write",
        "hooks": [],
        "description": "Override: allow all .md file creation"
      }
    ]
  }
}
```

### Runtime Hook Controls (Recommended)

Use environment variables to control hook behavior without editing `hooks.json`:

```bash
# minimal | standard | strict (default: minimal)
export HARNESS_HOOK_PROFILE=minimal   # install writes this into settings.json env

# Disable specific hook IDs (comma-separated)
export HARNESS_DISABLED_HOOKS="pre:bash:tmux-reminder,post:edit:typecheck"

# Disable only GateGuard during setup or recovery
export HARNESS_GATEGUARD=off

# Cap SessionStart additional context (default: 8000 chars)
export HARNESS_SESSION_START_MAX_CHARS=4000

# Disable SessionStart additional context entirely
export HARNESS_SESSION_START_CONTEXT=off

# Keep context/scope/loop warnings but suppress API-rate cost estimates
export HARNESS_CONTEXT_MONITOR_COST_WARNINGS=off
```

Windows PowerShell:

```powershell
[Environment]::SetEnvironmentVariable('HARNESS_CONTEXT_MONITOR_COST_WARNINGS', 'off', 'User')
```

Profiles. All three install the same six core groups — the profile no longer changes *how many*
groups run, only how strict the sub-hooks inside `pre:bash:dispatcher` are:

- `minimal` — **default.** `block-no-verify` and `git-push-reminder` (default-branch push: warns here, blocks under `strict`).
- `standard` — adds `auto-tmux-dev`.
- `strict` — adds `tmux-reminder`, `commit-quality`, `gateguard-fact-force`.

`gateguard-fact-force` is `strict`-only. When you change a profile CSV, edit both `hooks.json`
and the dispatcher copy — a past drift where only the dispatcher said `standard,strict` blocked
the first `Bash` call of every `standard` session.

### Writing Your Own Hook

Hooks are shell commands that receive tool input as JSON on stdin and must output JSON on stdout.

**Basic structure:**

```javascript
// my-hook.js
let data = '';
process.stdin.on('data', chunk => data += chunk);
process.stdin.on('end', () => {
  const input = JSON.parse(data);

  // Access tool info
  const toolName = input.tool_name;        // "Edit", "Bash", "Write", etc.
  const toolInput = input.tool_input;      // Tool-specific parameters
  const toolOutput = input.tool_output;    // Only available in PostToolUse

  // Warn (non-blocking): write to stderr
  console.error('[Hook] Warning message shown to Claude');

  // Block (PreToolUse only): exit with code 2
  // process.exit(2);

  // Always output the original data to stdout
  console.log(data);
});
```

**Exit codes:**
- `0` — Success (continue execution)
- `2` — Block the tool call (PreToolUse only)
- Other non-zero — Error (logged but does not block)

### Hook Input Schema

```typescript
interface HookInput {
  tool_name: string;          // "Bash", "Edit", "Write", "Read", etc.
  tool_input: {
    command?: string;         // Bash: the command being run
    file_path?: string;       // Edit/Write/Read: target file
    old_string?: string;      // Edit: text being replaced
    new_string?: string;      // Edit: replacement text
    content?: string;         // Write: file content
  };
  tool_output?: {             // PostToolUse only
    output?: string;          // Command/tool output
  };
}
```

### Async Hooks

For hooks that should not block the main flow (e.g., background analysis):

```json
{
  "type": "command",
  "command": "node my-slow-hook.js",
  "async": true,
  "timeout": 30
}
```

Async hooks run in the background. They cannot block tool execution.

## Common Hook Recipes

### Warn about TODO comments

```json
{
  "matcher": "Edit",
  "hooks": [{
    "type": "command",
    "command": "node -e \"let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const i=JSON.parse(d);const ns=i.tool_input?.new_string||'';if(/TODO|FIXME|HACK/.test(ns)){console.error('[Hook] New TODO/FIXME added - consider creating an issue')}console.log(d)})\""
  }],
  "description": "Warn when adding TODO/FIXME comments"
}
```

### Block large file creation

```json
{
  "matcher": "Write",
  "hooks": [{
    "type": "command",
    "command": "node -e \"let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const i=JSON.parse(d);const c=i.tool_input?.content||'';const lines=c.split('\\n').length;if(lines>800){console.error('[Hook] BLOCKED: File exceeds 800 lines ('+lines+' lines)');console.error('[Hook] Split into smaller, focused modules');process.exit(2)}console.log(d)})\""
  }],
  "description": "Block creation of files larger than 800 lines"
}
```

### Auto-format Python files with ruff

```json
{
  "matcher": "Edit",
  "hooks": [{
    "type": "command",
    "command": "node -e \"let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const i=JSON.parse(d);const p=i.tool_input?.file_path||'';if(/\\.py$/.test(p)){const{execFileSync}=require('child_process');try{execFileSync('ruff',['format',p],{stdio:'pipe'})}catch(e){}}console.log(d)})\""
  }],
  "description": "Auto-format Python files with ruff after edits"
}
```

### Require test files alongside new source files

```json
{
  "matcher": "Write",
  "hooks": [{
    "type": "command",
    "command": "node -e \"const fs=require('fs');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const i=JSON.parse(d);const p=i.tool_input?.file_path||'';if(/src\\/.*\\.(ts|js)$/.test(p)&&!/\\.test\\.|\\.spec\\./.test(p)){const testPath=p.replace(/\\.(ts|js)$/,'.test.$1');if(!fs.existsSync(testPath)){console.error('[Hook] No test file found for: '+p);console.error('[Hook] Expected: '+testPath);console.error('[Hook] Consider writing tests first (/tdd)')}}console.log(d)})\""
  }],
  "description": "Remind to create tests when adding new source files"
}
```

## Cross-Platform Notes

Hook logic is implemented in Node.js scripts for cross-platform behavior on Windows, macOS, and Linux.

## Related

- [docs/rules-reference/hooks.md](../docs/rules-reference/hooks.md) — Hook architecture guidelines
- [scripts/hooks/](../scripts/hooks/) — Hook script implementations
