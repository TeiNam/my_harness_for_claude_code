#!/usr/bin/env node
'use strict';

/**
 * build-marketplace.js — Generate a Claude Code `/plugin` marketplace from the
 * flat harness assets, one plugin per workload group.
 *
 * Native `/plugin` already supports "install only what you need": a user runs
 *   /plugin marketplace add <this repo>
 *   /plugin            # pick harness-frontend, harness-mysql, … one by one
 * so the interactive selection is just a side effect of splitting the harness
 * into one plugin per workload.
 *
 * Layout produced (committed to git so GitHub clones can serve it):
 *   .claude-plugin/marketplace.json          # lists every harness-<group> plugin
 *   plugins/harness-<group>/
 *     .claude-plugin/plugin.json
 *     skills/<name>    -> symlink (or copy) of repo skills/<name>
 *     agents/<name>.md -> symlink (or copy)
 *     commands/<name>.md
 *
 * Components split across two install paths:
 *   - agents/commands/skills  -> one harness-<workload> plugin each (below)
 *   - mcp-configs/            -> a single harness-mcp plugin (.mcp.json)
 *   - rules/ + hooks/         -> stay with install.sh. rules aren't a plugin
 *                                component type at all; hooks rely on env-profile
 *                                gating (HARNESS_HOOK_PROFILE, which a plugin
 *                                can't set) + a bundled scripts/ tree, so
 *                                plugin-izing them risks broken gating and
 *                                double-execution alongside --with-hooks.
 *
 * Discovery quirk (verified with `claude plugin details`): plugin scanning
 * follows DIRECTORY symlinks (skills load fine) but NOT FILE symlinks (a
 * symlinked agent/command .md is silently skipped). So skills are symlinked
 * (zero duplication — they're the bulk) while agents/commands are copied as
 * real files. `--copy` also copies skills (Windows / git-without-symlinks).
 *
 * CLI:
 *   node scripts/install/build-marketplace.js [--copy] [--root=<repo>] [--check]
 *     --copy    real files instead of symlinks
 *     --check   verify committed output matches what we'd generate; exit 1 on drift
 *     --root    repo root (default: this file's ../..)
 */

const fs = require('fs');
const path = require('path');

const { selectAssets } = require('./select-assets');
const { GROUPS } = require('./workloads');

const MARKETPLACE_NAME = 'harness';
const MARKETPLACE_DESC = 'Personal Claude Code harness — workload별 플러그인 (필요한 것만 골라 설치)';
const OWNER = { name: 'teinam' };
const PLUGINS_DIR = 'plugins';
// ponytail: version pinned to package.json; bump there, regenerate.
const VERSION = require('../../package.json').version;

// Plugins only carry these kinds — rules/hooks/mcp stay with install.sh.
const PLUGIN_KINDS = new Set(['agent', 'command', 'skill']);

// Meta/experimental group: never menu-exposed, never a plugin.
const SKIP_GROUPS = new Set(['lab']);

// MCP lives in one standalone plugin (harness-mcp), not a workload split.
// `mcp` reuses pluginName()/pluginJson() so its name is harness-mcp.
const MCP_GROUP = 'mcp';
const MCP_SOURCE_REL = 'mcp-configs/mcp-servers.json';

/** Short human descriptions; falls back to the group key when missing. */
const DESCRIPTIONS = {
  'core': '항상 포함되는 코어 — planning · review · git · sessions · 학습 메커니즘',
  'python-backend': 'FastAPI · Python 백엔드 (api-design · async · domain-modeling · security · testing)',
  'rust': 'Rust 개발 — 패턴 · 리뷰어 · 빌드 해결',
  'nodejs': 'Node.js 서버 · 툴링 (Bun · Prisma)',
  'cloud': 'AWS · Docker · Terraform · K8s — DevOps',
  'ai': 'Claude SDK · Bedrock · LLM 파이프라인 · 온디바이스 · 실시간 STT',
  'frontend': 'React · Vite · TypeScript · Web UI · 접근성 · 모션',
  'obsidian': 'Obsidian 플러그인 개발 (TS · i18n · 릴리스 체크리스트)',
  'plugin-chrome': 'Chrome 확장 개발 (예약)',
  'plugin-claude': 'Claude Code 플러그인 개발 (예약)',
  'python-data': 'DuckDB · pandas · polars · PyTorch · MLE · RecSys',
  'mysql': 'MySQL · Aurora MySQL — 스키마 · 인덱스 · 파티셔닝 · 최적화',
  'postgres': 'PostgreSQL · Aurora Postgres — 스키마 · 인덱스 · 성능',
  'mongodb': 'MongoDB 문서 설계 · 인덱스 · 샤딩',
  'dynamodb': 'DynamoDB NoSQL 패턴 — single-table · GSI',
  'writing': '아티클 · 콘텐츠 · 블로깅 · 카피 · 번역 · PPT · humanize',
  'mcp': 'MCP 서버 묶음 — github · context7 · exa · memory · playwright · sequential-thinking',
};

/**
 * Plugin-ready .mcp.json from the shared mcp-configs source. The committed
 * source carries `YOUR_*_HERE` placeholders; rewrite them to `${ENV}` refs so
 * the generated plugin reads real keys from the user's environment and the
 * repo never commits a secret-shaped literal. Drops the `_comments` block.
 */
function mcpJson(root) {
  const src = JSON.parse(fs.readFileSync(path.resolve(root, MCP_SOURCE_REL), 'utf8'));
  const out = { mcpServers: {} };
  for (const [name, def] of Object.entries(src.mcpServers || {})) {
    const next = { ...def };
    if (def.env) {
      next.env = {};
      for (const [key, value] of Object.entries(def.env)) {
        // YOUR_X_HERE -> ${X}; anything else passes through verbatim.
        next.env[key] = /^YOUR_.*_HERE$/.test(value) ? `\${${key}}` : value;
      }
    }
    out.mcpServers[name] = next;
  }
  return out;
}

function parseArgs(argv) {
  const flags = { copy: false, check: false, root: null };
  for (const a of argv.slice(2)) {
    const [key, value] = a.includes('=') ? [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)] : [a, null];
    switch (key) {
      case '--copy': flags.copy = true; break;
      case '--check': flags.check = true; break;
      case '--root': flags.root = value; break;
      case '-h': case '--help': flags.help = true; break;
      default: throw new Error(`Unknown flag: ${a}`);
    }
  }
  return flags;
}

/**
 * Build the plan: { group: [{ kind, sourceRel, linkRel }] } for every
 * non-empty, non-skipped group. `linkRel` is the path inside the plugin dir.
 */
function buildPlan(root) {
  const { all } = selectAssets({ root });
  const byGroup = new Map();
  for (const g of GROUPS) {
    if (!SKIP_GROUPS.has(g)) byGroup.set(g, []);
  }
  for (const asset of all) {
    if (!PLUGIN_KINDS.has(asset.kind)) continue;
    const base = path.posix.basename(asset.sourceRel);
    const sub = asset.kind === 'skill' ? 'skills' : `${asset.kind}s`;
    const linkRel = path.posix.join(sub, base);
    for (const g of asset.groups) {
      const bucket = byGroup.get(g);
      if (bucket) bucket.push({ kind: asset.kind, sourceRel: asset.sourceRel, linkRel });
    }
  }
  // Drop empty groups (reserved keys with no assets yet).
  const plan = {};
  for (const [g, assets] of byGroup) {
    if (assets.length) plan[g] = assets.sort((a, b) => a.linkRel.localeCompare(b.linkRel));
  }
  return plan;
}

function pluginName(group) {
  return `harness-${group}`;
}

/** harness-mcp ships only when the shared mcp-configs source is present. */
function mcpExists(root) {
  return Boolean(root) && fs.existsSync(path.resolve(root, MCP_SOURCE_REL));
}

function pluginJson(group) {
  return {
    name: pluginName(group),
    description: DESCRIPTIONS[group] || `harness ${group} assets`,
    version: VERSION,
    author: OWNER,
  };
}

function marketplaceJson(plan, root) {
  const groups = Object.keys(plan);
  if (mcpExists(root)) groups.push(MCP_GROUP);
  const plugins = groups.sort().map(group => ({
    name: pluginName(group),
    source: `./${PLUGINS_DIR}/${pluginName(group)}`,
    description: DESCRIPTIONS[group] || `harness ${group} assets`,
  }));
  return { name: MARKETPLACE_NAME, description: MARKETPLACE_DESC, owner: OWNER, plugins };
}

/**
 * Place an asset inside a plugin. Skills are directories → symlink works and
 * costs nothing. Agents/commands are files → plugin discovery ignores file
 * symlinks, so they must be real copies. `--copy` forces copies for all.
 */
function placeAsset(root, pluginDir, asset, copy) {
  const linkPath = path.join(pluginDir, asset.linkRel);
  const sourceAbs = path.resolve(root, asset.sourceRel);
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  const mustCopy = copy || asset.kind !== 'skill';
  if (mustCopy) {
    fs.cpSync(sourceAbs, linkPath, { recursive: true });
  } else {
    const rel = path.relative(path.dirname(linkPath), sourceAbs);
    fs.symlinkSync(rel, linkPath);
  }
}

function generate(root, plan, copy) {
  const pluginsRoot = path.join(root, PLUGINS_DIR);
  // Wipe only generated harness-* dirs; keep hand-written files like README.md.
  if (fs.existsSync(pluginsRoot)) {
    for (const name of fs.readdirSync(pluginsRoot)) {
      if (name.startsWith('harness-')) fs.rmSync(path.join(pluginsRoot, name), { recursive: true, force: true });
    }
  }

  for (const group of Object.keys(plan)) {
    const pluginDir = path.join(pluginsRoot, pluginName(group));
    fs.mkdirSync(path.join(pluginDir, '.claude-plugin'), { recursive: true });
    fs.writeFileSync(
      path.join(pluginDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify(pluginJson(group), null, 2) + '\n'
    );
    for (const asset of plan[group]) placeAsset(root, pluginDir, asset, copy);
  }

  // harness-mcp: standalone plugin carrying .mcp.json (no workload split).
  if (mcpExists(root)) {
    const mcpDir = path.join(pluginsRoot, pluginName(MCP_GROUP));
    fs.mkdirSync(path.join(mcpDir, '.claude-plugin'), { recursive: true });
    fs.writeFileSync(
      path.join(mcpDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify(pluginJson(MCP_GROUP), null, 2) + '\n'
    );
    fs.writeFileSync(
      path.join(mcpDir, '.mcp.json'),
      JSON.stringify(mcpJson(root), null, 2) + '\n'
    );
  }

  const mpDir = path.join(root, '.claude-plugin');
  fs.mkdirSync(mpDir, { recursive: true });
  fs.writeFileSync(
    path.join(mpDir, 'marketplace.json'),
    JSON.stringify(marketplaceJson(plan, root), null, 2) + '\n'
  );
}

/**
 * Check committed output against a fresh plan. Catches "added/edited an asset
 * but forgot to regenerate" drift. Symlinked skills can't drift (they point at
 * live sources); copied agents/commands can, so we compare their content.
 * Returns an array of human-readable problems (empty = clean).
 */
function check(root, plan) {
  const problems = [];
  const pluginsRoot = path.join(root, PLUGINS_DIR);

  // marketplace.json matches.
  const mpPath = path.join(root, '.claude-plugin', 'marketplace.json');
  const expectedMp = JSON.stringify(marketplaceJson(plan, root), null, 2) + '\n';
  if (!fs.existsSync(mpPath) || fs.readFileSync(mpPath, 'utf8') !== expectedMp) {
    problems.push('.claude-plugin/marketplace.json is missing or stale');
  }

  // Expected plugin set vs on-disk (harness-mcp included when its source exists).
  const expectedPlugins = new Set(Object.keys(plan).map(pluginName));
  if (mcpExists(root)) expectedPlugins.add(pluginName(MCP_GROUP));
  const onDisk = fs.existsSync(pluginsRoot)
    ? fs.readdirSync(pluginsRoot).filter(n => fs.statSync(path.join(pluginsRoot, n)).isDirectory())
    : [];
  for (const extra of onDisk) {
    if (!expectedPlugins.has(extra)) problems.push(`stale plugin dir: ${PLUGINS_DIR}/${extra}`);
  }

  // harness-mcp plugin.json + .mcp.json content.
  if (mcpExists(root)) {
    const mcpDir = path.join(pluginsRoot, pluginName(MCP_GROUP));
    const pjPath = path.join(mcpDir, '.claude-plugin', 'plugin.json');
    const expectedPj = JSON.stringify(pluginJson(MCP_GROUP), null, 2) + '\n';
    if (!fs.existsSync(pjPath) || fs.readFileSync(pjPath, 'utf8') !== expectedPj) {
      problems.push(`${pluginName(MCP_GROUP)}: plugin.json missing or stale`);
    }
    const mcpPath = path.join(mcpDir, '.mcp.json');
    const expectedMcp = JSON.stringify(mcpJson(root), null, 2) + '\n';
    if (!fs.existsSync(mcpPath) || fs.readFileSync(mcpPath, 'utf8') !== expectedMcp) {
      problems.push(`${pluginName(MCP_GROUP)}: .mcp.json missing or stale (source changed)`);
    }
  }

  for (const group of Object.keys(plan)) {
    const pluginDir = path.join(pluginsRoot, pluginName(group));
    const pjPath = path.join(pluginDir, '.claude-plugin', 'plugin.json');
    const expectedPj = JSON.stringify(pluginJson(group), null, 2) + '\n';
    if (!fs.existsSync(pjPath) || fs.readFileSync(pjPath, 'utf8') !== expectedPj) {
      problems.push(`${pluginName(group)}: plugin.json missing or stale`);
    }
    for (const asset of plan[group]) {
      const linkPath = path.join(pluginDir, asset.linkRel);
      if (!fs.existsSync(linkPath)) {
        problems.push(`${pluginName(group)}: missing ${asset.linkRel} (run build-marketplace)`);
        continue;
      }
      // Copied files (agents/commands) can drift from source; compare content.
      // Skills are symlinked dirs — fs.existsSync already followed the link.
      if (asset.kind !== 'skill' && !fs.lstatSync(linkPath).isSymbolicLink()) {
        const src = fs.readFileSync(path.resolve(root, asset.sourceRel), 'utf8');
        if (fs.readFileSync(linkPath, 'utf8') !== src) {
          problems.push(`${pluginName(group)}: ${asset.linkRel} is stale (source changed)`);
        }
      }
    }
  }
  return problems;
}

function main(argv) {
  const flags = parseArgs(argv);
  if (flags.help) {
    console.log('build-marketplace.js — generate .claude-plugin/marketplace.json + plugins/harness-*');
    console.log('  --copy    real files instead of symlinks');
    console.log('  --check   verify committed output is current (exit 1 on drift)');
    console.log('  --root    repo root');
    return 0;
  }
  const root = flags.root || path.resolve(__dirname, '..', '..');
  const plan = buildPlan(root);

  if (flags.check) {
    const problems = check(root, plan);
    if (problems.length) {
      console.error('[build-marketplace] drift detected:');
      for (const p of problems) console.error(`  - ${p}`);
      console.error('\nRun: node scripts/install/build-marketplace.js');
      return 1;
    }
    console.log(`[build-marketplace] up to date (${Object.keys(plan).length} plugins)`);
    return 0;
  }

  generate(root, plan, flags.copy);
  const total = Object.values(plan).reduce((n, a) => n + a.length, 0);
  const mode = flags.copy ? 'all copied' : 'skills symlinked, agents/commands copied';
  const count = Object.keys(plan).length + (mcpExists(root) ? 1 : 0);
  console.log(`[build-marketplace] ${count} plugins, ${total} assets (${mode})`);
  for (const g of Object.keys(plan).sort()) {
    console.log(`  ${pluginName(g)}  (${plan[g].length})`);
  }
  if (mcpExists(root)) {
    console.log(`  ${pluginName(MCP_GROUP)}  (.mcp.json)`);
  }
  return 0;
}

if (require.main === module) {
  try {
    process.exit(main(process.argv));
  } catch (e) {
    process.stderr.write(`[build-marketplace] ${e.message}\n`);
    process.exit(1);
  }
}

module.exports = { buildPlan, marketplaceJson, pluginJson, pluginName, mcpJson, mcpExists, generate, check };
