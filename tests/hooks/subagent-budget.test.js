/**
 * Tests for scripts/hooks/subagent-budget.js
 *
 * 핵심 계약: 출력은 항상 유효한 JSON, ponytail off 면 빈 객체,
 * 켜져 있으면 SubagentStart additionalContext 를 담는다.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { run, BRIEF } = require('../../scripts/hooks/subagent-budget.js');
const script = path.join(__dirname, '..', '..', 'scripts', 'hooks', 'subagent-budget.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed += 1;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error.message}`);
    failed += 1;
  }
}

// ponytail 상태 파일을 임시 CLAUDE_CONFIG_DIR 로 격리
function withMode(mode, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'subagent-budget-'));
  const prevDir = process.env.CLAUDE_CONFIG_DIR;
  const prevEnvMode = process.env.PONYTAIL_DEFAULT_MODE;
  delete process.env.PONYTAIL_DEFAULT_MODE;
  process.env.CLAUDE_CONFIG_DIR = dir;
  if (mode !== null) fs.writeFileSync(path.join(dir, '.ponytail-active'), mode);
  try {
    return fn();
  } finally {
    if (prevDir === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = prevDir;
    if (prevEnvMode !== undefined) process.env.PONYTAIL_DEFAULT_MODE = prevEnvMode;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const input = JSON.stringify({ hook_event_name: 'SubagentStart', agent_id: 'a1', agent_type: 'code-reviewer' });

test('ponytail full 이면 SubagentStart additionalContext 를 주입한다', () => {
  withMode('full', () => {
    const parsed = JSON.parse(run(input).stdout);
    assert.strictEqual(parsed.hookSpecificOutput.hookEventName, 'SubagentStart');
    assert.ok(parsed.hookSpecificOutput.additionalContext.includes('SUBAGENT BUDGET'));
    assert.match(parsed.hookSpecificOutput.additionalContext, /code-reviewer/);
  });
});

test('ponytail off 면 빈 객체를 낸다', () => {
  withMode('off', () => {
    assert.deepStrictEqual(JSON.parse(run(input).stdout), {});
  });
});

test('상태 파일이 없으면 기본 적용한다', () => {
  withMode(null, () => {
    const parsed = JSON.parse(run(input).stdout);
    assert.ok(parsed.hookSpecificOutput.additionalContext.includes('SUBAGENT BUDGET'));
  });
});

test('HARNESS_SUBAGENT_BUDGET=off 면 빈 객체를 낸다', () => {
  withMode('full', () => {
    process.env.HARNESS_SUBAGENT_BUDGET = 'off';
    try {
      assert.deepStrictEqual(JSON.parse(run(input).stdout), {});
    } finally {
      delete process.env.HARNESS_SUBAGENT_BUDGET;
    }
  });
});

test('HARNESS_DISABLED_HOOKS 로 id 를 끌 수 있다', () => {
  withMode('full', () => {
    process.env.HARNESS_DISABLED_HOOKS = 'subagent:budget';
    try {
      assert.deepStrictEqual(JSON.parse(run(input).stdout), {});
    } finally {
      delete process.env.HARNESS_DISABLED_HOOKS;
    }
  });
});

test('깨진 stdin 에서도 유효한 JSON 을 낸다', () => {
  withMode('full', () => {
    const parsed = JSON.parse(run('not json at all').stdout);
    assert.ok(parsed.hookSpecificOutput.additionalContext.includes('SUBAGENT BUDGET'));
  });
});

test('브리프는 서브에이전트 재귀 생성을 금지한다', () => {
  assert.match(BRIEF, /서브에이전트를 더 생성하지 않는다/);
  assert.match(BRIEF, /입력 검증/); // 안전 예외가 살아있어야 한다
});

test('실제 프로세스 실행 경로도 유효한 JSON 만 낸다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'subagent-budget-proc-'));
  fs.writeFileSync(path.join(dir, '.ponytail-active'), 'full');
  try {
    const result = spawnSync(process.execPath, [script], {
      input,
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_CONFIG_DIR: dir, PONYTAIL_DEFAULT_MODE: '' },
    });
    assert.strictEqual(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.strictEqual(parsed.hookSpecificOutput.hookEventName, 'SubagentStart');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
