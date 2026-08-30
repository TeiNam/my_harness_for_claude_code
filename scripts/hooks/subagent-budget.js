#!/usr/bin/env node
/**
 * Subagent budget hook (SubagentStart)
 *
 * 서브에이전트는 SessionStart 컨텍스트를 상속하지 않는다. 그래서 SessionStart 로
 * 규율을 심는 플러그인의 지시는 서브에이전트에 닿지 않고, 서브에이전트가 과도하게
 * 탐색하고 길게 보고해 시간·토큰을 태운다.
 *
 * 이 훅은 Agent 호출마다 압축된 예산 브리프를 서브에이전트 컨텍스트로 주입한다.
 *
 * **ponytail 의 규율은 여기서 복제하지 않는다** — ponytail 4.9.0 부터 플러그인이
 * 자체 `SubagentStart` 훅(`ponytail-subagent.js`, upstream #252)으로 전체 룰셋을
 * 직접 주입한다. 그래서 이 브리프는 하네스 고유분(leaf 고정·리뷰 변형·탐색 폭)만
 * 담는다. ponytail 이 off 면 그쪽은 아무것도 넣지 않고, 그건 사용자의 선택이다.
 * ponytail mode 는 여기서도 off 스위치로만 읽는다(플러그인 부재 시 기본 적용).
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
  const env = String(process.env.PONYTAIL_DEFAULT_MODE || '')
    .trim()
    .toLowerCase();
  if (env) return env;

  const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  try {
    return fs.readFileSync(path.join(claudeDir, '.ponytail-active'), 'utf8').trim().toLowerCase();
  } catch {
    return 'full'; // 상태 파일이 없어도 예산 규율은 기본 적용
  }
}

// 브리프는 짧아야 한다 — 스킬 전문이나 플러그인 룰셋을 여기에 인라인하면
// 절약하려던 토큰을 되쓴다. 플러그인 룰셋은 각 플러그인의 훅이 직접 넣는다.
const HEADER = 'SUBAGENT BUDGET (하네스 — 이 서브에이전트 실행 전체에 적용)';

// 탐색·실행 규율. 리뷰든 구현이든 공통이다.
const COMMON = [
  '- 요청된 것만 답하고 멈춘다. 범위 확장·"하는 김에" 추가 작업 금지.',
  '- 서브에이전트를 더 생성하지 않는다. 너는 leaf 다.',
  '- 좁게 읽는다: 전체 파일 훑기보다 표적 grep/glob, 재독보다 1패스.',
  '- 스킬은 이미 손에 있다: frontmatter `skills:` 는 본문이 주입돼 있고, 그 밖의',
  '  하네스·플러그인 스킬은 Skill 툴로 필요할 때만 불러 쓴다 — 추측하지 말 것.',
  '- 절대 줄이지 않는 것: 입력 검증, 데이터 손실을 막는 에러 처리, 보안,',
  '  접근성, 사용자가 명시적으로 요구한 것.'
];

const BRIEF = [
  HEADER,
  '',
  ...COMMON,
  '- 증거 덤프가 아니라 결론을 반환한다: 코드 블록 붙여넣기보다 file:line 참조.',
  '- 보고 오버헤드는 짧게(몇 줄). 단, 과업이 요구한 산출물(코드·윤문 결과·문서·',
  '  리뷰 리포트)은 오버헤드가 아니다 — 온전히 만들어낸다.'
].join('\n');

// 리뷰·감사 에이전트용 변형. 과탐색은 여전히 막지만 결함 수를 압박하지 않는다 —
// 짧게 쓰라는 지시가 findings 누락으로 번지면 리뷰의 존재 이유가 사라진다.
// 간결성 자체를 판정하는 건 ponytail-review 스킬의 일이고, 이 훅의 일이 아니다.
const REVIEW_BRIEF = [
  HEADER,
  '',
  ...COMMON,
  '- 발견한 결함은 빠짐없이 보고한다 — 개수를 줄이지 않는다. 간결성 압박은',
  '  findings 가 아니라 그 서술에만 적용된다.',
  '- 결함 1건 = 몇 줄: file:line + 무엇이 왜 깨지는지. 코드 전체 재인용 금지.',
  '- 과잉설계 판정(무엇을 지울지)은 ponytail-review 스킬 담당이다. 요청받지',
  '  않았다면 그 렌즈로 리뷰를 갈아타지 말고 주어진 축만 본다.'
].join('\n');

// 리뷰/감사 계열 판별. 하네스 에이전트는 -reviewer/-auditor/-detector 접미사나
// code-review 계열 이름을 쓴다.
const REVIEW_AGENT = /review|audit|detector|scorer|critic|analyzer/i;

function run(inputOrRaw, _options = {}) {
  if (
    String(process.env.HARNESS_SUBAGENT_BUDGET || '')
      .trim()
      .toLowerCase() === 'off'
  ) {
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
    input = typeof inputOrRaw === 'string' ? (inputOrRaw.trim() ? JSON.parse(inputOrRaw) : {}) : inputOrRaw || {};
  } catch {
    input = {};
  }

  const agentType = String(input?.agent_type || '').trim();
  const brief = REVIEW_AGENT.test(agentType) ? REVIEW_BRIEF : BRIEF;
  const header = agentType ? `${brief}\n\n(agent_type: ${agentType})` : brief;

  return {
    stdout: JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SubagentStart',
        additionalContext: header
      }
    }),
    exitCode: 0
  };
}

module.exports = { run, BRIEF, REVIEW_BRIEF, REVIEW_AGENT, readPonytailMode, HOOK_ID };

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
