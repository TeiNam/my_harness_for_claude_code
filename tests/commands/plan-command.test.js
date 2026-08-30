'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const planCommandPath = path.join(repoRoot, 'commands', 'plan.md');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error.message}`);
    failed++;
  }
}

function readPlanCommand() {
  return fs.readFileSync(planCommandPath, 'utf8');
}

console.log('\n=== Testing /plan command prompt ===\n');

// 2026-08-30: "인라인 기본" 규칙을 뒤집었다(하네스 전역 정책 — docs/rules-reference/agents.md
// → Subagent Routing). 지켜야 할 불변식은 "위임을 피한다"가 아니라 **planner 가 없는 런타임에서도
// /plan 이 동작한다**는 것 하나다. 에이전트 파일 없이 커맨드만 배포되는 설치가 존재하기 때문이다.
test('/plan delegates to planner but degrades gracefully when it is missing', () => {
  const source = readPlanCommand();

  assert.ok(
    source.includes('`planner` 에이전트에 위임한다'),
    'Expected /plan to make planner delegation the default for self-contained input',
  );
  assert.ok(
    /planner` 가 (이 런타임에 )?없/.test(source),
    'Expected /plan to define a planner-unavailable fallback',
  );
  assert.ok(
    source.includes('인라인'),
    'Expected the fallback to be inline planning',
  );
  assert.ok(
    source.includes("Agent type 'planner' not found"),
    'Expected /plan to suppress the missing-agent error instead of surfacing it',
  );
  assert.ok(
    source.includes('/fork-as planner'),
    'Expected /plan to route conversation-dependent planning through a fork',
  );
});

test('/plan preserves the explicit confirmation gate before code edits', () => {
  const source = readPlanCommand();

  assert.ok(
    source.includes('WAIT for user CONFIRM before touching any code'),
    'Expected frontmatter to preserve the no-code-before-confirmation rule',
  );
  assert.ok(
    source.includes('WAITING FOR CONFIRMATION'),
    'Expected example output to preserve the confirmation handoff',
  );
  assert.ok(
    source.includes('will **NOT** write any code until you explicitly confirm'),
    'Expected important notes to preserve the confirmation contract',
  );
});

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);

process.exit(failed > 0 ? 1 : 0);
