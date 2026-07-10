#!/usr/bin/env node
'use strict';

/**
 * checkbox-prompt.js — 의존성 0 방향키 체크박스 프롬프트.
 *
 * Node 내장 readline keypress + raw-mode 만 쓴다 (enquirer 등 npm 의존성 없음).
 * 대화형 설치 메뉴의 3단계(대분류/중분류/상세)에서 재사용된다.
 *
 * 조작:
 *   ↑/↓ (또는 k/j)  커서 이동
 *   space           토글
 *   a               전체 토글
 *   enter           확정 (선택 id 배열 반환)
 *   ctrl-c / esc    취소 (reject)
 *
 * 렌더는 output 스트림(기본 stderr)으로 — stdout 은 기계가 읽는 워크로드
 * 목록 전용이므로 프롬프트 UI 가 섞이면 안 된다.
 *
 * 테스트 용이성: 순수 상태 리듀서 `applyKey(state, key)` 를 분리했다. I/O 를
 * 타지 않고 키 시퀀스 → 최종 선택을 검증할 수 있다.
 */

const readline = require('readline');

/**
 * @typedef {{ id: string, label: string }} Option
 * @typedef {{ options: Option[], cursor: number, checked: Set<string> }} State
 */

/**
 * @param {Option[]} options
 * @param {string[]} [preselected]  기본 체크될 id 들
 * @returns {State}
 */
function createState(options, preselected = []) {
  return {
    options: options.slice(),
    cursor: 0,
    checked: new Set(preselected.filter(id => options.some(o => o.id === id))),
  };
}

/**
 * 키 이름 하나를 상태에 적용한다 (순수 함수: 새 상태 반환).
 * @param {State} state
 * @param {string} key  정규화된 키 이름: 'up'|'down'|'space'|'all'|'enter'|'abort'
 * @returns {{ state: State, done: boolean, aborted: boolean }}
 */
function applyKey(state, key) {
  const n = state.options.length;
  const next = {
    options: state.options,
    cursor: state.cursor,
    checked: new Set(state.checked),
  };

  switch (key) {
    case 'up':
      next.cursor = n ? (state.cursor - 1 + n) % n : 0;
      break;
    case 'down':
      next.cursor = n ? (state.cursor + 1) % n : 0;
      break;
    case 'space': {
      const id = state.options[state.cursor] && state.options[state.cursor].id;
      if (id !== undefined) {
        if (next.checked.has(id)) next.checked.delete(id);
        else next.checked.add(id);
      }
      break;
    }
    case 'all': {
      // 하나라도 미선택이면 전체 선택, 전부 선택돼 있으면 전체 해제.
      const allChecked = n > 0 && state.options.every(o => next.checked.has(o.id));
      next.checked = new Set(allChecked ? [] : state.options.map(o => o.id));
      break;
    }
    case 'enter':
      return { state: next, done: true, aborted: false };
    case 'abort':
      return { state: next, done: true, aborted: true };
    default:
      break; // 알 수 없는 키 무시
  }
  return { state: next, done: false, aborted: false };
}

/** 선택된 id 를 옵션 정의 순서대로 반환. */
function selectedIds(state) {
  return state.options.filter(o => state.checked.has(o.id)).map(o => o.id);
}

/** raw keypress 이벤트를 정규화된 키 이름으로 변환. 무시할 키는 null. */
function normalizeKey(str, key) {
  if (!key && !str) return null;
  const name = key && key.name;
  if (key && key.ctrl && (name === 'c' || name === 'd')) return 'abort';
  if (name === 'escape') return 'abort';
  if (name === 'up' || name === 'k') return 'up';
  if (name === 'down' || name === 'j') return 'down';
  if (name === 'return' || name === 'enter') return 'enter';
  if (name === 'space' || str === ' ') return 'space';
  if (name === 'a' || str === 'a') return 'all';
  return null;
}

/** 프롬프트를 그린다 (이전 렌더 라인 수만큼 커서 올려 덮어쓰기). */
function render(out, title, state, prevLines) {
  if (prevLines > 0) out.write(`\x1b[${prevLines}A`); // 위로 prevLines 줄
  let lines = 0;
  const write = s => { out.write(s + '\x1b[K\n'); lines++; }; // \x1b[K = 줄 끝까지 클리어
  write(title);
  state.options.forEach((o, i) => {
    const cursor = i === state.cursor ? '›' : ' ';
    const box = state.checked.has(o.id) ? '◉' : '◯';
    write(`  ${cursor} ${box} ${o.label}`);
  });
  write('  (↑/↓ 이동 · space 토글 · a 전체 · enter 확정)');
  return lines;
}

/**
 * 대화형 체크박스 프롬프트를 띄우고 선택 id 배열을 반환한다.
 * 비-TTY 환경에서는 호출하지 말 것 (호출부가 isTTY 로 가드).
 *
 * @param {{
 *   title: string,
 *   options: Option[],
 *   preselected?: string[],
 *   input?: NodeJS.ReadStream,
 *   output?: NodeJS.WriteStream,
 * }} opts
 * @returns {Promise<string[]>}
 */
function checkboxPrompt({ title, options, preselected = [], input = process.stdin, output = process.stderr } = {}) {
  return new Promise((resolve, reject) => {
    if (!options || options.length === 0) { resolve([]); return; }

    let state = createState(options, preselected);
    readline.emitKeypressEvents(input);
    const wasRaw = input.isRaw;
    if (typeof input.setRawMode === 'function') input.setRawMode(true);
    input.resume();

    let prevLines = render(output, title, state, 0);

    const cleanup = () => {
      input.removeListener('keypress', onKey);
      if (typeof input.setRawMode === 'function') input.setRawMode(wasRaw || false);
      input.pause();
      output.write('\n');
    };

    const onKey = (str, key) => {
      const norm = normalizeKey(str, key);
      if (!norm) return;
      const res = applyKey(state, norm);
      state = res.state;
      if (res.done) {
        cleanup();
        if (res.aborted) reject(new Error('cancelled'));
        else resolve(selectedIds(state));
        return;
      }
      prevLines = render(output, title, state, prevLines);
    };

    input.on('keypress', onKey);
  });
}

module.exports = {
  createState,
  applyKey,
  selectedIds,
  normalizeKey,
  checkboxPrompt,
};
