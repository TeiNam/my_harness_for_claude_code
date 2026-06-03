/**
 * Tests for scripts/hooks/capture-lessons.js
 *
 * 모듈 단위 테스트 + run-with-flags.js 를 통한 실제 실행 경로 테스트.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const { run, scanTranscript, candidateCategories } = require('../../scripts/hooks/capture-lessons.js');

const runner = path.join(__dirname, '..', '..', 'scripts', 'hooks', 'run-with-flags.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed += 1;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error.message}`);
    failed += 1;
  }
}

// 임시 transcript 파일 생성 헬퍼
function writeTranscript(lines) {
  const file = path.join(os.tmpdir(), `capture-lessons-test-${process.pid}-${Math.floor(process.hrtime()[1])}.jsonl`);
  fs.writeFileSync(file, lines.join('\n'));
  return file;
}

const created = [];
function transcript(lines) {
  const f = writeTranscript(lines);
  created.push(f);
  return f;
}

// --- 모듈 단위 테스트 -------------------------------------------------------

test('반복 사용자 정정 + 빌드 실패 신호를 감지해 systemMessage 로 알린다', () => {
  const lines = [];
  for (let i = 0; i < 6; i++) lines.push(JSON.stringify({ type: 'user', message: 'no, that is wrong, do it again' }));
  for (let i = 0; i < 3; i++) lines.push(JSON.stringify({ type: 'assistant', message: 'TypeError: cannot find module, build failed with exit code 1' }));
  const file = transcript(lines);

  const out = run(JSON.stringify({ transcript_path: file }));
  const parsed = JSON.parse(out);
  // Stop 이벤트는 hookSpecificOutput.additionalContext 를 허용하지 않으므로
  // systemMessage 로만 알린다 (Stop 스키마 준수).
  assert.ok(!('hookSpecificOutput' in parsed), 'Stop hook 은 hookSpecificOutput 을 내면 안 된다');
  assert.match(parsed.systemMessage, /\/lessons add/);
  assert.match(parsed.systemMessage, /User corrections/);
  assert.match(parsed.systemMessage, /Build failure patterns/);
});

test('한국어 정정 표현도 user_correction 으로 센다', () => {
  const lines = [];
  for (let i = 0; i < 6; i++) lines.push(JSON.stringify({ type: 'user', message: '아니 그게 아니라 다시 해줘' }));
  const file = transcript(lines);
  const { counts, userMessages } = scanTranscript(file);
  assert.ok(userMessages >= 6);
  assert.ok(counts.user_correction >= 2);
});

test('신호가 임계값 미만이면 후보가 없다', () => {
  const counts = { user_correction: 1, build_failure: 1, review_finding: 1 };
  assert.deepStrictEqual(candidateCategories(counts), []);
});

test('짧은 세션(사용자 메시지 5개 미만)은 pass-through', () => {
  const file = transcript([JSON.stringify({ type: 'user', message: 'no wrong' })]);
  const input = JSON.stringify({ transcript_path: file });
  assert.strictEqual(run(input), input);
});

test('존재하지 않는 transcript 는 pass-through', () => {
  const input = JSON.stringify({ transcript_path: '/nonexistent/path/xyz.jsonl' });
  assert.strictEqual(run(input), input);
});

test('빈 입력은 빈 문자열을 그대로 돌려준다', () => {
  assert.strictEqual(run(''), '');
});

test('잘못된 JSON 입력에서도 throw 하지 않고 원본을 돌려준다', () => {
  assert.strictEqual(run('not-json{{'), 'not-json{{');
});

// --- run-with-flags.js 실제 실행 경로 테스트 --------------------------------

test('run-with-flags 경유 실행 시 exit 0 + systemMessage 출력', () => {
  const lines = [];
  for (let i = 0; i < 6; i++) lines.push(JSON.stringify({ type: 'user', message: 'no that is wrong, do not, try again' }));
  for (let i = 0; i < 3; i++) lines.push(JSON.stringify({ type: 'assistant', message: 'eslint error, tsc failed, exit code 2' }));
  const file = transcript(lines);

  const result = spawnSync('node', [runner, 'stop:capture-lessons', 'scripts/hooks/capture-lessons.js', 'minimal,standard,strict'], {
    input: JSON.stringify({ transcript_path: file }),
    encoding: 'utf8',
    env: { ...process.env, HARNESS_HOOK_PROFILE: 'standard' },
    timeout: 15000,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  assert.strictEqual(result.status, 0, `exit code should be 0, got ${result.status}`);
  const parsed = JSON.parse(result.stdout);
  assert.match(parsed.systemMessage, /\/lessons add/);
});

// --- 정리 ------------------------------------------------------------------

for (const f of created) {
  try {
    fs.unlinkSync(f);
  } catch {
    /* ignore */
  }
}

console.log(`\ncapture-lessons: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
