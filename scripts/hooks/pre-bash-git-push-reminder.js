#!/usr/bin/env node
/**
 * PreToolUse Hook: 기본 브랜치 직접 푸시 게이트
 *
 * 커밋 → 푸시 → PR → 머지 파이프라인이 세션 내 직접 git 조작에서도 지켜지게 한다.
 * `git push` 대상 ref 가 기본 브랜치(origin/HEAD, 없으면 main/master)면:
 *   - strict 프로파일: 차단 (exit 2)
 *   - minimal/standard: stderr 경고 (exit 0)
 *
 * 우회: HARNESS_ALLOW_MAIN_PUSH=1 (릴리스 태그 푸시 등 의도적 직행)
 *
 * Exit codes:
 *   0 = allow
 *   2 = block (strict + 기본 브랜치 직접 푸시)
 */

'use strict';

const { spawnSync } = require('child_process');
const { getHookProfile } = require('../lib/hook-flags');

const MAX_STDIN = 1024 * 1024;
let raw = '';

// push 옵션 중 다음 토큰을 값으로 먹는 것들 — refspec 파싱에서 건너뛴다.
const PUSH_OPTIONS_WITH_VALUE = new Set(['-o', '--push-option', '--receive-pack', '--exec', '--repo']);

const FALLBACK_DEFAULT_BRANCHES = ['main', 'master'];

function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  if (result.status !== 0 || typeof result.stdout !== 'string') return null;
  const value = result.stdout.trim();
  return value.length > 0 ? value : null;
}

/** origin/HEAD 에서 기본 브랜치를 읽고, 없으면 main/master 중 실재하는 것을 쓴다. */
function getDefaultBranch() {
  const symref = git(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  if (symref) return symref.replace(/^origin\//, '');

  for (const candidate of FALLBACK_DEFAULT_BRANCHES) {
    if (git(['rev-parse', '--verify', '--quiet', `refs/heads/${candidate}`])) return candidate;
  }
  return null;
}

function stripRefPrefix(ref) {
  return ref.replace(/^\+/, '').replace(/^refs\/heads\//, '');
}

/**
 * `git push ...` 에서 푸시 대상 브랜치 목록을 뽑는다.
 * refspec 이 없으면 현재 브랜치가 대상이다.
 */
function extractTargetBranches(command, currentBranch) {
  const tokens = command.split(/\s+/).filter(Boolean);
  const pushIndex = tokens.findIndex((t, i) => t === 'push' && i > 0 && /(^|\/)git$/.test(tokens[i - 1]));
  if (pushIndex === -1) return [];

  const positional = [];
  for (let i = pushIndex + 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.startsWith('-')) {
      const [flag] = token.split('=');
      if (PUSH_OPTIONS_WITH_VALUE.has(flag) && !token.includes('=')) i += 1;
      continue;
    }
    positional.push(token);
  }

  // 첫 positional 은 remote, 나머지가 refspec.
  const refspecs = positional.slice(1);
  if (refspecs.length === 0) return currentBranch ? [currentBranch] : [];

  return refspecs.map(spec => {
    const dst = spec.includes(':') ? spec.slice(spec.indexOf(':') + 1) : spec;
    return stripRefPrefix(dst);
  });
}

function checkCommand(command) {
  if (!/\bgit\s+push\b/.test(command)) return { blocked: false };
  if (process.env.HARNESS_ALLOW_MAIN_PUSH === '1') return { blocked: false };
  // 브랜치 삭제·태그 전용 푸시는 파이프라인 대상이 아니다.
  if (/\s(--delete|-d|--tags)\b/.test(command)) return { blocked: false };

  const defaultBranch = getDefaultBranch();
  if (!defaultBranch) return { blocked: false };

  const currentBranch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  const targets = extractTargetBranches(command, currentBranch);
  if (!targets.includes(defaultBranch)) return { blocked: false };

  const strict = getHookProfile() === 'strict';
  const reason = [
    `[Hook] ${strict ? 'BLOCKED' : 'WARNING'}: 기본 브랜치(${defaultBranch}) 직접 푸시 — 커밋→푸시→PR→머지 파이프라인 위반`,
    '[Hook] git switch -c <type>/<slug> && git push -u origin <branch> && gh pr create',
    '[Hook] 머지는 gh pr merge --squash --delete-branch',
    '[Hook] 의도적 직행이면 HARNESS_ALLOW_MAIN_PUSH=1',
  ].join('\n');

  return { blocked: strict, reason };
}

function run(rawInput) {
  let command = '';
  try {
    const input = typeof rawInput === 'string' ? JSON.parse(rawInput) : rawInput;
    command = String(input.tool_input?.command || '');
  } catch {
    return typeof rawInput === 'string' ? rawInput : JSON.stringify(rawInput);
  }

  const result = checkCommand(command);
  if (!result.reason) return typeof rawInput === 'string' ? rawInput : JSON.stringify(rawInput);

  return {
    stdout: result.blocked ? '' : (typeof rawInput === 'string' ? rawInput : JSON.stringify(rawInput)),
    stderr: result.reason,
    exitCode: result.blocked ? 2 : 0,
  };
}

if (require.main === module) {
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    if (raw.length < MAX_STDIN) {
      const remaining = MAX_STDIN - raw.length;
      raw += chunk.substring(0, remaining);
    }
  });

  process.stdin.on('end', () => {
    const result = run(raw);
    if (result && typeof result === 'object') {
      if (result.stderr) {
        process.stderr.write(`${result.stderr}\n`);
      }
      process.stdout.write(String(result.stdout || ''));
      process.exitCode = Number.isInteger(result.exitCode) ? result.exitCode : 0;
      return;
    }

    process.stdout.write(String(result));
  });
}

module.exports = { run };
