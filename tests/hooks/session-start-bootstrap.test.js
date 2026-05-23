/**
 * Tests for scripts/hooks/session-start-bootstrap.js
 *
 * 회귀 테스트: CLAUDE_HOME 이 ~/.claude 가 아니어도 (= 프로젝트 로컬 설치)
 * CLAUDE_PROJECT_DIR/.claude/_harness 후보가 잡혀야 한다.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { hasRunnerRoot, resolvePluginRoot } = require('../../scripts/hooks/session-start-bootstrap');

function tmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `harness-bootstrap-${prefix}-`));
}

function makeHarnessRoot(dir) {
  // 부트스트랩이 root 인지 판단할 때 보는 마커 파일.
  const runner = path.join(dir, 'scripts', 'hooks', 'run-with-flags.js');
  fs.mkdirSync(path.dirname(runner), { recursive: true });
  fs.writeFileSync(runner, '#!/usr/bin/env node\n');
}

function withEnv(overrides, fn) {
  const original = {};
  for (const k of Object.keys(overrides)) {
    original[k] = process.env[k];
    if (overrides[k] === undefined) delete process.env[k];
    else process.env[k] = overrides[k];
  }
  try {
    return fn();
  } finally {
    for (const k of Object.keys(original)) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
  }
}

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (e) {
    console.log(`  ✗ ${name}\n    Error: ${e.message}`);
    return false;
  }
}

function runTests() {
  console.log('\n=== Testing scripts/hooks/session-start-bootstrap.js ===\n');
  let passed = 0;
  let failed = 0;

  if (test('hasRunnerRoot is false for missing / blank / non-string input', () => {
    assert.strictEqual(hasRunnerRoot(''), false);
    assert.strictEqual(hasRunnerRoot('   '), false);
    assert.strictEqual(hasRunnerRoot(undefined), false);
    assert.strictEqual(hasRunnerRoot(null), false);
    assert.strictEqual(hasRunnerRoot(42), false);
    assert.strictEqual(hasRunnerRoot('/nonexistent/harness/root'), false);
  })) passed++; else failed++;

  if (test('hasRunnerRoot is true when run-with-flags.js exists at the candidate', () => {
    const dir = tmp('runner');
    try {
      makeHarnessRoot(dir);
      assert.strictEqual(hasRunnerRoot(dir), true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (test('CLAUDE_PLUGIN_ROOT wins when valid', () => {
    const envRoot = tmp('env-root');
    try {
      makeHarnessRoot(envRoot);
      const result = withEnv({ CLAUDE_PLUGIN_ROOT: envRoot, CLAUDE_PROJECT_DIR: undefined }, () =>
        resolvePluginRoot()
      );
      assert.strictEqual(path.resolve(result), path.resolve(envRoot));
    } finally {
      fs.rmSync(envRoot, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (test('falls through to next candidate when CLAUDE_PLUGIN_ROOT is invalid', () => {
    const projectRoot = tmp('project');
    try {
      const projectClaudeHarness = path.join(projectRoot, '.claude', '_harness');
      makeHarnessRoot(projectClaudeHarness);
      const result = withEnv(
        {
          CLAUDE_PLUGIN_ROOT: '/path/that/does/not/exist',
          CLAUDE_PROJECT_DIR: projectRoot,
        },
        () => resolvePluginRoot()
      );
      assert.strictEqual(path.resolve(result), path.resolve(projectClaudeHarness));
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (test('resolves $CLAUDE_PROJECT_DIR/.claude/_harness when only project-local install exists', () => {
    const projectRoot = tmp('project-local');
    try {
      const projectClaudeHarness = path.join(projectRoot, '.claude', '_harness');
      makeHarnessRoot(projectClaudeHarness);
      const result = withEnv(
        { CLAUDE_PLUGIN_ROOT: '', CLAUDE_PROJECT_DIR: projectRoot },
        () => resolvePluginRoot()
      );
      assert.strictEqual(path.resolve(result), path.resolve(projectClaudeHarness));
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (test('resolves $CLAUDE_PROJECT_DIR/.claude when runner sits directly under it', () => {
    const projectRoot = tmp('project-direct');
    try {
      const projectClaude = path.join(projectRoot, '.claude');
      makeHarnessRoot(projectClaude);
      const result = withEnv(
        { CLAUDE_PLUGIN_ROOT: '', CLAUDE_PROJECT_DIR: projectRoot },
        () => resolvePluginRoot()
      );
      assert.strictEqual(path.resolve(result), path.resolve(projectClaude));
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (test('CLAUDE_PROJECT_DIR candidate beats $HOME/.claude when both exist', () => {
    // 회귀 의도: 프로젝트 로컬 설치가 있는데 home fallback 으로 빠지면 안 된다.
    // 단, $HOME 을 직접 갈아끼울 수는 없으므로 전제: 호스트 $HOME/.claude 가
    // 살아 있을 수 있다. 우선순위 순서만 확인.
    const projectRoot = tmp('project-priority');
    try {
      const projectClaudeHarness = path.join(projectRoot, '.claude', '_harness');
      makeHarnessRoot(projectClaudeHarness);
      const result = withEnv(
        { CLAUDE_PLUGIN_ROOT: '', CLAUDE_PROJECT_DIR: projectRoot },
        () => resolvePluginRoot()
      );
      // 결과가 home 의 어떤 후보가 아니라 우리가 만든 project-local 후보여야 한다.
      assert.strictEqual(path.resolve(result), path.resolve(projectClaudeHarness));
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
