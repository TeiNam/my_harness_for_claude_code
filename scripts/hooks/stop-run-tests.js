#!/usr/bin/env node
/**
 * Stop Hook: 세션에서 코드를 건드렸으면 프로젝트 테스트를 자동 실행한다.
 *
 * 검증의 마지막 층 — 타입체크·포맷(stop-format-typecheck)이 "컴파일되나"를 본다면
 * 이 훅은 "동작하나"를 본다. git 변경분에서 편집된 파일의 프로젝트 루트를 찾아,
 * 루트별로 테스트 러너를 감지해 실행하고 실패 시 stderr 로 경고한다.
 *
 * 설계 원칙(하네스 훅 규약):
 *   - 비차단: 테스트가 실패해도 exit 0. 사용자 흐름을 막지 않고 경고만 한다.
 *   - 조용한 skip: 테스트 스크립트/프레임워크가 없으면 아무 말 없이 넘어간다
 *     (테스트 없는 프로젝트에서 시끄럽지 않게).
 *   - 편집 없으면 skip: 이번 세션에 코드 변경이 없으면 실행하지 않는다.
 *
 * 러너 감지(루트당 하나):
 *   - package.json 에 scripts.test 존재 → 패키지 매니저 test
 *   - pyproject.toml / pytest.ini / tests 디렉터리 → pytest
 *   - Cargo.toml → cargo test
 *
 * run-with-flags.js 와 호환되도록 module.exports.run() 제공.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// 러너 전체 예산(벽시계). hooks.json 타임아웃보다 넉넉하게 잡지 말 것.
const TOTAL_BUDGET_MS = 120_000;
// 소스로 취급할 확장자 — 이 중 하나라도 바뀌어야 테스트를 돈다.
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|rs|go)$/;
// 테스트 실행 자체를 끄는 탈출구.
const DISABLE_VALUES = new Set(['0', 'false', 'off', 'disabled']);

function isDisabled() {
  const raw = String(process.env.HARNESS_STOP_TESTS || '').trim().toLowerCase();
  return DISABLE_VALUES.has(raw);
}

/**
 * 이번 변경분에서 편집된 소스 파일의 절대경로 목록.
 * git 추적(변경+스테이징+미추적)을 한 번에 본다.
 *
 * @param {string} cwd
 * @returns {string[]}
 */
function changedSourceFiles(cwd) {
  const r = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], {
    cwd,
    encoding: 'utf8',
    timeout: 10_000,
  });
  if (r.status !== 0 || !r.stdout) return [];

  const files = [];
  for (const line of r.stdout.split('\n')) {
    if (!line.trim()) continue;
    // porcelain: "XY <path>" 또는 "XY <old> -> <new>" (rename)
    let p = line.slice(3).trim();
    const arrow = p.indexOf(' -> ');
    if (arrow !== -1) p = p.slice(arrow + 4);
    if (SOURCE_EXT.test(p)) files.push(path.resolve(cwd, p));
  }
  return files;
}

/**
 * 파일 위쪽으로 올라가며 프로젝트 매니페스트가 있는 첫 디렉터리를 찾는다.
 *
 * @param {string} startDir
 * @returns {string|null}
 */
function findProjectRoot(startDir) {
  const markers = ['package.json', 'pyproject.toml', 'Cargo.toml', 'pytest.ini', 'setup.cfg'];
  let dir = startDir;
  while (dir && dir !== path.dirname(dir)) {
    for (const m of markers) {
      if (fs.existsSync(path.join(dir, m))) return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
}

/**
 * 루트에서 쓸 테스트 러너를 감지한다. 없으면 null(조용히 skip).
 *
 * @param {string} root
 * @returns {{ cmd: string, args: string[], label: string }|null}
 */
function detectRunner(root) {
  const pkgPath = path.join(root, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const testScript = pkg.scripts && pkg.scripts.test;
      // 스캐폴드 기본값("no test specified")은 실행하지 않는다.
      if (testScript && !/no test specified/i.test(testScript)) {
        const pm = detectPackageManager(root);
        return { cmd: pm, args: ['test'], label: `${pm} test` };
      }
    } catch { /* 매니페스트 파싱 실패 → 아래 다른 러너 시도 */ }
  }

  if (
    fs.existsSync(path.join(root, 'pyproject.toml')) ||
    fs.existsSync(path.join(root, 'pytest.ini')) ||
    fs.existsSync(path.join(root, 'tests'))
  ) {
    return { cmd: 'pytest', args: ['-q'], label: 'pytest -q' };
  }

  if (fs.existsSync(path.join(root, 'Cargo.toml'))) {
    return { cmd: 'cargo', args: ['test', '--quiet'], label: 'cargo test' };
  }

  return null;
}

/**
 * lockfile 로 패키지 매니저를 고른다. 기본 npm.
 *
 * @param {string} root
 * @returns {'pnpm'|'yarn'|'bun'|'npm'}
 */
function detectPackageManager(root) {
  if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(root, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(root, 'bun.lockb'))) return 'bun';
  return 'npm';
}

function main() {
  if (isDisabled()) return;

  const cwd = process.cwd();
  const files = changedSourceFiles(cwd);
  if (files.length === 0) return; // 코드 변경 없음 → skip

  // 편집된 파일들을 프로젝트 루트별로 묶는다(모노레포 대비).
  const roots = new Set();
  for (const f of files) {
    const root = findProjectRoot(path.dirname(f));
    if (root) roots.add(root);
  }
  if (roots.size === 0) return;

  const perRootMs = Math.floor(TOTAL_BUDGET_MS / roots.size);

  for (const root of roots) {
    const runner = detectRunner(root);
    if (!runner) continue; // 테스트 러너 없음 → 조용히 skip

    const result = spawnSync(runner.cmd, runner.args, {
      cwd: root,
      encoding: 'utf8',
      timeout: perRootMs,
      shell: process.platform === 'win32',
    });

    // 러너 바이너리 자체가 없으면(ENOENT) 조용히 넘어간다.
    if (result.error) {
      if (result.error.code === 'ENOENT') continue;
      process.stderr.write(`[Stop] test runner (${runner.label}) 실행 실패: ${result.error.message}\n`);
      continue;
    }

    if (result.status !== 0) {
      const tail = (result.stdout || '') + (result.stderr || '');
      const lines = tail.split('\n').filter(Boolean).slice(-15);
      process.stderr.write(`[Stop] ❌ 테스트 실패 (${path.basename(root)} — ${runner.label}):\n`);
      lines.forEach(l => process.stderr.write(`  ${l}\n`));
      process.stderr.write('[Stop] 위 실패를 확인하세요. (끄기: HARNESS_STOP_TESTS=off)\n');
    }
  }
}

/**
 * run-with-flags.js 가 require() 로 호출. 입력은 그대로 통과(비차단).
 *
 * @param {string} rawInput
 * @returns {string}
 */
function run(rawInput) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`[Stop] stop-run-tests error: ${err.message}\n`);
  }
  return rawInput;
}

if (require.main === module) {
  let stdinData = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', c => { stdinData += c; });
  process.stdin.on('end', () => { process.stdout.write(run(stdinData)); });
} else {
  module.exports = { run, detectRunner, detectPackageManager, findProjectRoot, changedSourceFiles };
}
