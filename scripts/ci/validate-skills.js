#!/usr/bin/env node
/**
 * Validate curated skill directories (skills/ in repo).
 *
 * Checks:
 *   1. Each sub-directory of skills/ contains a SKILL.md file.
 *   2. SKILL.md is non-empty.
 *   3. SKILL.md frontmatter (if present) declares a `name:` field.
 *   4. SKILL.md frontmatter `description:` uses an inline scalar — not a
 *      literal block scalar (`|` / `|-` / `|+`), which preserves internal
 *      newlines and breaks flat-table renderers keyed off `description`.
 *   5. Layout (Anthropic skill authoring guide, 2026-10 revision):
 *      - SKILL.md stays within MAX_SKILL_LINES (split details into files)
 *      - every other .md over TOC_THRESHOLD lines opens with a table of
 *        contents — Claude previews only the head of a long file
 *      - references are one level deep: a file SKILL.md links to must not
 *        be the only route to another file (SKILL.md links them directly)
 *      - every bundled .md (README.md aside) is linked from SKILL.md
 *
 * `--fix-toc` inserts a heading-derived "## Contents" block into every
 * file that check 5 flags for a missing table of contents.
 *
 * Frontmatter and layout findings default to WARN so CI does not break while
 * pre-existing data defects are being cleaned up out of band (see #1663).
 * Pass `--strict` or set `CI_STRICT_SKILLS=1` to promote frontmatter
 * findings to errors (exit 1).
 *
 * Structural findings (missing/empty SKILL.md) are always errors.
 *
 * Scope: curated only. Learned/imported/evolved roots are out of scope.
 * If skills/ does not exist, exit 0 (no curated skills to validate).
 */

const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.join(__dirname, '../../skills');

const STRICT = process.argv.includes('--strict') || process.env.CI_STRICT_SKILLS === '1';
const FIX_TOC = process.argv.includes('--fix-toc');

const MAX_SKILL_LINES = 500;
const TOC_THRESHOLD = 100;
// TOC 를 찾는 범위 — 제목·소개 문단 뒤에 와도 잡히도록 머리 40줄을 본다.
const TOC_SCAN_LINES = 40;
const SKIP_DIRS = new Set(['node_modules', '__pycache__']);
// `${CLAUDE_SKILL_DIR}/x.md`, `[x](x.md)`, `` `x.md` `` 형태의 상대 경로 참조.
const MD_REF = /(?:\]\(|[`\s(}]|^)((?:\.\/)?[\w./-]+\.md)(?=[)#`\s,.:;]|$)/gm;

function listMarkdown(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    if (SKIP_DIRS.has(e.name) || e.name.startsWith('.')) return [];
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return listMarkdown(full);
    return e.name.endsWith('.md') ? [full] : [];
  });
}

function hasToc(content) {
  const head = content.split(/\r?\n/).slice(0, TOC_SCAN_LINES).join('\n');
  return /^#{1,4}\s*(table of contents|contents|목차|toc)\b/im.test(head) || (head.match(/\]\(#[^)]+\)/g) || []).length >= 3;
}

/** Headings outside code fences: H2s, or H2+H3 when there are fewer than 3 H2s. */
function buildToc(content) {
  const headings = [];
  let inFence = false;
  for (const line of content.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const m = !inFence && line.match(/^(#{2,3})\s+(.+?)\s*#*\s*$/);
    if (m) headings.push({ level: m[1].length, text: m[2] });
  }
  const h2 = headings.filter(h => h.level === 2);
  const picked = h2.length >= 3 ? h2 : headings;
  if (picked.length < 2) return null;
  return ['## Contents', '', ...picked.map(h => `${h.level === 3 && h2.length ? '  ' : ''}- ${h.text}`), ''];
}

/** Insert the TOC after frontmatter and the H1 title (if any). */
function insertToc(content) {
  const toc = buildToc(content);
  if (!toc) return null;
  const lines = content.split('\n');
  let i = 0;
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1);
    if (end > 0) i = end + 1;
  }
  while (i < lines.length && lines[i].trim() === '') i++;
  if (/^#\s/.test(lines[i] || '')) {
    i++;
    while (i < lines.length && lines[i].trim() === '') i++;
  }
  return [...lines.slice(0, i), ...toc, ...lines.slice(i)].join('\n');
}

function mdRefs(content, fromDir, skillDir) {
  const out = new Set();
  for (const m of content.matchAll(MD_REF)) {
    const rel = m[1].replace(/^\.?\//, '');
    const hit = [path.resolve(fromDir, rel), path.resolve(skillDir, rel)].find(a => a.startsWith(skillDir + path.sep) && fs.existsSync(a));
    if (hit) out.add(path.relative(skillDir, hit));
  }
  return out;
}

function checkLayout(dir, skillsDir, skillContent, report) {
  const skillDir = path.resolve(skillsDir, dir);
  const skillLines = skillContent.split(/\r?\n/).length;
  if (skillLines > MAX_SKILL_LINES) {
    report(`${dir}/SKILL.md - ${skillLines} lines exceeds ${MAX_SKILL_LINES}; move detail into files linked from SKILL.md`);
  }
  const direct = mdRefs(skillContent, skillDir, skillDir);
  for (const file of listMarkdown(skillDir)) {
    const rel = path.relative(skillDir, file);
    if (rel === 'SKILL.md') continue;
    let content = fs.readFileSync(file, 'utf8');
    if (content.split(/\r?\n/).length > TOC_THRESHOLD && !hasToc(content)) {
      const fixed = FIX_TOC && insertToc(content);
      if (fixed) {
        fs.writeFileSync(file, fixed);
        content = fixed;
        console.log(`FIXED: ${dir}/${rel} - inserted table of contents`);
      } else {
        report(`${dir}/${rel} - over ${TOC_THRESHOLD} lines without a table of contents at the top`);
      }
    }
    if (!direct.has(rel)) {
      if (path.basename(rel).toLowerCase() !== 'readme.md') report(`${dir}/${rel} - not linked from SKILL.md`);
      continue;
    }
    for (const nested of mdRefs(content, path.dirname(file), skillDir)) {
      if (nested !== rel && nested !== 'SKILL.md' && !direct.has(nested)) {
        report(`${dir}/${rel} -> ${nested} - nested reference; link ${nested} from SKILL.md directly`);
      }
    }
  }
}

/**
 * Parse the leading YAML frontmatter of a markdown document.
 *
 * Returns `{ present, lines }` so callers can inspect raw lines
 * (needed to detect block-scalar `description:` values).
 *
 * Tolerant of UTF-8 BOM and CRLF line endings, matching the other
 * validators in this directory.
 *
 * @param {string} content
 * @returns {{present: boolean, lines: string[]}}
 */
function extractFrontmatter(content) {
  // Strip BOM if present (UTF-8 BOM: U+FEFF).
  const clean = content.replace(/^\uFEFF/, '');
  const match = clean.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return { present: false, lines: [] };
  return {
    present: true,
    lines: match[1].split(/\r?\n/)
  };
}

/**
 * Extract top-level keys (with trimmed values) and flag block-scalar
 * `description:` values.
 *
 * Lines that continue a block scalar (`|` or `>`) are skipped — we only
 * care about the top-level key set and the raw indicator on the
 * `description:` line. Block-scalar indicators accept YAML chomp and
 * indent modifiers and trailing comments, e.g. `|`, `|-`, `|+`, `|2`,
 * `|-2`, `>-  # note`.
 *
 * @param {string[]} lines
 * @returns {{values: Record<string,string>, descriptionIndicator: string|null}}
 */
function inspectFrontmatter(lines) {
  const values = Object.create(null);
  let descriptionIndicator = null;
  let inBlockScalar = false;
  let blockScalarIndent = -1;

  for (const rawLine of lines) {
    if (inBlockScalar) {
      // Stay inside the block until a line with indent <= the opener's
      // indent (or an empty continuation).
      const leadingSpaces = rawLine.match(/^(\s*)/)[1].length;
      if (rawLine.trim() === '' || leadingSpaces > blockScalarIndent) {
        continue;
      }
      inBlockScalar = false;
      blockScalarIndent = -1;
    }

    const match = rawLine.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;

    const key = match[1];
    const rawValue = match[2];
    // Strip unquoted comments for value/indicator inspection. Handles both
    // trailing comments (`foo: bar # note`) and comment-only values
    // (`foo: # todo`) so the latter is treated as empty.
    const valueNoComment = rawValue
      .replace(/^\s*#.*$/, '')
      .replace(/\s+#.*$/, '')
      .trim();
    values[key] = valueNoComment;

    // Detect literal / folded block-scalar indicators. Accept chomp
    // modifiers (`-` / `+`) and optional indent-indicator digits in
    // either order, per YAML 1.2.
    if (/^[|>](?:[+-]?\d+|\d+[+-]?|[+-])?$/.test(valueNoComment)) {
      if (key === 'description') {
        descriptionIndicator = valueNoComment;
      }
      inBlockScalar = true;
      blockScalarIndent = rawLine.match(/^(\s*)/)[1].length;
    }
  }

  return { values, descriptionIndicator };
}

/**
 * Validate a single skill directory.
 *
 * Returns `{ fatal }` where `fatal` indicates a structural error that
 * should be surfaced via `console.error` and abort CI (missing/empty
 * SKILL.md). Frontmatter findings are routed through
 * `reportFrontmatterFinding`, which owns the WARN/ERROR decision based
 * on strict mode.
 *
 * @param {string} dir
 * @param {string} skillsDir
 * @param {(msg: string) => void} reportFrontmatterFinding
 * @returns {{fatal: boolean}}
 */
function validateSkillDir(dir, skillsDir, reportFrontmatterFinding) {
  const skillMd = path.join(skillsDir, dir, 'SKILL.md');
  if (!fs.existsSync(skillMd)) {
    console.error(`ERROR: ${dir}/ - Missing SKILL.md`);
    return { fatal: true };
  }

  let content;
  try {
    content = fs.readFileSync(skillMd, 'utf-8');
  } catch (err) {
    console.error(`ERROR: ${dir}/SKILL.md - ${err.message}`);
    return { fatal: true };
  }
  if (content.trim().length === 0) {
    console.error(`ERROR: ${dir}/SKILL.md - Empty file`);
    return { fatal: true };
  }

  checkLayout(dir, skillsDir, content, reportFrontmatterFinding);

  const fm = extractFrontmatter(content);
  if (fm.present) {
    const { values, descriptionIndicator } = inspectFrontmatter(fm.lines);

    if (!Object.prototype.hasOwnProperty.call(values, 'name')) {
      reportFrontmatterFinding(`${dir}/SKILL.md - frontmatter missing required field: name`);
    } else if (values.name === '') {
      reportFrontmatterFinding(`${dir}/SKILL.md - frontmatter 'name' is empty`);
    }

    if (descriptionIndicator && descriptionIndicator.startsWith('|')) {
      reportFrontmatterFinding(
        `${dir}/SKILL.md - frontmatter description uses literal block scalar ` + `'${descriptionIndicator}' which preserves internal newlines; ` + `use an inline string or folded '>' scalar instead`
      );
    }
  }

  return { fatal: false };
}

function validateSkills() {
  if (!fs.existsSync(SKILLS_DIR)) {
    console.log('No curated skills directory (skills/), skipping');
    process.exit(0);
  }

  const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.')).map(e => e.name);

  let hasErrors = false;
  let warnCount = 0;
  let validCount = 0;

  const reportFrontmatterFinding = msg => {
    if (STRICT) {
      console.error(`ERROR: ${msg}`);
      hasErrors = true;
    } else {
      console.warn(`WARN: ${msg}`);
      warnCount++;
    }
  };

  for (const dir of dirs) {
    const { fatal } = validateSkillDir(dir, SKILLS_DIR, reportFrontmatterFinding);
    if (fatal) {
      hasErrors = true;
      continue;
    }
    validCount++;
  }

  if (hasErrors) {
    process.exit(1);
  }

  let msg = `Validated ${validCount} skill directories`;
  if (warnCount > 0) {
    msg += ` (${warnCount} warning${warnCount === 1 ? '' : 's'})`;
  }
  console.log(msg);
}

validateSkills();
