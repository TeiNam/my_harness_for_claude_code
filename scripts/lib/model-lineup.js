'use strict';

/**
 * model-lineup.js — 하네스가 쓰는 모델 세대의 단일 출처.
 *
 * 이전 세대는 쓰지 않는다. `optimize-settings.js` 가 이 표로 두 가지를 강제한다:
 *   1. 별칭 핀 — `opus`/`sonnet`/`haiku`/`fable` 이 아래 ID 로만 풀린다.
 *   2. `availableModels` — 아래 ID 밖의 모델은 `/model`·`--model` 로도 고를 수 없다.
 *      목록은 **전체 ID** 여야 한다. 별칭(`"opus"`)으로 적으면 계열만 제한돼
 *      Opus 5 나 Fable 5.1 이 그대로 통과한다(2026-11-15 실측).
 *
 * 세대가 바뀌면 이 파일만 고치고 `npm run optimize-settings -- --apply` 를 돌린다.
 */

const LINEUP = Object.freeze({
  fable: 'claude-fable-5-2',
  opus: 'claude-opus-5-5',
  sonnet: 'claude-sonnet-5-5',
  haiku: 'claude-haiku-5-5'
});

const PIN_ENV = Object.freeze({
  fable: 'ANTHROPIC_DEFAULT_FABLE_MODEL',
  opus: 'ANTHROPIC_DEFAULT_OPUS_MODEL',
  sonnet: 'ANTHROPIC_DEFAULT_SONNET_MODEL',
  haiku: 'ANTHROPIC_DEFAULT_HAIKU_MODEL'
});

const DEFAULT_BEDROCK_PREFIX = 'global';

const isOn = value => ['1', 'true'].includes(String(value || '').trim().toLowerCase());

/**
 * 프로바이더에 맞는 모델 ID. Bedrock 은 추론 프로파일 접두어가 붙고
 * (`global.anthropic.claude-opus-5-5`), 그 밖에는 ID 그대로다.
 * @param {string} alias
 * @param {Record<string, string|undefined>} env settings.json 의 env (없는 값은 셸 env)
 */
function resolveModelId(alias, env = {}) {
  const id = LINEUP[alias];
  if (!id) throw new Error(`unknown model alias: ${alias}`);
  if (!isOn(env.CLAUDE_CODE_USE_BEDROCK)) return id;
  const prefix = String(env.ANTHROPIC_BEDROCK_REGION_PREFIX || DEFAULT_BEDROCK_PREFIX).trim();
  return `${prefix}.anthropic.${id}`;
}

/** settings.json 이 가져야 할 핀과 허용 목록. */
function expectedLineup(env = {}) {
  const aliases = Object.keys(LINEUP);
  return {
    pins: Object.fromEntries(aliases.map(alias => [PIN_ENV[alias], resolveModelId(alias, env)])),
    availableModels: aliases.map(alias => resolveModelId(alias, env))
  };
}

/** `claude-opus-5-5[1m]` 같은 컨텍스트 변형 접미사를 뗀다. */
const stripVariant = model => String(model || '').replace(/\[[^\]]*\]$/, '');

module.exports = { LINEUP, PIN_ENV, resolveModelId, expectedLineup, stripVariant };
