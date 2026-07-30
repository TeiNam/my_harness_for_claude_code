/**
 * Tests for pre-bash-git-push-reminder.js and pre-bash-tmux-reminder.js hooks
 *
 * Run with: node tests/hooks/pre-bash-reminders.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const gitPushScript = path.join(__dirname, '..', '..', 'scripts', 'hooks', 'pre-bash-git-push-reminder.js');
const tmuxScript = path.join(__dirname, '..', '..', 'scripts', 'hooks', 'pre-bash-tmux-reminder.js');

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${err.message}`);
    return false;
  }
}

function runScript(scriptPath, command, envOverrides = {}, cwd = process.cwd()) {
  const input = { tool_input: { command } };
  const inputStr = JSON.stringify(input);
  const result = spawnSync('node', [scriptPath], {
    encoding: 'utf8',
    input: inputStr,
    timeout: 10000,
    cwd,
    env: { ...process.env, ...envOverrides }
  });
  return { code: result.status || 0, stdout: result.stdout || '', stderr: result.stderr || '', inputStr };
}

/** main 브랜치만 있는 임시 레포 — 훅의 기본 브랜치 판정을 결정적으로 만든다. */
function makeTempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-push-hook-'));
  spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
  spawnSync('git', ['commit', '-q', '--allow-empty', '-m', 'init'], {
    cwd: dir,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@t',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@t'
    }
  });
  return dir;
}

function runTests() {
  console.log('\n=== Testing pre-bash-git-push-reminder.js & pre-bash-tmux-reminder.js ===\n');

  let passed = 0;
  let failed = 0;

  // --- git-push-reminder (기본 브랜치 직접 푸시 게이트) ---

  console.log('  git-push-reminder:');

  const repo = makeTempRepo();
  const noBypass = { HARNESS_ALLOW_MAIN_PUSH: '' };

  test('main 직접 푸시는 standard 에서 경고만', () => {
    const result = runScript(gitPushScript, 'git push origin main', { ...noBypass, HARNESS_HOOK_PROFILE: 'standard' }, repo);
    assert.strictEqual(result.code, 0, `Expected exit code 0, got ${result.code}`);
    assert.ok(result.stderr.includes('WARNING'), `Expected WARNING, got: ${result.stderr}`);
    assert.strictEqual(result.stdout, result.inputStr, 'Expected passthrough on warn');
  })
    ? passed++
    : failed++;

  test('main 직접 푸시는 strict 에서 차단', () => {
    const result = runScript(gitPushScript, 'git push origin main', { ...noBypass, HARNESS_HOOK_PROFILE: 'strict' }, repo);
    assert.strictEqual(result.code, 2, `Expected exit code 2, got ${result.code}`);
    assert.ok(result.stderr.includes('BLOCKED'), `Expected BLOCKED, got: ${result.stderr}`);
  })
    ? passed++
    : failed++;

  test('feature 브랜치 푸시는 통과', () => {
    const result = runScript(gitPushScript, 'git push -u origin feat/thing', { ...noBypass, HARNESS_HOOK_PROFILE: 'strict' }, repo);
    assert.strictEqual(result.code, 0, `Expected exit code 0, got ${result.code}`);
    assert.strictEqual(result.stderr, '', `Expected no stderr, got: ${result.stderr}`);
  })
    ? passed++
    : failed++;

  test('refspec 없는 push 는 현재 브랜치(main)로 판정', () => {
    const result = runScript(gitPushScript, 'git push', { ...noBypass, HARNESS_HOOK_PROFILE: 'strict' }, repo);
    assert.strictEqual(result.code, 2, `Expected exit code 2, got ${result.code}`);
  })
    ? passed++
    : failed++;

  test('HARNESS_ALLOW_MAIN_PUSH=1 은 우회', () => {
    const result = runScript(gitPushScript, 'git push origin main', { HARNESS_ALLOW_MAIN_PUSH: '1', HARNESS_HOOK_PROFILE: 'strict' }, repo);
    assert.strictEqual(result.code, 0, `Expected exit code 0, got ${result.code}`);
    assert.strictEqual(result.stderr, '', `Expected no stderr, got: ${result.stderr}`);
  })
    ? passed++
    : failed++;

  test('--tags 푸시는 대상 아님', () => {
    const result = runScript(gitPushScript, 'git push --tags origin main', { ...noBypass, HARNESS_HOOK_PROFILE: 'strict' }, repo);
    assert.strictEqual(result.code, 0, `Expected exit code 0, got ${result.code}`);
  })
    ? passed++
    : failed++;

  test('git status 는 무반응', () => {
    const result = runScript(gitPushScript, 'git status', noBypass, repo);
    assert.strictEqual(result.code, 0, `Expected exit code 0, got ${result.code}`);
    assert.strictEqual(result.stderr, '', `Expected no stderr, got: ${result.stderr}`);
    assert.strictEqual(result.stdout, result.inputStr, 'Expected stdout to match original input');
  })
    ? passed++
    : failed++;

  fs.rmSync(repo, { recursive: true, force: true });

  // --- tmux-reminder tests (non-Windows only) ---

  const isWindows = process.platform === 'win32';

  if (!isWindows) {
    console.log('\n  tmux-reminder:');

    test('npm install triggers tmux suggestion', () => {
      const result = runScript(tmuxScript, 'npm install', { TMUX: '' });
      assert.strictEqual(result.code, 0, `Expected exit code 0, got ${result.code}`);
      assert.ok(result.stderr.includes('[Hook]'), `Expected stderr to contain [Hook], got: ${result.stderr}`);
      assert.ok(result.stderr.includes('tmux'), `Expected stderr to mention tmux`);
    })
      ? passed++
      : failed++;

    test('npm test triggers tmux suggestion', () => {
      const result = runScript(tmuxScript, 'npm test', { TMUX: '' });
      assert.strictEqual(result.code, 0, `Expected exit code 0, got ${result.code}`);
      assert.ok(result.stderr.includes('tmux'), `Expected stderr to mention tmux`);
    })
      ? passed++
      : failed++;

    test('regular command like ls has no tmux suggestion', () => {
      const result = runScript(tmuxScript, 'ls -la', { TMUX: '' });
      assert.strictEqual(result.code, 0, `Expected exit code 0, got ${result.code}`);
      assert.strictEqual(result.stderr, '', `Expected no stderr for ls, got: ${result.stderr}`);
    })
      ? passed++
      : failed++;

    test('tmux reminder always passes through input on stdout', () => {
      const result = runScript(tmuxScript, 'npm install', { TMUX: '' });
      assert.strictEqual(result.stdout, result.inputStr, 'Expected stdout to match original input');
    })
      ? passed++
      : failed++;
  } else {
    console.log('\n  (skipping tmux-reminder tests on Windows)\n');
  }

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
