#!/usr/bin/env node
/**
 * Validate hooks.json schema and hook entry rules.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Ajv = require('ajv');

const HOOKS_FILE = path.join(__dirname, '../../hooks/hooks.json');
const HOOKS_SCHEMA_PATH = path.join(__dirname, '../../schemas/hooks.schema.json');
const CLAUDE_MD = path.join(__dirname, '../../CLAUDE.md');
const PROFILES = ['minimal', 'standard', 'strict'];
const VALID_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PermissionRequest',
  'PostToolUse',
  'PostToolUseFailure',
  'Notification',
  'SubagentStart',
  'Stop',
  'SubagentStop',
  'PreCompact',
  'InstructionsLoaded',
  'TeammateIdle',
  'TaskCompleted',
  'ConfigChange',
  'WorktreeCreate',
  'WorktreeRemove',
  'SessionEnd',
];
const VALID_HOOK_TYPES = ['command', 'http', 'prompt', 'agent'];
const EVENTS_WITHOUT_MATCHER = new Set(['UserPromptSubmit', 'Notification', 'Stop', 'SubagentStop']);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonEmptyStringArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(item => isNonEmptyString(item));
}

/**
 * Validate a single hook entry has required fields and valid inline JS
 * @param {object} hook - Hook object with type and command fields
 * @param {string} label - Label for error messages (e.g., "PreToolUse[0].hooks[1]")
 * @returns {boolean} true if errors were found
 */
function validateHookEntry(hook, label) {
  let hasErrors = false;

  if (!hook.type || typeof hook.type !== 'string') {
    console.error(`ERROR: ${label} missing or invalid 'type' field`);
    hasErrors = true;
  } else if (!VALID_HOOK_TYPES.includes(hook.type)) {
    console.error(`ERROR: ${label} has unsupported hook type '${hook.type}'`);
    hasErrors = true;
  }

  if ('timeout' in hook && (typeof hook.timeout !== 'number' || hook.timeout < 0)) {
    console.error(`ERROR: ${label} 'timeout' must be a non-negative number`);
    hasErrors = true;
  }

  if (hook.type === 'command') {
    if ('async' in hook && typeof hook.async !== 'boolean') {
      console.error(`ERROR: ${label} 'async' must be a boolean`);
      hasErrors = true;
    }

    if (!isNonEmptyString(hook.command) && !isNonEmptyStringArray(hook.command)) {
      console.error(`ERROR: ${label} missing or invalid 'command' field`);
      hasErrors = true;
    } else if (typeof hook.command === 'string') {
      const nodeEMatch = hook.command.match(/^node -e "((?:[^"\\]|\\.)*)"(?:\s|$)/s);
      if (nodeEMatch) {
        try {
          new vm.Script(nodeEMatch[1].replace(/\\\\/g, '\\').replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t'));
        } catch (syntaxErr) {
          console.error(`ERROR: ${label} has invalid inline JS: ${syntaxErr.message}`);
          hasErrors = true;
        }
      }
    }

    return hasErrors;
  }

  if ('async' in hook) {
    console.error(`ERROR: ${label} 'async' is only supported for command hooks`);
    hasErrors = true;
  }

  if (hook.type === 'http') {
    if (!isNonEmptyString(hook.url)) {
      console.error(`ERROR: ${label} missing or invalid 'url' field`);
      hasErrors = true;
    }

    if ('headers' in hook && (typeof hook.headers !== 'object' || hook.headers === null || Array.isArray(hook.headers) || !Object.values(hook.headers).every(value => typeof value === 'string'))) {
      console.error(`ERROR: ${label} 'headers' must be an object with string values`);
      hasErrors = true;
    }

    if ('allowedEnvVars' in hook && (!Array.isArray(hook.allowedEnvVars) || !hook.allowedEnvVars.every(value => isNonEmptyString(value)))) {
      console.error(`ERROR: ${label} 'allowedEnvVars' must be an array of strings`);
      hasErrors = true;
    }

    return hasErrors;
  }

  if (!isNonEmptyString(hook.prompt)) {
    console.error(`ERROR: ${label} missing or invalid 'prompt' field`);
    hasErrors = true;
  }

  if ('model' in hook && !isNonEmptyString(hook.model)) {
    console.error(`ERROR: ${label} 'model' must be a non-empty string`);
    hasErrors = true;
  }

  return hasErrors;
}

function validateHooks() {
  if (!fs.existsSync(HOOKS_FILE)) {
    console.log('No hooks.json found, skipping validation');
    process.exit(0);
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(HOOKS_FILE, 'utf-8'));
  } catch (e) {
    console.error(`ERROR: Invalid JSON in hooks.json: ${e.message}`);
    process.exit(1);
  }

  // Validate against JSON schema
  if (fs.existsSync(HOOKS_SCHEMA_PATH)) {
    const schema = JSON.parse(fs.readFileSync(HOOKS_SCHEMA_PATH, 'utf-8'));
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(schema);
    const valid = validate(data);
    if (!valid) {
      for (const err of validate.errors) {
        console.error(`ERROR: hooks.json schema: ${err.instancePath || '/'} ${err.message}`);
      }
      process.exit(1);
    }
  }

  // Support both object format { hooks: {...} } and array format
  const hooks = data.hooks || data;
  let hasErrors = false;
  let totalMatchers = 0;

  if (typeof hooks === 'object' && !Array.isArray(hooks)) {
    // Object format: { EventType: [matchers] }
    for (const [eventType, matchers] of Object.entries(hooks)) {
      if (!VALID_EVENTS.includes(eventType)) {
        console.error(`ERROR: Invalid event type: ${eventType}`);
        hasErrors = true;
        continue;
      }

      if (!Array.isArray(matchers)) {
        console.error(`ERROR: ${eventType} must be an array`);
        hasErrors = true;
        continue;
      }

      for (let i = 0; i < matchers.length; i++) {
        const matcher = matchers[i];
        if (typeof matcher !== 'object' || matcher === null) {
          console.error(`ERROR: ${eventType}[${i}] is not an object`);
          hasErrors = true;
          continue;
        }
        if (!('matcher' in matcher) && !EVENTS_WITHOUT_MATCHER.has(eventType)) {
          console.error(`ERROR: ${eventType}[${i}] missing 'matcher' field`);
          hasErrors = true;
        } else if ('matcher' in matcher && typeof matcher.matcher !== 'string' && (typeof matcher.matcher !== 'object' || matcher.matcher === null)) {
          console.error(`ERROR: ${eventType}[${i}] has invalid 'matcher' field`);
          hasErrors = true;
        }
        if (!matcher.hooks || !Array.isArray(matcher.hooks)) {
          console.error(`ERROR: ${eventType}[${i}] missing 'hooks' array`);
          hasErrors = true;
        } else {
          // Validate each hook entry
          for (let j = 0; j < matcher.hooks.length; j++) {
            if (validateHookEntry(matcher.hooks[j], `${eventType}[${i}].hooks[${j}]`)) {
              hasErrors = true;
            }
          }
        }
        totalMatchers++;
      }
    }
  } else if (Array.isArray(hooks)) {
    // Array format (legacy)
    for (let i = 0; i < hooks.length; i++) {
      const hook = hooks[i];
      if (!('matcher' in hook)) {
        console.error(`ERROR: Hook ${i} missing 'matcher' field`);
        hasErrors = true;
      } else if (typeof hook.matcher !== 'string' && (typeof hook.matcher !== 'object' || hook.matcher === null)) {
        console.error(`ERROR: Hook ${i} has invalid 'matcher' field`);
        hasErrors = true;
      }
      if (!hook.hooks || !Array.isArray(hook.hooks)) {
        console.error(`ERROR: Hook ${i} missing 'hooks' array`);
        hasErrors = true;
      } else {
        // Validate each hook entry
        for (let j = 0; j < hook.hooks.length; j++) {
          if (validateHookEntry(hook.hooks[j], `Hook ${i}.hooks[${j}]`)) {
            hasErrors = true;
          }
        }
      }
      totalMatchers++;
    }
  } else {
    console.error('ERROR: hooks.json must be an object or array');
    process.exit(1);
  }

  if (hasErrors) {
    process.exit(1);
  }

  if (validateProfileCounts(hooks)) {
    process.exit(1);
  }

  console.log(`Validated ${totalMatchers} hook matchers`);
}

/**
 * 훅 그룹이 run-with-flags 에 넘기는 프로파일 CSV 를 뽑는다.
 *
 * 두 가지 배선 형태를 모두 지원한다:
 *   A) Pre/Post — `run-with-flags.js <id> <script> <csv>` (공백 인자)
 *   B) Stop/SessionEnd — 인라인 bootstrap 의 `spawnSync(execPath, [script,'<id>','<script>','<csv>'])`
 *
 * @returns {string|null} CSV, 또는 게이트 없이 직접 실행되는 그룹이면 null
 */
function extractProfileCsv(command) {
  const spaceForm = command.match(/run-with-flags\.js\s+\S+\s+scripts\/hooks\/\S+\s+([a-z,]+)/);
  if (spaceForm) return spaceForm[1];

  const arrayForm = command.match(/\[script,'[a-z:*-]+','scripts\/hooks\/[^']+','([a-z,]+)'\]/);
  if (arrayForm) return arrayForm[1];

  return null;
}

/** 프로파일별로 실제 활성화되는 훅 그룹 수를 센다. CSV 없는 그룹(직접 실행)은 모든 프로파일에 포함. */
function countHooksByProfile(hooks) {
  const csvs = [];
  for (const list of Object.values(hooks || {})) {
    for (const group of Array.isArray(list) ? list : []) {
      const command = (group.hooks || []).map(h => h.command || '').join(' ');
      csvs.push(extractProfileCsv(command));
    }
  }

  const counts = {};
  for (const profile of PROFILES) {
    counts[profile] = csvs.filter(csv => csv === null || csv.split(',').includes(profile)).length;
  }
  return counts;
}

/**
 * CLAUDE.md 가 문서화한 프로파일별 훅 수(`**minimal (9훅)**`)를 hooks.json 실측과 대조한다.
 *
 * 서브훅(dispatcher 내부)을 그룹으로 착각해 카운트를 틀리는 실수를 막는다 —
 * hooks.json 의 그룹만 세는 것이 정답이고, 이 값은 기계가 정확히 계산할 수 있다.
 */
function validateProfileCounts(hooks) {
  if (!fs.existsSync(CLAUDE_MD)) return false;

  const doc = fs.readFileSync(CLAUDE_MD, 'utf8');
  const actual = countHooksByProfile(hooks);
  let hasErrors = false;

  for (const profile of PROFILES) {
    const match = doc.match(new RegExp(`\\*\\*${profile} \\((\\d+)훅\\)\\*\\*`));
    if (!match) continue; // 문서가 그 프로파일을 언급하지 않으면 검사 대상 아님

    const documented = Number(match[1]);
    if (documented !== actual[profile]) {
      console.error(
        `ERROR: CLAUDE.md says ${profile} has ${documented} hooks, but hooks.json has ${actual[profile]}`
      );
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.error('       프로파일 카운트는 hooks.json 의 그룹 수만 센다 — dispatcher 내부 서브훅은 별도로 세지 않는다.');
  }

  return hasErrors;
}

validateHooks();
