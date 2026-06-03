#!/usr/bin/env node
'use strict';

/**
 * Capture Lessons — Stop hook
 *
 * 자기진화 메커니즘의 경량 단계. 세션 transcript 에서 "반복 교정" 신호
 * (사용자 정정, 빌드/린트/테스트 재시도, 리뷰 지적 반복) 를 휴리스틱으로
 * 감지한다. 신호가 충분하면 systemMessage 로 "교훈을 남기려면 /lessons add"
 * 한 줄 알림을 띄운다.
 *
 * Stop 이벤트는 hookSpecificOutput.additionalContext 를 허용하지 않으므로
 * (PreToolUse/UserPromptSubmit/PostToolUse/PostToolBatch 만 가능) Claude 에
 * 컨텍스트를 자동 주입하지 않고 사용자에게 systemMessage 로만 알린다.
 *
 * - 이 hook 은 lessons-learned 파일을 직접 편집하지 않는다 (제안만).
 * - 사용자 자산 변경은 /lessons add 로 사용자 확인을 받은 뒤에만 한다.
 * - 신호가 약하면 조용히 통과한다 (pass-through).
 * - 비크리티컬 에러에서도 항상 exit 0 — 사용자 흐름을 막지 않는다.
 *
 * kiro-with-harness 의 `capture-lessons` (Kiro `action: askAgent` hook) 를
 * Claude Code 의 Stop systemMessage 방식으로 재해석한 것.
 */

const fs = require('fs');
const { log } = require('../lib/utils');

const MAX_STDIN = 1024 * 1024;

// 반복 교정 신호 휴리스틱. 각 카테고리별로 transcript 에서 출현 횟수를 세고,
// 임계값을 넘으면 그 카테고리를 "후보" 로 본다.
const SIGNALS = {
  user_correction: {
    // 사용자가 정정/반박할 때 자주 쓰는 표현 (한/영). 두 번 이상이면 후보.
    patterns: [/\b(no|nope|don'?t|do not|stop|actually|instead|wrong|that'?s not)\b/i, /(아니|아냐|그게 아니|다시|하지 ?마|틀렸|말고|대신)/],
    threshold: 2,
    label: 'User corrections'
  },
  build_failure: {
    // 빌드/린트/테스트 실패가 반복. 두 번 이상이면 후보.
    patterns: [/\b(error|failed|failure|exit code [1-9]|TypeError|SyntaxError|cannot find|unresolved|tsc|eslint|biome)\b/i],
    threshold: 2,
    label: 'Build failure patterns'
  },
  review_finding: {
    // 리뷰/품질 지적 반복. 두 번 이상이면 후보.
    patterns: [/\b(should|missing|instead of|prefer|anti-?pattern|smell|refactor|unhandled|validation)\b/i],
    threshold: 3,
    label: 'Review findings'
  }
};

/**
 * transcript 파일에서 각 신호 카테고리의 출현 횟수를 센다.
 * 한 줄에 여러 패턴이 맞아도 카테고리당 1회로 센다 (과대평가 방지).
 * @param {string} transcriptPath
 * @returns {{counts: object, userMessages: number}}
 */
function scanTranscript(transcriptPath) {
  const counts = { user_correction: 0, build_failure: 0, review_finding: 0 };
  let userMessages = 0;

  let content;
  try {
    content = fs.readFileSync(transcriptPath, 'utf8');
  } catch {
    return { counts, userMessages };
  }

  // transcript 는 JSONL. 줄 단위로 보되, 파싱 실패해도 raw 텍스트로 매칭.
  const lines = content.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    if (/"type"\s*:\s*"user"/.test(line)) userMessages += 1;

    for (const [key, sig] of Object.entries(SIGNALS)) {
      if (sig.patterns.some(re => re.test(line))) {
        counts[key] += 1;
      }
    }
  }

  return { counts, userMessages };
}

/**
 * 스캔 결과로 후보 카테고리를 추린다.
 * @param {object} counts
 * @returns {string[]} 임계값을 넘은 카테고리 label 배열
 */
function candidateCategories(counts) {
  const out = [];
  for (const [key, sig] of Object.entries(SIGNALS)) {
    if ((counts[key] || 0) >= sig.threshold) out.push(sig.label);
  }
  return out;
}

/**
 * 사용자에게 보여줄 한 줄 알림(systemMessage)을 만든다.
 *
 * Stop 이벤트는 hookSpecificOutput.additionalContext 를 허용하지 않는다
 * (PreToolUse/UserPromptSubmit/PostToolUse/PostToolBatch 만 가능). 따라서
 * Claude 에 컨텍스트를 자동 주입하는 대신, 사용자에게 `/lessons add` 를
 * 권하는 systemMessage 만 띄운다 — "제안만 한다" 는 원래 철학과도 맞다.
 *
 * @param {string[]} categories
 * @returns {string}
 */
function buildSuggestion(categories) {
  const cats = categories.join(', ');
  return `📝 반복 교정 신호 감지(${cats}). 교훈을 남기려면 /lessons add 를 실행하세요.`;
}

/**
 * @param {string} rawInput - stdin JSON 문자열
 * @returns {string} additionalContext 를 담은 JSON, 또는 원본 pass-through
 */
function run(rawInput) {
  try {
    const input = rawInput && rawInput.trim() ? JSON.parse(rawInput) : {};
    const transcriptPath = input.transcript_path || process.env.CLAUDE_TRANSCRIPT_PATH;

    if (!transcriptPath || !fs.existsSync(transcriptPath)) {
      return rawInput;
    }

    const { counts, userMessages } = scanTranscript(transcriptPath);

    // 너무 짧은 세션은 건너뛴다 (노이즈 방지).
    if (userMessages < 5) {
      return rawInput;
    }

    const categories = candidateCategories(counts);
    if (categories.length === 0) {
      return rawInput;
    }

    log(`[CaptureLessons] 반복 교정 신호 감지: ${categories.join(', ')}`);

    // Stop 이벤트에서 유효한 필드는 systemMessage (additionalContext 불가).
    return JSON.stringify({ systemMessage: buildSuggestion(categories) });
  } catch (err) {
    log(`[CaptureLessons] error (non-blocking): ${err.message}`);
    return rawInput;
  }
}

if (require.main === module) {
  let data = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    if (data.length < MAX_STDIN) data += chunk.substring(0, MAX_STDIN - data.length);
  });
  process.stdin.on('end', () => {
    process.stdout.write(run(data));
    process.exit(0);
  });
  process.stdin.on('error', () => {
    process.stdout.write(data);
    process.exit(0);
  });
}

module.exports = { run, scanTranscript, candidateCategories, buildSuggestion, SIGNALS };
