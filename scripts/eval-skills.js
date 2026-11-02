#!/usr/bin/env node
'use strict';

/**
 * eval-skills.js — 하네스 스킬이 모델별로 실제 행동을 바꾸는지 측정한다.
 *
 * skills/ 전체와 evals/skills/ 케이스를 임시 플러그인으로 감싸 `claude plugin eval` 을 돌린다.
 * 실험군(스킬 있음)과 비교군(스킬 없음)을 함께 실행해 점수 차이를 낸다. 비교군은
 * 사용자 전역 스킬과 격리된다(2026-11 실측).
 *
 * 유료 실행이라 npm test 에 넣지 않는다. 리포트는 항상 --no-publish 로 로컬에만 남긴다.
 *
 * Usage:
 *   node scripts/eval-skills.js [--model haiku|sonnet|opus] [--runs N] [--case <name>] [--max-cost-usd N]
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const DEFAULTS = { model: 'sonnet', runs: '2', maxCost: '6' };

function buildPlugin(repoRoot, outDir) {
  fs.mkdirSync(path.join(outDir, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(outDir, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'harness-skills', version: '0.0.0', description: 'harness skills eval wrapper' }) + '\n'
  );
  fs.cpSync(path.join(repoRoot, 'skills'), path.join(outDir, 'skills'), { recursive: true, dereference: true });
  fs.cpSync(path.join(repoRoot, 'evals', 'skills'), path.join(outDir, 'evals'), { recursive: true });
  return outDir;
}

function summarize(result) {
  const lines = [`cost $${result.costUsd.toFixed(2)} | ${JSON.stringify(result.aggregates)}`];
  for (const c of result.cases) {
    const arm = name =>
      (c.arms[name] || [])
        .map(run => {
          if (run.error) return 'ERR';
          const fired = run.graders.find(g => g.name === 'fired');
          return `${run.score}${fired ? (fired.passed ? '(fired)' : '(no-fire)') : ''}`;
        })
        .join(' ');
    lines.push(`${String(c.name || c.path).padEnd(20)} with: ${arm('with').padEnd(24)} without: ${arm('without')}`);
  }
  return lines.join('\n');
}

function parseArgs(argv) {
  const opts = { ...DEFAULTS, caseGlob: null };
  for (let i = 0; i < argv.length; i++) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if (flag === '--model') opts.model = value;
    else if (flag === '--runs') opts.runs = value;
    else if (flag === '--case') opts.caseGlob = value;
    else if (flag === '--max-cost-usd') opts.maxCost = value;
    else continue;
    i++;
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-skill-eval-'));
  const plugin = buildPlugin(REPO, path.join(work, 'plugin'));
  const jsonOut = path.join(work, 'result.json');
  const args = ['plugin', 'eval', plugin, '--trust-plugin', '--no-publish', '--threshold', '0',
    '--judge-model', 'sonnet', '--model', opts.model, '--runs', opts.runs, '--max-cost-usd', opts.maxCost,
    '-j', '4', '--json', jsonOut];
  if (opts.caseGlob) args.push('--case', opts.caseGlob);

  const run = spawnSync('claude', args, { stdio: ['ignore', 'inherit', 'inherit'] });
  if (run.error) {
    console.error(`[eval-skills] claude CLI 를 실행하지 못했습니다: ${run.error.message}`);
    process.exit(1);
  }
  if (!fs.existsSync(jsonOut)) {
    console.error(`[eval-skills] 결과 파일이 없습니다 (exit ${run.status}). 작업 디렉터리: ${work}`);
    process.exit(run.status || 1);
  }
  console.log(`\n== ${opts.model}\n${summarize(JSON.parse(fs.readFileSync(jsonOut, 'utf8')))}`);
  console.log(`\n결과: ${jsonOut}`);
  process.exit(run.status || 0);
}

if (require.main === module) main();

module.exports = { buildPlugin, summarize, parseArgs };
