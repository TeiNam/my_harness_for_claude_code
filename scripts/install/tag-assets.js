#!/usr/bin/env node
'use strict';

/**
 * tag-assets.js — Add `workloads:` lines to asset frontmatter using the
 * heuristics in workloads.js.
 *
 * The key is `workloads:` (not `tags:`) so the install-time classifier never
 * collides with author-defined free-form tags like
 * `tags: [motion, animation, accessibility]`.
 *
 * Scope: agents/*.md, commands/*.md, skills/<dir>/SKILL.md, rules/**\/*.md.
 * (Run from repo root.)
 *
 * Default behaviour is `--dry-run`. Pass `--apply` to actually edit files.
 *
 *   node scripts/install/tag-assets.js                   # preview only
 *   node scripts/install/tag-assets.js --apply           # write changes
 *   node scripts/install/tag-assets.js --apply --force   # overwrite existing values
 *
 * Without --force, files that already declare `workloads:` in their
 * frontmatter are skipped — the auto-pass only fills gaps. Use --force after
 * reviewing the heuristic if you want to regenerate every file.
 *
 * Output is a per-asset table and a summary count. Files without frontmatter
 * blocks are reported but not modified.
 */

const fs = require('fs');
const path = require('path');

const {
  classify,
  identifierOf,
  GROUPS,
} = require('./workloads');

const ROOT = path.resolve(__dirname, '..', '..');

function parseArgs(argv) {
  const args = argv.slice(2);
  const flags = {
    apply: false,
    force: false,
    only: null, // restrict to specific kinds: agent,command,skill,rule
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--apply') flags.apply = true;
    else if (a === '--dry-run') flags.apply = false;
    else if (a === '--force') flags.force = true;
    else if (a.startsWith('--only=')) flags.only = a.slice('--only='.length).split(',').filter(Boolean);
    else if (a === '-h' || a === '--help') flags.help = true;
    else throw new Error(`Unknown flag: ${a}`);
  }
  return flags;
}

function listAgents() {
  const dir = path.join(ROOT, 'agents');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => ({
      kind: 'agent',
      identifier: identifierOf(f),
      path: path.join(dir, f),
      relativePath: path.posix.join('agents', f),
    }));
}

function listCommands() {
  const dir = path.join(ROOT, 'commands');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => ({
      kind: 'command',
      identifier: identifierOf(f),
      path: path.join(dir, f),
      relativePath: path.posix.join('commands', f),
    }));
}

function listSkills() {
  const dir = path.join(ROOT, 'skills');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(dir, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;
    out.push({
      kind: 'skill',
      identifier: entry.name,
      path: skillFile,
      relativePath: path.posix.join('skills', entry.name, 'SKILL.md'),
    });
  }
  return out;
}

function listRules() {
  const dir = path.join(ROOT, 'rules');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  function walk(currentDir, base) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const full = path.join(currentDir, entry.name);
      const rel = path.posix.join(base, entry.name);
      if (entry.isDirectory()) walk(full, rel);
      else if (entry.name.endsWith('.md')) {
        out.push({
          kind: 'rule',
          identifier: identifierOf(entry.name),
          path: full,
          relativePath: rel,
        });
      }
    }
  }
  walk(dir, 'rules');
  return out;
}

/**
 * Locate the frontmatter block at the top of a markdown file.
 * Returns { startLine, endLine, body } or null when there is no leading `---`
 * fenced block. Line numbers are 0-indexed and inclusive of the fences.
 */
function findFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') return null;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      return { startLine: 0, endLine: i, body: lines.slice(1, i) };
    }
  }
  return null;
}

const WORKLOADS_KEY = 'workloads';
const WORKLOADS_KEY_RE = new RegExp(`^${WORKLOADS_KEY}\\s*:`);

/**
 * Detect whether a frontmatter body already has a top-level `workloads:` key.
 * We treat the inline form (`workloads: [a, b]`) and block form
 * (`workloads:\n  - a`) the same — both are "already classified" for this
 * auto-pass.
 */
function hasWorkloadsKey(bodyLines) {
  for (const line of bodyLines) {
    if (WORKLOADS_KEY_RE.test(line)) return true;
  }
  return false;
}

function formatWorkloadsLine(groups) {
  // Inline form keeps frontmatter compact and matches existing style
  // (e.g. agents use `tools: ["Read", "Grep"]`).
  return `${WORKLOADS_KEY}: [${groups.join(', ')}]`;
}

/**
 * Insert / replace the `workloads:` line in the frontmatter block.
 * Returns the new file content (or null if no change is needed).
 */
function applyWorkloads(text, groups, { force }) {
  const fm = findFrontmatter(text);
  if (!fm) return { changed: false, reason: 'no-frontmatter', text };

  const lines = text.split(/\r?\n/);
  const existingIdx = fm.body.findIndex(line => WORKLOADS_KEY_RE.test(line));

  if (existingIdx !== -1 && !force) {
    return { changed: false, reason: 'has-workloads', text };
  }

  const newLine = formatWorkloadsLine(groups);

  if (existingIdx !== -1 && force) {
    // Replace just the `workloads:` line. None of our assets use a
    // multi-line block-scalar value for this key today; if one ever appears,
    // the validator (or this run's diff) will surface it.
    const lineNoInFile = fm.startLine + 1 + existingIdx;
    if (lines[lineNoInFile] === newLine) {
      return { changed: false, reason: 'noop', text };
    }
    lines[lineNoInFile] = newLine;
    return { changed: true, reason: 'replaced', text: lines.join('\n') };
  }

  // Insert just before the closing `---` so it lands at the bottom of the
  // frontmatter. This avoids reflowing existing keys that authors care about
  // (name, description, tools).
  lines.splice(fm.endLine, 0, newLine);
  return { changed: true, reason: 'added', text: lines.join('\n') };
}

function main(argv) {
  const flags = parseArgs(argv);
  if (flags.help) {
    console.log(
      [
        'tag-assets.js — Add `workloads:` to asset frontmatter (heuristic).',
        '',
        'Flags:',
        '  --apply           Write changes (default is dry-run)',
        '  --force           Overwrite existing `workloads:` lines',
        '  --only=KIND[,..]  Limit to: agent,command,skill,rule',
        '  -h, --help        Show this help',
        '',
        `Workload groups: ${GROUPS.join(', ')}`,
      ].join('\n')
    );
    return 0;
  }

  let assets = [...listAgents(), ...listCommands(), ...listSkills(), ...listRules()];
  if (flags.only) {
    const set = new Set(flags.only);
    assets = assets.filter(a => set.has(a.kind));
  }

  const summary = { added: 0, replaced: 0, skipped: 0, noop: 0, missingFm: 0 };
  const rows = [];

  for (const asset of assets) {
    const groups = classify(asset);
    const text = fs.readFileSync(asset.path, 'utf8');
    const result = applyWorkloads(text, groups, { force: flags.force });

    rows.push({
      file: asset.relativePath,
      kind: asset.kind,
      groups: groups.join(','),
      action: result.reason,
    });

    if (result.reason === 'added') summary.added++;
    else if (result.reason === 'replaced') summary.replaced++;
    else if (result.reason === 'has-workloads') summary.skipped++;
    else if (result.reason === 'noop') summary.noop++;
    else if (result.reason === 'no-frontmatter') summary.missingFm++;

    if (result.changed && flags.apply) {
      fs.writeFileSync(asset.path, result.text, 'utf8');
    }
  }

  // Print a compact table
  const colKind = Math.max(...rows.map(r => r.kind.length), 4);
  const colGroups = Math.max(...rows.map(r => r.groups.length), 6);
  const header =
    'action'.padEnd(10) + 'kind'.padEnd(colKind + 2) +
    'groups'.padEnd(colGroups + 2) + 'file';
  console.log(header);
  console.log('-'.repeat(header.length));
  for (const r of rows) {
    console.log(
      r.action.padEnd(10) +
      r.kind.padEnd(colKind + 2) +
      r.groups.padEnd(colGroups + 2) +
      r.file
    );
  }

  console.log('\nSummary:');
  console.log(`  added:        ${summary.added}`);
  console.log(`  replaced:     ${summary.replaced}`);
  console.log(`  skipped:      ${summary.skipped}  (already had workloads; pass --force to overwrite)`);
  console.log(`  noop:         ${summary.noop}    (file already matched)`);
  console.log(`  missing-fm:   ${summary.missingFm} (no frontmatter; not classified)`);
  console.log(`  total:        ${rows.length}`);
  if (!flags.apply) {
    console.log('\n[dry-run] no files modified. Re-run with --apply to write changes.');
  }
  return 0;
}

if (require.main === module) {
  try {
    process.exit(main(process.argv));
  } catch (e) {
    console.error(`[tag-assets] ${e.message}`);
    process.exit(1);
  }
}

module.exports = {
  parseArgs,
  findFrontmatter,
  hasWorkloadsKey,
  applyWorkloads,
  WORKLOADS_KEY,
};
