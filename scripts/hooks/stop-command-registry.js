#!/usr/bin/env node
/**
 * Stop Hook: commands/*.md 가 바뀌면 COMMAND-REGISTRY.json 을 자동 재생성한다.
 *
 * 하네스 repo 전용 — 생성기(scripts/ci/generate-command-registry.js)가 있는
 * 디렉터리에서만 동작하고, 그 밖에선 조용히 skip 한다. CI 의 `--check` 가
 * 레지스트리 stale 을 잡지만, 그건 커밋 후에야 걸린다. 이 훅은 커맨드 파일을
 * 건드린 세션 끝에 미리 재생성해 "레지스트리 갱신 깜빡" 을 없앤다.
 *
 * 설계(하네스 훅 규약): 비차단(exit 0), 변경 없으면 skip, 생성기 없으면 skip.
 * run-with-flags.js 와 호환되도록 module.exports.run() 제공.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const GENERATOR = path.join('scripts', 'ci', 'generate-command-registry.js');

/**
 * 이번 변경분에 commands/*.md 가 있는지 확인한다.
 *
 * @param {string} cwd
 * @returns {boolean}
 */
function commandFilesChanged(cwd) {
  const r = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], {
    cwd,
    encoding: 'utf8',
    timeout: 10_000
  });
  if (r.status !== 0 || !r.stdout) return false;

  for (const line of r.stdout.split('\n')) {
    if (!line.trim()) continue;
    // porcelain: "XY <path>" 또는 "XY <old> -> <new>" (rename)
    let p = line.slice(3).trim();
    const arrow = p.indexOf(' -> ');
    if (arrow !== -1) p = p.slice(arrow + 4);
    if (/^commands\/[^/]+\.md$/.test(p)) return true;
  }
  return false;
}

function main() {
  const cwd = process.cwd();
  const generatorPath = path.join(cwd, GENERATOR);
  if (!fs.existsSync(generatorPath)) return; // 하네스 repo 아님 → skip
  if (!commandFilesChanged(cwd)) return; // 커맨드 변경 없음 → skip

  const result = spawnSync(process.execPath, [GENERATOR, '--write'], {
    cwd,
    encoding: 'utf8',
    timeout: 30_000
  });

  if (result.error) {
    process.stderr.write(`[Stop] command-registry 재생성 실패: ${result.error.message}\n`);
    return;
  }
  if (result.status !== 0) {
    process.stderr.write(`[Stop] command-registry 재생성 실패:\n${(result.stderr || '').trim()}\n`);
    return;
  }
  process.stderr.write('[Stop] COMMAND-REGISTRY.json 재생성됨 (commands/ 변경 감지) — git add 하세요.\n');
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
    process.stderr.write(`[Stop] stop-command-registry error: ${err.message}\n`);
  }
  return rawInput;
}

if (require.main === module) {
  let stdinData = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', c => {
    stdinData += c;
  });
  process.stdin.on('end', () => {
    process.stdout.write(run(stdinData));
  });
} else {
  module.exports = { run, commandFilesChanged };
}
