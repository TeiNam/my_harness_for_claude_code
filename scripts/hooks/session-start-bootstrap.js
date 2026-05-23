#!/usr/bin/env node
'use strict';

/**
 * session-start-bootstrap.js
 *
 * Bootstrap loader for the SessionStart hook.
 *
 * Problem this solves: the previous approach embedded this logic as an inline
 * `node -e "..."` string inside hooks.json. Characters like `!` (used in
 * `!org.isDirectory()`) can trigger bash history expansion or other shell
 * interpretation issues depending on the environment, causing
 * "SessionStart:startup hook error" to appear in the Claude Code CLI header.
 *
 * By extracting to a standalone file, the shell never sees the JavaScript
 * source and the `!` characters are safe. Behaviour is otherwise identical.
 *
 * How it works:
 *   1. Reads the raw JSON event from stdin (passed by Claude Code).
 *   2. Resolves the harness root directory (via CLAUDE_PLUGIN_ROOT env var
 *      or a set of well-known fallback paths created by install.sh).
 *   3. Delegates to `scripts/hooks/run-with-flags.js` with the `session:start`
 *      event, which applies hook-profile gating and then runs session-start.js.
 *   4. Passes stdout/stderr through and forwards the child exit code.
 *   5. If the harness root cannot be found, emits a warning and passes stdin
 *      through unchanged so Claude Code can continue normally.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Path (relative to harness root) to the hook runner
const rel = path.join('scripts', 'hooks', 'run-with-flags.js');

/**
 * Returns true when `candidate` looks like a valid harness root, i.e. the
 * run-with-flags.js runner exists inside it.
 *
 * @param {unknown} candidate
 * @returns {boolean}
 */
function hasRunnerRoot(candidate) {
  const value = typeof candidate === 'string' ? candidate.trim() : '';
  return value.length > 0 && fs.existsSync(path.join(path.resolve(value), rel));
}

/**
 * Resolves the harness root using the following priority order:
 *   1. CLAUDE_PLUGIN_ROOT environment variable
 *   2. $CLAUDE_PROJECT_DIR/.claude/_harness (project-local install)
 *   3. $CLAUDE_PROJECT_DIR/.claude (direct project-local install)
 *   4. ~/.claude (direct install)
 *   5. ~/.claude/_harness (root-level symlink created by install.sh)
 *   6. ~/.claude/plugins/_harness (alternative install layout)
 *   7. Falls back to ~/.claude if nothing else matches
 *
 * @returns {string}
 */
function resolvePluginRoot() {
  const envRoot = process.env.CLAUDE_PLUGIN_ROOT || '';
  if (hasRunnerRoot(envRoot)) {
    return path.resolve(envRoot.trim());
  }

  const candidates = [];

  const projectDir = process.env.CLAUDE_PROJECT_DIR;
  if (projectDir) {
    const projectClaude = path.join(projectDir, '.claude');
    candidates.push(path.join(projectClaude, '_harness'), projectClaude);
  }

  const home = require('os').homedir();
  const claudeDir = path.join(home, '.claude');
  candidates.push(
    claudeDir,
    path.join(claudeDir, '_harness'),
    path.join(claudeDir, 'plugins', '_harness'),
  );

  for (const candidate of candidates) {
    if (hasRunnerRoot(candidate)) {
      return candidate;
    }
  }

  return claudeDir;
}

function main() {
  // Read the raw JSON event from stdin
  const raw = fs.readFileSync(0, 'utf8');
  const root = resolvePluginRoot();
  const script = path.join(root, rel);

  if (fs.existsSync(script)) {
    const result = spawnSync(
      process.execPath,
      [script, 'session:start', 'scripts/hooks/session-start.js', 'minimal,standard,strict'],
      {
        input: raw,
        encoding: 'utf8',
        env: process.env,
        cwd: process.cwd(),
        timeout: 30000,
      }
    );

    const stdout = typeof result.stdout === 'string' ? result.stdout : '';
    if (stdout) {
      process.stdout.write(stdout);
    } else {
      process.stdout.write(raw);
    }

    if (result.stderr) {
      process.stderr.write(result.stderr);
    }

    if (result.error || result.status === null || result.signal) {
      const reason = result.error
        ? result.error.message
        : result.signal
          ? 'signal ' + result.signal
          : 'missing exit status';
      process.stderr.write('[SessionStart] ERROR: session-start hook failed: ' + reason + '\n');
      process.exit(1);
    }

    process.exit(Number.isInteger(result.status) ? result.status : 0);
  }

  process.stderr.write(
    '[SessionStart] WARNING: could not resolve harness root; skipping session-start hook\n'
  );
  process.stdout.write(raw);
}

if (require.main === module) {
  main();
}

module.exports = { hasRunnerRoot, resolvePluginRoot };
