/**
 * Tests for scripts/install/optimize-settings.js.
 *
 * Two properties matter most here:
 *   1. It never prints a secret value — only a sha prefix and a length. A tool
 *      that leaks while auditing for leaks is worse than no tool.
 *   2. It never overwrites a value the user chose. `standard`/`strict` and an
 *      invalid profile are both left alone; only a *missing* value is written.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', '..', '..', 'scripts', 'install', 'optimize-settings.js');
const { audit, applyFixes, isSecretName, harnessEnvNamesReadByCode, envNamesUsedOnlyByOptionalStack } = require('../../../scripts/install/optimize-settings');
const { LINEUP, expectedLineup, resolveModelId, stripVariant } = require('../../../scripts/lib/model-lineup');
const REPO_ROOT = path.join(__dirname, '..', '..', '..');

// A name no shipped script reads, so it must be reported dead.
const RETIRED = 'HARNESS_RETIRED_TEST_ONLY';
// Read only by an opt-in hook, so it is inert while the profile is minimal.
const OPTIONAL_ONLY = 'HARNESS_CONTEXT_MONITOR_COST_WARNINGS';
// A value that must never appear in output.
const FAKE_SECRET = 'zzz-not-a-real-key-3f9a1c7e-do-not-print';

function rawHome(settings, extras = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-optimize-'));
  fs.writeFileSync(path.join(home, 'settings.json'), `${JSON.stringify(settings, null, 2)}\n`);
  for (const [name, body] of Object.entries(extras)) {
    const target = path.join(home, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, typeof body === 'string' ? body : `${JSON.stringify(body, null, 2)}\n`);
  }
  return home;
}

// 프로바이더 감지가 이 머신의 셸 env(Bedrock 여부)에 끌려가지 않게 비운다.
const HERMETIC_ENV = { ...process.env, CLAUDE_CODE_USE_BEDROCK: '', ANTHROPIC_BEDROCK_REGION_PREFIX: '' };
// 모델 라인업까지 맞춘 "고칠 것 없는" 설정 조각.
const LINEUP_OK = expectedLineup({});
const withLineup = (settings = {}) => ({ ...settings, env: { ...LINEUP_OK.pins, ...(settings.env || {}) }, availableModels: LINEUP_OK.availableModels });
// 기본 픽스처는 모델 라인업이 맞춰진 상태다 — 각 테스트가 자기 관심사만 보게 한다. 라인업 자체를 볼 때는 rawHome.
const tmpHome = (settings, extras) => rawHome(withLineup(settings), extras);

function run(home, args = []) {
  try {
    return { code: 0, stdout: execFileSync('node', [SCRIPT, `--claude-home=${home}`, ...args], { encoding: 'utf8', env: HERMETIC_ENV }) };
  } catch (e) {
    return { code: e.status || 1, stdout: e.stdout || '', stderr: e.stderr || '' };
  }
}

const auditHome = home => audit({ claudeHome: home, settingsPath: path.join(home, 'settings.json'), root: REPO_ROOT, processEnv: {} });

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
  console.log('\n=== Testing scripts/install/optimize-settings.js ===\n');
  let passed = 0;
  let failed = 0;

  if (test('reports a missing hook profile as fixable and writes minimal on --apply', () => {
    const home = tmpHome({ env: { AWS_REGION: 'ap-northeast-2' } });
    const before = auditHome(home);
    assert.strictEqual(before.findings['hook-profile'].length, 1, JSON.stringify(before.findings));
    assert.strictEqual(before.findings['hook-profile'][0].issue, 'missing');
    assert.strictEqual(run(home).code, 1, 'a fixable finding must fail the check');

    assert.strictEqual(run(home, ['--apply']).code, 0);
    const after = JSON.parse(fs.readFileSync(path.join(home, 'settings.json'), 'utf8'));
    assert.strictEqual(after.env.HARNESS_HOOK_PROFILE, 'minimal');
    assert.strictEqual(after.env.AWS_REGION, 'ap-northeast-2', 'unrelated env must survive');
    fs.rmSync(home, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('leaves an invalid profile value alone and reports it', () => {
    const home = tmpHome({ env: { HARNESS_HOOK_PROFILE: 'minimum' } });
    const result = auditHome(home);
    assert.strictEqual(result.findings['hook-profile'][0].issue, 'invalid');
    assert.strictEqual(result.findings['hook-profile'][0].fixable, false, 'must not silently overwrite user data');
    assert.strictEqual(result.actionable, 0);

    run(home, ['--apply']);
    const after = JSON.parse(fs.readFileSync(path.join(home, 'settings.json'), 'utf8'));
    assert.strictEqual(after.env.HARNESS_HOOK_PROFILE, 'minimum', 'the bad value is the user’s to fix');
    fs.rmSync(home, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('accepts standard and strict without a finding', () => {
    for (const profile of ['standard', 'strict']) {
      const home = tmpHome({ env: { HARNESS_HOOK_PROFILE: profile } });
      const result = auditHome(home);
      assert.deepStrictEqual(result.findings['hook-profile'], [], `${profile} should be valid`);
      assert.strictEqual(result.effectiveProfile, profile);
      fs.rmSync(home, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (test('flags a HARNESS_* env no shipped script reads', () => {
    const home = tmpHome({ env: { HARNESS_HOOK_PROFILE: 'minimal', [RETIRED]: '1' } });
    const result = auditHome(home);
    assert.deepStrictEqual(result.findings['dead-env'].map(f => f.name), [RETIRED]);

    run(home, ['--apply']);
    const after = JSON.parse(fs.readFileSync(path.join(home, 'settings.json'), 'utf8'));
    assert.ok(!(RETIRED in after.env), 'dead env should be removed');
    assert.strictEqual(after.env.HARNESS_HOOK_PROFILE, 'minimal', 'live env must survive');
    fs.rmSync(home, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('does not flag a HARNESS_* env the code still reads', () => {
    const live = [...harnessEnvNamesReadByCode(REPO_ROOT)].find(n => n !== 'HARNESS_HOOK_PROFILE');
    assert.ok(live, 'repo should read at least one other HARNESS_* var');
    const home = tmpHome({ env: { HARNESS_HOOK_PROFILE: 'standard', [live]: 'x' } });
    const result = auditHome(home);
    assert.deepStrictEqual(result.findings['dead-env'], [], `${live} is read by the repo`);
    fs.rmSync(home, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('calls an optional-stack env inert under minimal, not under standard', () => {
    assert.ok(envNamesUsedOnlyByOptionalStack(REPO_ROOT).has(OPTIONAL_ONLY), `${OPTIONAL_ONLY} should be optional-only`);

    const minimal = tmpHome({ env: { HARNESS_HOOK_PROFILE: 'minimal', [OPTIONAL_ONLY]: 'off' } });
    const a = auditHome(minimal);
    assert.deepStrictEqual(a.findings['inert-env'].map(f => f.name), [OPTIONAL_ONLY]);
    assert.strictEqual(a.actionable, 0, 'inert is informational — nothing to fix');
    fs.rmSync(minimal, { recursive: true, force: true });

    const standard = tmpHome({ env: { HARNESS_HOOK_PROFILE: 'standard', [OPTIONAL_ONLY]: 'off' } });
    const b = auditHome(standard);
    assert.deepStrictEqual(b.findings['inert-env'], [], 'the value has an effect at standard');
    fs.rmSync(standard, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('finds a secret-bearing backup and never prints the value', () => {
    const home = tmpHome(
      { env: { HARNESS_HOOK_PROFILE: 'minimal' } },
      { 'settings.json.bak.2026-01-01T00-00-00-000Z': { env: { AWS_BEARER_TOKEN_BEDROCK: FAKE_SECRET } } }
    );
    const out = run(home).stdout;
    assert.ok(out.includes('secret-backups (1)'), out);
    assert.ok(!out.includes(FAKE_SECRET), 'the secret value must never be printed');
    assert.ok(/sha=[0-9a-f]{8} len=\d+/.test(out), `expected a fingerprint, got:\n${out}`);

    const json = JSON.parse(run(home, ['--json']).stdout);
    assert.ok(!JSON.stringify(json).includes(FAKE_SECRET), 'json output must not carry the value either');
    fs.rmSync(home, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('--apply deletes secret-bearing backups', () => {
    const backup = 'settings.json.bak.2026-01-01T00-00-00-000Z';
    const home = tmpHome({ env: { HARNESS_HOOK_PROFILE: 'minimal' } }, { [backup]: { env: { GITHUB_PAT: FAKE_SECRET } } });
    assert.strictEqual(run(home, ['--apply']).code, 0);
    assert.ok(!fs.existsSync(path.join(home, backup)), 'the copy is a duplicate of a secret — it goes');
    fs.rmSync(home, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('ignores a backup with no secret-shaped env key', () => {
    const home = tmpHome(
      { env: { HARNESS_HOOK_PROFILE: 'minimal' } },
      { 'settings.json.bak.2026-01-01T00-00-00-000Z': { env: { AWS_REGION: 'ap-northeast-2' }, model: 'x' } }
    );
    const result = auditHome(home);
    assert.deepStrictEqual(result.findings['secret-backups'], [], 'a backup without secrets is just a backup');
    fs.rmSync(home, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('recognises every secret name this machine actually holds', () => {
    // The six moved to the macOS keychain plus the Bedrock token. GITHUB_PAT is
    // the one a substring rule misses — `PAT` has to be matched as a segment.
    for (const name of ['OBSIDIAN_API_KEY', 'BRAVE_API_KEY', 'GITHUB_PAT', 'GODADDY_KEY', 'GODADDY_SECRET_KEY', 'AWS_BEARER_TOKEN_BEDROCK']) {
      assert.strictEqual(isSecretName(name), true, `${name} must be treated as a secret`);
    }
  })) passed++; else failed++;

  if (test('token- and PAT-shaped non-secrets are not flagged', () => {
    // Flagging these would train the reader to ignore the warning, and then a
    // real key would be ignored with it.
    for (const name of ['CLAUDE_CODE_MAX_OUTPUT_TOKENS', 'MAX_THINKING_TOKENS', 'AWS_REGION', 'PATH', 'CLAUDE_PATH', 'COMPATIBLE_MODE', 'HARNESS_ID_PREFIXES']) {
      assert.strictEqual(isSecretName(name), false, `${name} is not a secret`);
    }
  })) passed++; else failed++;

  if (test('reports skills whose description exceeds skillListingMaxDescChars', () => {
    const home = tmpHome({ env: { HARNESS_HOOK_PROFILE: 'minimal' }, skillListingMaxDescChars: 40 });
    const mk = (name, desc) => {
      const dir = path.join(home, 'skills', name);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: ${desc}\n---\n\nbody\n`);
    };
    mk('short-one', 'brief');
    mk('long-one', 'x'.repeat(120));

    const result = auditHome(home);
    assert.strictEqual(result.listing.count, 2);
    assert.deepStrictEqual(result.findings['skill-listing'][0].skills.map(s => s.skill), ['long-one']);
    assert.strictEqual(result.actionable, 0, 'a cap breach needs a human decision, not an auto-fix');
    fs.rmSync(home, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('exits 0 and says so when there is nothing to optimize', () => {
    const home = tmpHome(withLineup({ env: { HARNESS_HOOK_PROFILE: 'minimal' } }));
    const r = run(home);
    assert.strictEqual(r.code, 0, r.stdout);
    assert.ok(r.stdout.includes('최적화할 것이 없습니다'), r.stdout);
    fs.rmSync(home, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('applyFixes drops env entirely when the last key goes', () => {
    const home = tmpHome(withLineup({ env: { [RETIRED]: '1' }, model: 'keep-me' }));
    // 프로파일이 없으므로 기록되고, 죽은 env 는 지워진다 → env 는 남는다.
    run(home, ['--apply']);
    let after = JSON.parse(fs.readFileSync(path.join(home, 'settings.json'), 'utf8'));
    assert.deepStrictEqual(Object.keys(after.env).sort(), ['HARNESS_HOOK_PROFILE', ...Object.keys(LINEUP_OK.pins)].sort());
    assert.strictEqual(after.model, 'keep-me', 'the default model is the user\'s choice and is never rewritten');

    // 이제 프로파일만 있는 상태에서 죽은 env 만 지우는 경로를 직접 검증한다.
    const settings = { env: { [RETIRED]: '1' } };
    const findings = { 'hook-profile': [], 'dead-env': [{ name: RETIRED, fixable: true }], 'inert-env': [], 'secret-backups': [], 'skill-listing': [] };
    const target = path.join(home, 'settings.json');
    applyFixes({ claudeHome: home, settingsPath: target, findings, settings });
    after = JSON.parse(fs.readFileSync(target, 'utf8'));
    assert.ok(!('env' in after), 'an empty env object should not be left behind');
    fs.rmSync(home, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('model lineup: unpinned aliases and a missing allow-list are reported and fixed by --apply', () => {
    const home = rawHome({ env: { HARNESS_HOOK_PROFILE: 'minimal' } });
    const before = auditHome(home).findings['model-lineup'];
    assert.deepStrictEqual(before.map(f => f.name).sort(), [...Object.keys(LINEUP_OK.pins), 'availableModels'].sort());
    assert.strictEqual(run(home).code, 1, 'an unpinned lineup must fail the read-only check');

    run(home, ['--apply']);
    const after = JSON.parse(fs.readFileSync(path.join(home, 'settings.json'), 'utf8'));
    assert.strictEqual(after.env.ANTHROPIC_DEFAULT_FABLE_MODEL, 'claude-fable-5-2');
    assert.strictEqual(after.env.ANTHROPIC_DEFAULT_OPUS_MODEL, 'claude-opus-5-5');
    assert.strictEqual(after.env.ANTHROPIC_DEFAULT_SONNET_MODEL, 'claude-sonnet-5-5');
    assert.strictEqual(after.env.ANTHROPIC_DEFAULT_HAIKU_MODEL, 'claude-haiku-5-5');
    assert.deepStrictEqual(after.availableModels, LINEUP_OK.availableModels);
    assert.strictEqual(run(home).code, 0, 'clean after apply');
    fs.rmSync(home, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('model lineup: a previous-generation pin or allow-list entry is replaced', () => {
    const home = tmpHome(withLineup({
      env: { HARNESS_HOOK_PROFILE: 'minimal', ANTHROPIC_DEFAULT_HAIKU_MODEL: 'claude-haiku-4-5', ANTHROPIC_DEFAULT_FABLE_MODEL: 'claude-fable-5-1' }
    }));
    const settingsPath = path.join(home, 'settings.json');
    const stale = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    fs.writeFileSync(settingsPath, JSON.stringify({ ...stale, availableModels: [...stale.availableModels, 'claude-opus-5'] }));

    const names = auditHome(home).findings['model-lineup'].map(f => f.name).sort();
    assert.deepStrictEqual(names, ['ANTHROPIC_DEFAULT_FABLE_MODEL', 'ANTHROPIC_DEFAULT_HAIKU_MODEL', 'availableModels']);
    run(home, ['--apply']);
    const after = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    assert.strictEqual(after.env.ANTHROPIC_DEFAULT_HAIKU_MODEL, 'claude-haiku-5-5');
    assert.strictEqual(after.env.ANTHROPIC_DEFAULT_FABLE_MODEL, 'claude-fable-5-2');
    assert.ok(!after.availableModels.includes('claude-opus-5'), 'previous generation removed from the allow-list');
    fs.rmSync(home, { recursive: true, force: true });
  })) passed++; else failed++;

  if (test('model lineup: Bedrock settings get prefixed IDs; a legacy default model is reported, not rewritten', () => {
    const bedrockEnv = { CLAUDE_CODE_USE_BEDROCK: '1', ANTHROPIC_BEDROCK_REGION_PREFIX: 'global' };
    assert.strictEqual(resolveModelId('fable', bedrockEnv), 'global.anthropic.claude-fable-5-2');
    assert.strictEqual(resolveModelId('opus', { CLAUDE_CODE_USE_BEDROCK: '1' }), 'global.anthropic.claude-opus-5-5');
    assert.strictEqual(resolveModelId('sonnet', {}), LINEUP.sonnet);
    assert.strictEqual(stripVariant('global.anthropic.claude-opus-5-5[1m]'), 'global.anthropic.claude-opus-5-5');

    const home = rawHome({ env: { HARNESS_HOOK_PROFILE: 'minimal', ...bedrockEnv }, model: 'global.anthropic.claude-opus-5[1m]' });
    run(home, ['--apply']);
    const after = JSON.parse(fs.readFileSync(path.join(home, 'settings.json'), 'utf8'));
    assert.strictEqual(after.env.ANTHROPIC_DEFAULT_HAIKU_MODEL, 'global.anthropic.claude-haiku-5-5');
    assert.ok(after.availableModels.every(id => id.startsWith('global.anthropic.')), after.availableModels.join(','));
    assert.strictEqual(after.model, 'global.anthropic.claude-opus-5[1m]', 'the default model is left for the user to change');

    const left = auditHome(home).findings['model-lineup'];
    assert.deepStrictEqual(left.map(f => [f.name, f.fixable]), [['model', false]]);
    // 현재 세대 기본 모델(별칭·전체 ID·[1m] 변형)은 보고하지 않는다.
    for (const model of ['opus', 'global.anthropic.claude-opus-5-5', 'global.anthropic.claude-fable-5-2[1m]']) {
      fs.writeFileSync(path.join(home, 'settings.json'), JSON.stringify({ ...after, model }));
      assert.deepStrictEqual(auditHome(home).findings['model-lineup'], [], model);
    }
    fs.rmSync(home, { recursive: true, force: true });
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  return failed === 0;
}

if (require.main === module) {
  process.exit(runTests() ? 0 : 1);
}

module.exports = { runTests };
