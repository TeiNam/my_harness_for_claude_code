'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const sessionManager = require('./session-manager');
const sessionAliases = require('./session-aliases');

const SESSION_SCHEMA_VERSION = 'harness.session.v1';
const SESSION_RECORDING_SCHEMA_VERSION = 'harness.session.recording.v1';
const DEFAULT_RECORDING_DIR = path.join(os.tmpdir(), 'harness-session-recordings');

const TARGET_TYPE_TO_ADAPTER_ID = Object.freeze({
  'claude-history': 'claude-history',
  'claude-alias': 'claude-history',
  'session-file': 'claude-history'
});

// ---------------------------------------------------------------------------
// canonical snapshot validation + persistence
// ---------------------------------------------------------------------------

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizePathSegment(value) {
  return String(value || 'unknown')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'unknown';
}

function parseContextSeedPaths(context) {
  if (typeof context !== 'string' || context.trim().length === 0) {
    return [];
  }

  return context
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

function ensureString(value, fieldPath) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Canonical session snapshot requires ${fieldPath} to be a non-empty string`);
  }
}

function ensureOptionalString(value, fieldPath) {
  if (value !== null && value !== undefined && typeof value !== 'string') {
    throw new Error(`Canonical session snapshot requires ${fieldPath} to be a string or null`);
  }
}

function ensureBoolean(value, fieldPath) {
  if (typeof value !== 'boolean') {
    throw new Error(`Canonical session snapshot requires ${fieldPath} to be a boolean`);
  }
}

function ensureArrayOfStrings(value, fieldPath) {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    throw new Error(`Canonical session snapshot requires ${fieldPath} to be an array of strings`);
  }
}

function ensureInteger(value, fieldPath) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Canonical session snapshot requires ${fieldPath} to be a non-negative integer`);
  }
}

function buildAggregates(workers) {
  const states = workers.reduce((accumulator, worker) => {
    const state = worker.state || 'unknown';
    accumulator[state] = (accumulator[state] || 0) + 1;
    return accumulator;
  }, {});

  const healths = workers.reduce((accumulator, worker) => {
    const health = worker.health || 'unknown';
    accumulator[health] = (accumulator[health] || 0) + 1;
    return accumulator;
  }, {});

  return {
    workerCount: workers.length,
    states,
    healths
  };
}

function validateCanonicalSnapshot(snapshot) {
  if (!isObject(snapshot)) {
    throw new Error('Canonical session snapshot must be an object');
  }

  ensureString(snapshot.schemaVersion, 'schemaVersion');
  if (snapshot.schemaVersion !== SESSION_SCHEMA_VERSION) {
    throw new Error(`Unsupported canonical session schema version: ${snapshot.schemaVersion}`);
  }

  ensureString(snapshot.adapterId, 'adapterId');

  if (!isObject(snapshot.session)) {
    throw new Error('Canonical session snapshot requires session to be an object');
  }

  ensureString(snapshot.session.id, 'session.id');
  ensureString(snapshot.session.kind, 'session.kind');
  ensureString(snapshot.session.state, 'session.state');
  ensureOptionalString(snapshot.session.repoRoot, 'session.repoRoot');

  if (!isObject(snapshot.session.sourceTarget)) {
    throw new Error('Canonical session snapshot requires session.sourceTarget to be an object');
  }

  ensureString(snapshot.session.sourceTarget.type, 'session.sourceTarget.type');
  ensureString(snapshot.session.sourceTarget.value, 'session.sourceTarget.value');

  if (!Array.isArray(snapshot.workers)) {
    throw new Error('Canonical session snapshot requires workers to be an array');
  }

  snapshot.workers.forEach((worker, index) => {
    if (!isObject(worker)) {
      throw new Error(`Canonical session snapshot requires workers[${index}] to be an object`);
    }

    ensureString(worker.id, `workers[${index}].id`);
    ensureString(worker.label, `workers[${index}].label`);
    ensureString(worker.state, `workers[${index}].state`);
    ensureString(worker.health, `workers[${index}].health`);
    ensureOptionalString(worker.branch, `workers[${index}].branch`);
    ensureOptionalString(worker.worktree, `workers[${index}].worktree`);

    if (!isObject(worker.runtime)) {
      throw new Error(`Canonical session snapshot requires workers[${index}].runtime to be an object`);
    }

    ensureString(worker.runtime.kind, `workers[${index}].runtime.kind`);
    ensureOptionalString(worker.runtime.command, `workers[${index}].runtime.command`);
    ensureBoolean(worker.runtime.active, `workers[${index}].runtime.active`);
    ensureBoolean(worker.runtime.dead, `workers[${index}].runtime.dead`);

    if (!isObject(worker.intent)) {
      throw new Error(`Canonical session snapshot requires workers[${index}].intent to be an object`);
    }

    ensureString(worker.intent.objective, `workers[${index}].intent.objective`);
    ensureArrayOfStrings(worker.intent.seedPaths, `workers[${index}].intent.seedPaths`);

    if (!isObject(worker.outputs)) {
      throw new Error(`Canonical session snapshot requires workers[${index}].outputs to be an object`);
    }

    ensureArrayOfStrings(worker.outputs.summary, `workers[${index}].outputs.summary`);
    ensureArrayOfStrings(worker.outputs.validation, `workers[${index}].outputs.validation`);
    ensureArrayOfStrings(worker.outputs.remainingRisks, `workers[${index}].outputs.remainingRisks`);

    if (!isObject(worker.artifacts)) {
      throw new Error(`Canonical session snapshot requires workers[${index}].artifacts to be an object`);
    }
  });

  if (!isObject(snapshot.aggregates)) {
    throw new Error('Canonical session snapshot requires aggregates to be an object');
  }

  ensureInteger(snapshot.aggregates.workerCount, 'aggregates.workerCount');
  if (snapshot.aggregates.workerCount !== snapshot.workers.length) {
    throw new Error('Canonical session snapshot requires aggregates.workerCount to match workers.length');
  }

  if (!isObject(snapshot.aggregates.states)) {
    throw new Error('Canonical session snapshot requires aggregates.states to be an object');
  }

  if (!isObject(snapshot.aggregates.healths)) {
    throw new Error('Canonical session snapshot requires aggregates.healths to be an object');
  }

  for (const [state, count] of Object.entries(snapshot.aggregates.states)) {
    ensureString(state, 'aggregates.states key');
    ensureInteger(count, `aggregates.states.${state}`);
  }

  for (const [health, count] of Object.entries(snapshot.aggregates.healths)) {
    ensureString(health, 'aggregates.healths key');
    ensureInteger(count, `aggregates.healths.${health}`);
  }

  return snapshot;
}

function resolveRecordingDir(options = {}) {
  if (typeof options.recordingDir === 'string' && options.recordingDir.length > 0) {
    return path.resolve(options.recordingDir);
  }

  const envDir = process.env.HARNESS_SESSION_RECORDING_DIR;
  if (typeof envDir === 'string' && envDir.length > 0) {
    return path.resolve(envDir);
  }

  return DEFAULT_RECORDING_DIR;
}

function getFallbackSessionRecordingPath(snapshot, options = {}) {
  validateCanonicalSnapshot(snapshot);

  return path.join(
    resolveRecordingDir(options),
    sanitizePathSegment(snapshot.adapterId),
    `${sanitizePathSegment(snapshot.session.id)}.json`
  );
}

function readExistingRecording(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeFallbackSessionRecording(snapshot, options = {}) {
  const filePath = getFallbackSessionRecordingPath(snapshot, options);
  const recordedAt = new Date().toISOString();
  const existing = readExistingRecording(filePath);
  const snapshotChanged = !existing
    || JSON.stringify(existing.latest) !== JSON.stringify(snapshot);

  const payload = {
    schemaVersion: SESSION_RECORDING_SCHEMA_VERSION,
    adapterId: snapshot.adapterId,
    sessionId: snapshot.session.id,
    createdAt: existing && typeof existing.createdAt === 'string'
      ? existing.createdAt
      : recordedAt,
    updatedAt: recordedAt,
    latest: snapshot,
    history: Array.isArray(existing && existing.history)
      ? (snapshotChanged
          ? existing.history.concat([{ recordedAt, snapshot }])
          : existing.history)
      : [{ recordedAt, snapshot }]
  };

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf8');

  return {
    backend: 'json-file',
    path: filePath,
    recordedAt
  };
}

function loadStateStore(options = {}) {
  if (options.stateStore) {
    return options.stateStore;
  }

  const loadStateStoreImpl = options.loadStateStoreImpl || (() => require('./state-store'));

  try {
    return loadStateStoreImpl();
  } catch (error) {
    const missingRequestedModule = error
      && error.code === 'MODULE_NOT_FOUND'
      && typeof error.message === 'string'
      && error.message.includes('./state-store');

    if (missingRequestedModule) {
      return null;
    }

    throw error;
  }
}

function resolveStateStoreWriter(stateStore) {
  if (!stateStore) {
    return null;
  }

  const candidates = [
    { owner: stateStore, fn: stateStore.persistCanonicalSessionSnapshot },
    { owner: stateStore, fn: stateStore.recordCanonicalSessionSnapshot },
    { owner: stateStore, fn: stateStore.persistSessionSnapshot },
    { owner: stateStore, fn: stateStore.recordSessionSnapshot },
    { owner: stateStore, fn: stateStore.writeSessionSnapshot },
    {
      owner: stateStore.sessions,
      fn: stateStore.sessions && stateStore.sessions.persistCanonicalSessionSnapshot
    },
    {
      owner: stateStore.sessions,
      fn: stateStore.sessions && stateStore.sessions.recordCanonicalSessionSnapshot
    },
    {
      owner: stateStore.sessions,
      fn: stateStore.sessions && stateStore.sessions.persistSessionSnapshot
    },
    {
      owner: stateStore.sessions,
      fn: stateStore.sessions && stateStore.sessions.recordSessionSnapshot
    }
  ];

  const writer = candidates.find(candidate => typeof candidate.fn === 'function');
  return writer ? writer.fn.bind(writer.owner) : null;
}

function persistCanonicalSnapshot(snapshot, options = {}) {
  validateCanonicalSnapshot(snapshot);

  if (options.persist === false) {
    return {
      backend: 'skipped',
      path: null,
      recordedAt: null
    };
  }

  const stateStore = loadStateStore(options);
  const writer = resolveStateStoreWriter(stateStore);

  if (stateStore && !writer) {
    // Loaded module is a factory (e.g. exposes createStateStore but no writer).
    // Treat the same as a missing state store and fall through to the JSON-file
    // recording path.
    return writeFallbackSessionRecording(snapshot, options);
  }

  if (writer) {
    writer(snapshot, {
      adapterId: snapshot.adapterId,
      schemaVersion: snapshot.schemaVersion,
      sessionId: snapshot.session.id
    });

    return {
      backend: 'state-store',
      path: null,
      recordedAt: null
    };
  }

  return writeFallbackSessionRecording(snapshot, options);
}

function deriveClaudeWorkerId(session) {
  if (session.shortId && session.shortId !== 'no-id') {
    return session.shortId;
  }

  return path.basename(session.filename || session.sessionPath || 'session', '.tmp');
}

function normalizeClaudeHistorySession(session, sourceTarget) {
  const metadata = session.metadata || {};
  const workerId = deriveClaudeWorkerId(session);
  const worker = {
    id: workerId,
    label: metadata.title || session.filename || workerId,
    state: 'recorded',
    health: 'healthy',
    branch: metadata.branch || null,
    worktree: metadata.worktree || null,
    runtime: {
      kind: 'claude-session',
      command: 'claude',
      pid: null,
      active: false,
      dead: true,
    },
    intent: {
      objective: metadata.inProgress && metadata.inProgress.length > 0
        ? metadata.inProgress[0]
        : (metadata.title || ''),
      seedPaths: parseContextSeedPaths(metadata.context)
    },
    outputs: {
      summary: Array.isArray(metadata.completed) ? metadata.completed : [],
      validation: [],
      remainingRisks: metadata.notes ? [metadata.notes] : []
    },
    artifacts: {
      sessionFile: session.sessionPath,
      context: metadata.context || null
    }
  };

  return validateCanonicalSnapshot({
    schemaVersion: SESSION_SCHEMA_VERSION,
    adapterId: 'claude-history',
    session: {
      id: workerId,
      kind: 'history',
      state: 'recorded',
      repoRoot: metadata.worktree || null,
      sourceTarget
    },
    workers: [worker],
    aggregates: buildAggregates([worker])
  });
}

// ---------------------------------------------------------------------------
// claude-history adapter
// ---------------------------------------------------------------------------

function parseClaudeTarget(target) {
  if (typeof target !== 'string') {
    return null;
  }

  for (const prefix of ['claude-history:', 'claude:', 'history:']) {
    if (target.startsWith(prefix)) {
      return target.slice(prefix.length).trim();
    }
  }

  return null;
}

function isSessionFileTarget(target, cwd) {
  if (typeof target !== 'string' || target.length === 0) {
    return false;
  }

  const absoluteTarget = path.resolve(cwd, target);
  return fs.existsSync(absoluteTarget)
    && fs.statSync(absoluteTarget).isFile()
    && absoluteTarget.endsWith('.tmp');
}

function hydrateSessionFromPath(sessionPath) {
  const filename = path.basename(sessionPath);
  const parsed = sessionManager.parseSessionFilename(filename);
  if (!parsed) {
    throw new Error(`Unsupported session file: ${sessionPath}`);
  }

  const content = sessionManager.getSessionContent(sessionPath);
  const stats = fs.statSync(sessionPath);

  return {
    ...parsed,
    sessionPath,
    content,
    metadata: sessionManager.parseSessionMetadata(content),
    stats: sessionManager.getSessionStats(content || ''),
    size: stats.size,
    modifiedTime: stats.mtime,
    createdTime: stats.birthtime || stats.ctime
  };
}

function resolveSessionRecord(target, cwd) {
  const explicitTarget = parseClaudeTarget(target);

  if (explicitTarget) {
    if (explicitTarget === 'latest') {
      const [latest] = sessionManager.getAllSessions({ limit: 1 }).sessions;
      if (!latest) {
        throw new Error('No Claude session history found');
      }

      return {
        session: sessionManager.getSessionById(latest.filename, true),
        sourceTarget: {
          type: 'claude-history',
          value: 'latest'
        }
      };
    }

    const alias = sessionAliases.resolveAlias(explicitTarget);
    if (alias) {
      return {
        session: hydrateSessionFromPath(alias.sessionPath),
        sourceTarget: {
          type: 'claude-alias',
          value: explicitTarget
        }
      };
    }

    const session = sessionManager.getSessionById(explicitTarget, true);
    if (!session) {
      throw new Error(`Claude session not found: ${explicitTarget}`);
    }

    return {
      session,
      sourceTarget: {
        type: 'claude-history',
        value: explicitTarget
      }
    };
  }

  if (isSessionFileTarget(target, cwd)) {
    return {
      session: hydrateSessionFromPath(path.resolve(cwd, target)),
      sourceTarget: {
        type: 'session-file',
        value: path.resolve(cwd, target)
      }
    };
  }

  throw new Error(`Unsupported Claude session target: ${target}`);
}

function createClaudeHistoryAdapter(options = {}) {
  const persistCanonicalSnapshotImpl = options.persistCanonicalSnapshotImpl || persistCanonicalSnapshot;

  return {
    id: 'claude-history',
    description: 'Claude local session history and session-file snapshots',
    targetTypes: ['claude-history', 'claude-alias', 'session-file'],
    canOpen(target, context = {}) {
      if (context.adapterId && context.adapterId !== 'claude-history') {
        return false;
      }

      if (context.adapterId === 'claude-history') {
        return true;
      }

      const cwd = context.cwd || process.cwd();
      return parseClaudeTarget(target) !== null || isSessionFileTarget(target, cwd);
    },
    open(target, context = {}) {
      const cwd = context.cwd || process.cwd();

      return {
        adapterId: 'claude-history',
        getSnapshot() {
          const { session, sourceTarget } = resolveSessionRecord(target, cwd);
          const canonicalSnapshot = normalizeClaudeHistorySession(session, sourceTarget);

          persistCanonicalSnapshotImpl(canonicalSnapshot, {
            loadStateStoreImpl: options.loadStateStoreImpl,
            persist: context.persistSnapshots !== false && options.persistSnapshots !== false,
            recordingDir: context.recordingDir || options.recordingDir,
            stateStore: options.stateStore
          });

          return canonicalSnapshot;
        }
      };
    }
  };
}

// ---------------------------------------------------------------------------
// adapter registry
// ---------------------------------------------------------------------------

function buildDefaultAdapterOptions(options, adapterId) {
  const sharedOptions = {
    loadStateStoreImpl: options.loadStateStoreImpl,
    persistSnapshots: options.persistSnapshots,
    recordingDir: options.recordingDir,
    stateStore: options.stateStore
  };

  return {
    ...sharedOptions,
    ...(options.adapterOptions && options.adapterOptions[adapterId]
      ? options.adapterOptions[adapterId]
      : {})
  };
}

function createDefaultAdapters(options = {}) {
  return [
    createClaudeHistoryAdapter(buildDefaultAdapterOptions(options, 'claude-history'))
  ];
}

function coerceTargetValue(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Structured session targets require a non-empty string value');
  }

  return value.trim();
}

function normalizeStructuredTarget(target, context = {}) {
  if (!target || typeof target !== 'object' || Array.isArray(target)) {
    return {
      target,
      context: { ...context }
    };
  }

  const value = coerceTargetValue(target.value);
  const type = typeof target.type === 'string' ? target.type.trim() : '';
  if (type.length === 0) {
    throw new Error('Structured session targets require a non-empty type');
  }

  const adapterId = target.adapterId || TARGET_TYPE_TO_ADAPTER_ID[type] || context.adapterId || null;
  const nextContext = {
    ...context,
    adapterId
  };

  if (type === 'claude-history' || type === 'claude-alias') {
    return {
      target: `claude:${value}`,
      context: nextContext
    };
  }

  return {
    target: value,
    context: nextContext
  };
}

function createAdapterRegistry(options = {}) {
  const adapters = options.adapters || createDefaultAdapters(options);

  return {
    adapters,
    getAdapter(id) {
      const adapter = adapters.find(candidate => candidate.id === id);
      if (!adapter) {
        throw new Error(`Unknown session adapter: ${id}`);
      }

      return adapter;
    },
    listAdapters() {
      return adapters.map(adapter => ({
        id: adapter.id,
        description: adapter.description || '',
        targetTypes: Array.isArray(adapter.targetTypes) ? [...adapter.targetTypes] : []
      }));
    },
    select(target, context = {}) {
      const normalized = normalizeStructuredTarget(target, context);
      const adapter = normalized.context.adapterId
        ? this.getAdapter(normalized.context.adapterId)
        : adapters.find(candidate => candidate.canOpen(normalized.target, normalized.context));
      if (!adapter) {
        throw new Error(`No session adapter matched target: ${target}`);
      }

      return adapter;
    },
    open(target, context = {}) {
      const normalized = normalizeStructuredTarget(target, context);
      const adapter = this.select(normalized.target, normalized.context);
      return adapter.open(normalized.target, normalized.context);
    }
  };
}

function inspectSessionTarget(target, options = {}) {
  const registry = createAdapterRegistry(options);
  return registry.open(target, options).getSnapshot();
}

module.exports = {
  SESSION_SCHEMA_VERSION,
  buildAggregates,
  createAdapterRegistry,
  createClaudeHistoryAdapter,
  createDefaultAdapters,
  getFallbackSessionRecordingPath,
  inspectSessionTarget,
  isSessionFileTarget,
  normalizeClaudeHistorySession,
  normalizeStructuredTarget,
  parseClaudeTarget,
  persistCanonicalSnapshot,
  validateCanonicalSnapshot
};
