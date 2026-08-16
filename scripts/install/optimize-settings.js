#!/usr/bin/env node
'use strict';

/**
 * optimize-settings.js — `$CLAUDE_HOME/settings.json` 을 하네스 기준으로 점검하고 정리한다.
 *
 * 이 스크립트가 다루는 것은 **settings.json 과 그 사본뿐**이다. 훅 구성은
 * `merge-hooks.js`(선언적 머지), 심볼릭 링크는 `check-drift.js` 가 담당한다 —
 * 겹치지 않는다.
 *
 * 검사 항목:
 *   hook-profile     `env.HARNESS_HOOK_PROFILE` 이 있고 유효한가 (없으면 minimal 기록)
 *   dead-env         하네스가 더 읽지 않는 `HARNESS_*` env — 훅이 은퇴하면 남는 찌꺼기
 *   inert-env        옵트인 훅만 읽는 `HARNESS_*` env 인데 프로파일이 minimal (보고만)
 *   secret-backups   `settings.json.bak.*` 사본에 평문 비밀값이 있는지 (값은 절대 출력하지 않음)
 *   skill-listing    설치된 스킬 description 이 `skillListing*` 캡에 걸리는지 (보고만)
 *
 * 기본은 **읽기 전용**이고, 조치할 것이 있으면 exit 1 이다(CI 에서 쓸 수 있게).
 * `--apply` 를 주면 안전한 것만 고친다: 프로파일 기록, 죽은 env 제거, 비밀값 든 사본 삭제.
 *
 * Usage:
 *   node scripts/install/optimize-settings.js                 점검만 (drift 있으면 exit 1)
 *   node scripts/install/optimize-settings.js --apply         안전한 항목 적용
 *   node scripts/install/optimize-settings.js --json          기계용 출력
 *   node scripts/install/optimize-settings.js --claude-home=DIR
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const { DEFAULT_HOOK_PROFILE, VALID_HOOK_PROFILES } = require('./merge-hooks');

/** 이름 어디에 있어도 비밀로 보는 긴 단어들 — 부분 문자열로 봐도 오탐이 드물다. */
const SECRET_WORD = /token|key|secret|password|passwd|credential|bearer/i;

/**
 * 짧아서 부분 문자열로 보면 안 되는 이름들(`PAT` 은 `PATH`·`COMPATIBLE` 에 걸린다).
 * `_` 로 나눈 **세그먼트가 정확히 일치**할 때만 비밀로 본다.
 */
const SECRET_SEGMENTS = new Set(['PAT', 'PW', 'PWD', 'AUTH']);

/**
 * `CLAUDE_CODE_MAX_OUTPUT_TOKENS` 처럼 이름에 token 이 들어가지만 비밀이 아닌 것들.
 * 오탐이 잦으면 읽는 사람이 경고를 무시하게 되고, 그러면 진짜 비밀도 함께 묻힌다.
 */
const NOT_SECRET = new Set(['CLAUDE_CODE_MAX_OUTPUT_TOKENS', 'MAX_THINKING_TOKENS']);

const isSecretName = name => {
  if (NOT_SECRET.has(name)) return false;
  if (SECRET_WORD.test(name)) return true;
  return String(name)
    .toUpperCase()
    .split('_')
    .some(seg => SECRET_SEGMENTS.has(seg));
};

/** 비밀값은 sha256 앞 8자와 길이로만 식별한다. */
const fingerprint = value => {
  const s = String(value);
  return `sha=${crypto.createHash('sha256').update(s).digest('hex').slice(0, 8)} len=${s.length}`;
};

function parseArgs(argv) {
  const flags = { apply: false, json: false, help: false, claudeHome: null, settingsPath: null };
  for (const a of argv.slice(2)) {
    if (a === '--apply') flags.apply = true;
    else if (a === '--json') flags.json = true;
    else if (a === '-h' || a === '--help') flags.help = true;
    else if (a.startsWith('--claude-home=')) flags.claudeHome = a.slice('--claude-home='.length);
    else if (a.startsWith('--settings=')) flags.settingsPath = a.slice('--settings='.length);
  }
  return flags;
}

function defaultClaudeHome() {
  return process.env.CLAUDE_HOME || path.join(os.homedir(), '.claude');
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * 이 레포의 스크립트가 실제로 읽는 `HARNESS_*` 이름 전체.
 *
 * 소스를 훑어서 구하므로 훅이 은퇴하면 자동으로 목록에서 빠진다 — 하드코딩한 표를
 * 두면 그 표가 곧 다음 찌꺼기가 된다.
 *
 * @param {string} root
 * @returns {Set<string>}
 */
function harnessEnvNamesReadByCode(root) {
  const names = new Set();
  const walk = dir => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        walk(full);
        continue;
      }
      if (!/\.(js|sh|ps1)$/.test(e.name)) continue;
      let src;
      try {
        src = fs.readFileSync(full, 'utf8');
      } catch {
        continue;
      }
      for (const m of src.matchAll(/HARNESS_[A-Z0-9_]+/g)) names.add(m[0]);
    }
  };
  walk(path.join(root, 'scripts'));
  walk(path.join(root, 'hooks'));
  return names;
}

/**
 * 옵트인 스택(hooks-optional.json)만 부르는 스크립트가 읽는 env 이름.
 * 프로파일이 minimal 이면 이 값들은 아무 효과가 없다 — 지우지는 않고 알린다.
 *
 * @param {string} root
 * @returns {Set<string>}
 */
function envNamesUsedOnlyByOptionalStack(root) {
  const scriptsOf = file => {
    const doc = readJson(path.join(root, 'hooks', file));
    const out = new Set();
    for (const groups of Object.values((doc && doc.hooks) || {})) {
      for (const g of groups) {
        for (const h of g.hooks || []) {
          for (const m of String(h.command || '').matchAll(/scripts[\\/]hooks[\\/]([a-z0-9-]+\.js)/g)) out.add(m[1]);
        }
      }
    }
    return out;
  };

  // 훅이 부르는 진입점만으로는 부족하다 — 그 스크립트가 require 하는 것까지 따라간다.
  const expand = names => {
    const seen = new Set();
    const queue = [...names];
    while (queue.length) {
      const name = queue.pop();
      if (seen.has(name)) continue;
      seen.add(name);
      let src;
      try {
        src = fs.readFileSync(path.join(root, 'scripts', 'hooks', name), 'utf8');
      } catch {
        continue;
      }
      for (const m of src.matchAll(/require\('\.\/([a-z0-9-]+)'\)/g)) queue.push(`${m[1]}.js`);
    }
    return seen;
  };

  const core = expand(scriptsOf('hooks.json'));
  const optional = expand(scriptsOf('hooks-optional.json'));

  const envOf = name => {
    const out = new Set();
    try {
      const src = fs.readFileSync(path.join(root, 'scripts', 'hooks', name), 'utf8');
      for (const m of src.matchAll(/HARNESS_[A-Z0-9_]+/g)) out.add(m[0]);
    } catch {
      /* 없으면 기여분 0 */
    }
    return out;
  };

  const coreEnv = new Set();
  for (const s of core) for (const v of envOf(s)) coreEnv.add(v);

  const optionalOnly = new Set();
  for (const s of optional) {
    if (core.has(s)) continue;
    for (const v of envOf(s)) if (!coreEnv.has(v)) optionalOnly.add(v);
  }
  return optionalOnly;
}

/**
 * 설치된 스킬 description 총량 대비 `skillListing*` 캡.
 * 캡에 걸리면 모델이 스킬을 아예 못 보므로 하네스 동작에 직결된다.
 *
 * @param {string} claudeHome
 * @param {object} settings
 */
function measureSkillListing(claudeHome, settings) {
  const dir = path.join(claudeHome, 'skills');
  let count = 0;
  let totalChars = 0;
  let longest = 0;
  const overPerSkill = [];
  const perSkillCap = Number(settings.skillListingMaxDescChars) || 0;

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const e of entries) {
    let head;
    try {
      head = fs.readFileSync(path.join(dir, e.name, 'SKILL.md'), 'utf8').slice(0, 8000);
    } catch {
      continue;
    }
    const fm = head.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm) continue;
    const dm = fm[1].match(/^description:\s*([\s\S]*?)(?=\n[a-zA-Z_-]+:|$)/m);
    if (!dm) continue;
    const desc = dm[1].replace(/\s+/g, ' ').trim();
    count++;
    totalChars += desc.length;
    longest = Math.max(longest, desc.length);
    if (perSkillCap && desc.length > perSkillCap) overPerSkill.push({ skill: e.name, chars: desc.length });
  }

  return { count, totalChars, longest, perSkillCap, overPerSkill };
}

/**
 * settings.json 사본 중 평문 비밀값을 담은 것. 사본은 머지마다 하나씩 늘어나므로
 * 방치하면 키 1개가 파일 N개로 복제된다.
 *
 * @param {string} claudeHome
 */
function findSecretBackups(claudeHome) {
  let names;
  try {
    names = fs.readdirSync(claudeHome).filter(n => n.startsWith('settings.json.bak'));
  } catch {
    return [];
  }
  const out = [];
  for (const name of names.sort()) {
    const doc = readJson(path.join(claudeHome, name));
    if (!doc) continue;
    const secrets = Object.entries(doc.env || {})
      .filter(([k]) => isSecretName(k))
      .map(([k, v]) => ({ name: k, fingerprint: fingerprint(v) }));
    if (secrets.length) out.push({ file: name, secrets });
  }
  return out;
}

/**
 * @param {{claudeHome: string, settingsPath: string, root: string}} opts
 */
function audit({ claudeHome, settingsPath, root }) {
  const settings = readJson(settingsPath) || {};
  const findings = { 'hook-profile': [], 'dead-env': [], 'inert-env': [], 'secret-backups': [], 'skill-listing': [] };

  const profile = String((settings.env && settings.env.HARNESS_HOOK_PROFILE) || '')
    .trim()
    .toLowerCase();

  if (!profile) {
    findings['hook-profile'].push({
      issue: 'missing',
      detail: `env.HARNESS_HOOK_PROFILE 이 없습니다 — 런타임은 ${DEFAULT_HOOK_PROFILE} 로 동작하지만 값이 보이지 않아 바꿀 수 없습니다`,
      fixable: true
    });
  } else if (!VALID_HOOK_PROFILES.includes(profile)) {
    findings['hook-profile'].push({
      issue: 'invalid',
      detail: `env.HARNESS_HOOK_PROFILE="${settings.env.HARNESS_HOOK_PROFILE}" 은 ${VALID_HOOK_PROFILES.join('|')} 중 하나가 아닙니다 — 런타임은 ${DEFAULT_HOOK_PROFILE} 로 떨어집니다`,
      fixable: false
    });
  }

  const readByCode = harnessEnvNamesReadByCode(root);
  const optionalOnly = envNamesUsedOnlyByOptionalStack(root);
  const effectiveProfile = VALID_HOOK_PROFILES.includes(profile) ? profile : DEFAULT_HOOK_PROFILE;

  for (const name of Object.keys(settings.env || {})) {
    if (!name.startsWith('HARNESS_')) continue;
    if (name === 'HARNESS_HOOK_PROFILE') continue;
    if (!readByCode.has(name)) {
      findings['dead-env'].push({ name, detail: '이 레포의 어떤 스크립트도 읽지 않습니다', fixable: true });
    } else if (optionalOnly.has(name) && effectiveProfile === DEFAULT_HOOK_PROFILE) {
      findings['inert-env'].push({
        name,
        detail: `옵트인 훅만 읽는 값인데 프로파일이 ${effectiveProfile} 이라 효과가 없습니다`,
        fixable: false
      });
    }
  }

  findings['secret-backups'] = findSecretBackups(claudeHome).map(b => ({ ...b, fixable: true }));

  const listing = measureSkillListing(claudeHome, settings);
  if (listing && listing.overPerSkill.length) {
    findings['skill-listing'].push({
      detail: `skillListingMaxDescChars=${listing.perSkillCap} 를 넘는 스킬 ${listing.overPerSkill.length}개 — description 이 잘려 발견되지 않을 수 있습니다`,
      skills: listing.overPerSkill,
      fixable: false
    });
  }

  const actionable = Object.values(findings)
    .flat()
    .filter(f => f.fixable).length;

  return { settings, findings, listing, actionable, effectiveProfile };
}

/**
 * 고칠 수 있는 것만 적용한다: 프로파일 기록, 죽은 env 제거, 비밀값 든 사본 삭제.
 * 유효하지 않은 프로파일 값은 고치지 않는다 — 사용자 데이터를 덮어쓰지 않는다.
 */
function applyFixes({ claudeHome, settingsPath, findings, settings }) {
  const applied = [];
  const next = JSON.parse(JSON.stringify(settings));

  if (findings['hook-profile'].some(f => f.issue === 'missing')) {
    next.env = next.env || {};
    next.env.HARNESS_HOOK_PROFILE = DEFAULT_HOOK_PROFILE;
    applied.push(`env.HARNESS_HOOK_PROFILE="${DEFAULT_HOOK_PROFILE}" 기록`);
  }

  for (const f of findings['dead-env']) {
    if (next.env && Object.prototype.hasOwnProperty.call(next.env, f.name)) {
      delete next.env[f.name];
      applied.push(`env.${f.name} 제거`);
    }
  }
  if (next.env && Object.keys(next.env).length === 0) delete next.env;

  if (applied.length) fs.writeFileSync(settingsPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');

  // 사본 삭제는 settings.json 쓰기 뒤에 한다 — 쓰기가 실패하면 사본을 남겨두는 편이 안전하다.
  for (const b of findings['secret-backups']) {
    fs.rmSync(path.join(claudeHome, b.file), { force: true });
    applied.push(`${b.file} 삭제 (평문 비밀값 ${b.secrets.length}건)`);
  }

  return applied;
}

function report({ findings, listing, effectiveProfile, claudeHome, settingsPath, applied }) {
  console.log(`settings file: ${settingsPath}`);
  console.log(`profile:       ${effectiveProfile}`);
  if (listing) {
    const tok = Math.round(listing.totalChars / 4);
    console.log(`skills:        ${listing.count}개, description 합계 ${listing.totalChars.toLocaleString()}자 (≈${tok.toLocaleString()} tok), 최장 ${listing.longest}자`);
  }
  console.log('');

  let printed = 0;
  for (const [bucket, items] of Object.entries(findings)) {
    if (!items.length) continue;
    printed += items.length;
    console.log(`  ${bucket} (${items.length}):`);
    for (const it of items) {
      if (bucket === 'secret-backups') {
        console.log(`    - ${it.file}`);
        for (const s of it.secrets) console.log(`        ${s.name}: ${s.fingerprint}`);
      } else {
        console.log(`    - ${it.name ? `${it.name}: ` : ''}${it.detail}`);
      }
    }
  }

  if (!printed) {
    console.log('  최적화할 것이 없습니다 — settings.json 이 하네스 기준에 맞습니다.');
    return;
  }

  if (applied) {
    console.log(`\n[applied ${applied.length}]`);
    applied.forEach(a => console.log(`    - ${a}`));
    return;
  }

  const fixable = Object.values(findings)
    .flat()
    .filter(f => f.fixable).length;
  if (fixable) {
    console.log(`\n  ${fixable}건은 자동으로 고칠 수 있습니다:`);
    console.log(`    CLAUDE_HOME="${claudeHome}" node scripts/install/optimize-settings.js --apply`);
  }
}

function main(argv = process.argv) {
  const flags = parseArgs(argv);
  if (flags.help) {
    console.log(
      [
        'optimize-settings.js — settings.json 을 하네스 기준으로 점검/정리',
        '',
        'Flags:',
        '  --apply                 고칠 수 있는 항목 적용 (프로파일 기록, 죽은 env 제거, 비밀값 사본 삭제)',
        '  --json                  기계용 출력',
        '  --claude-home=DIR       점검할 설치 위치 (기본: $CLAUDE_HOME 또는 ~/.claude)',
        '  --settings=PATH         settings.json 경로 직접 지정',
        '  -h, --help              도움말'
      ].join('\n')
    );
    return 0;
  }

  const claudeHome = flags.claudeHome || defaultClaudeHome();
  const settingsPath = flags.settingsPath || path.join(claudeHome, 'settings.json');
  const result = audit({ claudeHome, settingsPath, root: REPO_ROOT });

  const applied = flags.apply ? applyFixes({ claudeHome, settingsPath, ...result }) : null;

  if (flags.json) {
    console.log(JSON.stringify({ settingsPath, profile: result.effectiveProfile, findings: result.findings, listing: result.listing, actionable: result.actionable, applied }, null, 2));
  } else {
    report({ ...result, claudeHome, settingsPath, applied });
  }

  if (applied) return 0;
  return result.actionable > 0 ? 1 : 0;
}

if (require.main === module) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(`[optimize-settings] ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  parseArgs,
  audit,
  applyFixes,
  harnessEnvNamesReadByCode,
  envNamesUsedOnlyByOptionalStack,
  measureSkillListing,
  findSecretBackups,
  isSecretName,
  main
};
