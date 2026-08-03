#!/usr/bin/env node
/**
 * Subagent budget hook (SubagentStart)
 *
 * 서브에이전트는 SessionStart 컨텍스트를 상속하지 않으므로 ponytail 플러그인의
 * 규율(SessionStart/UserPromptSubmit 훅)이 서브에이전트에는 전혀 닿지 않는다.
 * 그 결과 서브에이전트가 과도하게 탐색하고 길게 보고해 시간·토큰을 태운다.
 *
 * 이 훅은 Agent 호출마다 압축된 예산 브리프를 서브에이전트 컨텍스트로 주입한다.
 * ponytail 이 off 면 주입하지 않는다(사용자 의사 존중).
 *
 * 개별 차단: HARNESS_SUBAGENT_BUDGET=off, 또는 HARNESS_DISABLED_HOOKS 에 id 추가.
 * 출력은 항상 유효한 JSON 이어야 한다 — 평문 stdout 은 SubagentStart 에서
 * 컨텍스트로 취급되지 않고 스키마 경고만 유발한다. 그래서 run-with-flags 를
 * 거치지 않고(비활성 시 stdin 원문을 그대로 되돌려 경고를 유발) 프로파일 게이팅을
 * 이 스크립트 안에서 직접 수행한다.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { isHookEnabled } = require('../lib/hook-flags');

const HOOK_ID = 'subagent:budget';

const MAX_STDIN = 1024 * 1024;
const EMPTY = JSON.stringify({});

// ponytail 의 상태 파일. 플러그인이 SessionStart 에서 기록한다.
function readPonytailMode() {
  const env = String(process.env.PONYTAIL_DEFAULT_MODE || '').trim().toLowerCase();
  if (env) return env;

  const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  try {
    return fs.readFileSync(path.join(claudeDir, '.ponytail-active'), 'utf8').trim().toLowerCase();
  } catch {
    return 'full'; // 상태 파일이 없어도 예산 규율은 기본 적용
  }
}

// ponytail: 플러그인 SKILL.md 를 읽어오지 않고 압축본을 인라인한다 —
// 전문(약 2k 토큰)을 모든 서브에이전트에 붙이면 절약하려던 토큰을 되쓴다.
const BRIEF = [
  'SUBAGENT BUDGET (ponytail — 이 서브에이전트 실행 전체에 적용)',
  '',
  '- 요청된 것만 답하고 멈춘다. 범위 확장·"하는 김에" 추가 작업 금지.',
  '- 서브에이전트를 더 생성하지 않는다. 너는 leaf 다.',
  '- 좁게 읽는다: 전체 파일 훑기보다 표적 grep/glob, 재독보다 1패스.',
  '- 코드는 최소로: stdlib > 네이티브 기능 > 이미 설치된 의존성 > 새 의존성.',
  '  요청되지 않은 추상화·"나중을 위한" 스캐폴딩 금지.',
  '- 증거 덤프가 아니라 결론을 반환한다: 코드 블록 붙여넣기보다 file:line 참조.',
  '- 보고 오버헤드는 짧게(몇 줄). 단, 과업이 요구한 산출물(코드·윤문 결과·문서·',
  '  리뷰 리포트)은 오버헤드가 아니다 — 온전히 만들어낸다.',
  '- 절대 줄이지 않는 것: 입력 검증, 데이터 손실을 막는 에러 처리, 보안,',
  '  접근성, 사용자가 명시적으로 요구한 것.',
].join('\n');

function run(inputOrRaw, _options = {}) {
  if (String(process.env.HARNESS_SUBAGENT_BUDGET || '').trim().toLowerCase() === 'off') {
    return { stdout: EMPTY, exitCode: 0 };
  }

  // minimal 포함 전 프로파일에서 동작 — 토큰 절약은 프로파일과 무관한 이득이다.
  if (!isHookEnabled(HOOK_ID, { profiles: 'minimal,standard,strict' })) {
    return { stdout: EMPTY, exitCode: 0 };
  }

  if (readPonytailMode() === 'off') {
    return { stdout: EMPTY, exitCode: 0 };
  }

  let input;
  try {
    input = typeof inputOrRaw === 'string'
      ? (inputOrRaw.trim() ? JSON.parse(inputOrRaw) : {})
      : (inputOrRaw || {});
  } catch {
    input = {};
  }

  const agentType = String(input?.agent_type || '').trim();
  const header = agentType ? `${BRIEF}\n\n(agent_type: ${agentType})` : BRIEF;

  return {
    stdout: JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SubagentStart',
        additionalContext: header,
      },
    }),
    exitCode: 0,
  };
}

module.exports = { run, BRIEF, readPonytailMode, HOOK_ID };

// spawnSync 실행용 stdin 폴백
if (require.main === module) {
  let data = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', c => {
    if (data.length < MAX_STDIN) data += c.substring(0, MAX_STDIN - data.length);
  });
  process.stdin.on('end', () => {
    const result = run(data);
    process.stdout.write(result.stdout);
    process.exit(0);
  });
}
