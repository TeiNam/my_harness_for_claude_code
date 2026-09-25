# Model Routing Policy

Authoritative policy for which Claude model each task and agent runs on. This
is the single source of truth; `performance.md`, `commands/model-route.md`, and
the agent frontmatter all defer to it.

## Current Lineup (2026-09, Opus 5.5 / Fable 5.1)

| Alias | Resolves to | Character |
|-------|-------------|-----------|
| `fable` | **Fable 5.1** | Mythos-class tier above Opus (Mythos 5.1 is the same model without dual-use safety measures, Glasswing participants only). $10/$50 per MTok — **~2.5× Opus per token** — but cache reads are $0.25 (0.025×), nearly Opus's $0.20, so in a cache-heavy Claude Code session the premium is mostly the 2.5× on output. Thinking always on, default effort `high`. **Not a default assignment for any agent** — it's the last *up* rung: the final judge on an unrecoverable-miss gate after `opus` at `xhigh`/`max` still missed. When the session itself runs Fable, `fork` is the cheapest Fable access (inherits model, shares prompt cache). Requires Claude Code ≥ v2.1.257. |
| `opus` | **Opus 5.5** | Workhorse deep-reasoning tier: architecture, ambiguity, adversarial review, hard debugging, long-horizon autonomous runs, high-stakes judging. $4/$20 (cheaper than Opus 5's $5/$25), cache reads $0.20 (0.05×). **Default effort is `medium`** — per the docs, Opus 5.5 at `medium` matches or beats Opus 5 at `high`, and at a given level it thinks more per turn than Opus 5. Thinking cannot be disabled. Escalate *within* the tier via effort (`high` → `xhigh` → `max`) before reaching for `fable`. |
| `sonnet` | **Sonnet 5** | Best coding model. Default for implementation, refactors, PR review. Handles ~90% of coding. $2/$10 (the launch price is now standard). *Provider-dependent — see below.* |
| `haiku` | **Haiku 4.5** | ~90% of Sonnet's capability at ~2× cost savings vs Sonnet 5 ($1/$5). Mechanical edits, search, doc scaffolding, high-frequency workers. No `effort` parameter. |

> **Use aliases, never version IDs.** Agent frontmatter must say `model: sonnet`,
> not `model: claude-sonnet-5`. Aliases auto-resolve to the current lineup, so
> the harness follows model upgrades without a mass re-tag. The one place a
> pinned ID belongs is application code calling the API (see `skills/claude-api`).

### Provider caveat — aliases resolve per provider

The table above is the Anthropic API resolution. On **Amazon Bedrock / Google
Agent Platform** `opus`→Opus 5.5 and `fable`→Fable 5.1, but `sonnet`→**Sonnet 4.5**
and `haiku` is unspecified unless you pin them with `ANTHROPIC_DEFAULT_SONNET_MODEL`
/ `ANTHROPIC_DEFAULT_HAIKU_MODEL`. The owner runs on Bedrock: measured 2026-09-25,
default `sonnet` answered as `claude-sonnet-4-5`; with
`ANTHROPIC_DEFAULT_SONNET_MODEL=global.anthropic.claude-sonnet-5` it runs Sonnet 5.
Without the pin every `model: sonnet` agent silently runs the previous generation.

Effort settings (Claude Code):

- A top-level `effortLevel` in user settings **does not apply to Opus 5.5**. Save
  its level with `/effort` or `modelSettings["claude-opus-5-5"].effortLevel`.
- `max` isn't accepted in either settings key — it's per session only.
- Don't set `CLAUDE_CODE_EFFORT_LEVEL`: the env var overrides subagent `effort:`
  frontmatter, which flattens the fleet's per-agent tiers.

### Switching models mid-session

Thinking blocks are bound to the model that produced them. **Opus 5.5 → Fable 5.1
keeps** the reasoning; **Fable → Opus** (or any other switch) drops it, and every
switch starts a fresh prompt cache. Rule: escalating *up* mid-session is fine; to
come *down*, start a fresh session. A per-call `model: "fable"` Agent invocation
is its own conversation, so it's unaffected.

### Refusals and fallback

Opus 5.5 and Fable 5.1 run safety classifiers; a decline returns HTTP 200 with
`stop_reason: "refusal"` and a `stop_details` category. In API code, opt in to
server-side fallback (`fallbacks: "default"`, beta) — see `skills/claude-api`.

- **Opus 5.5 categories:** biology (new vs Opus 5), cybersecurity, and
  `reasoning_extraction`. `reasoning_extraction` declines are **not** retried by
  server-side fallback — don't write prompts that ask the model to reproduce its
  reasoning in the response; read summarized thinking instead.
- **Fable 5.1 fallback targets:** Opus 4.8 and Opus 5.

Behavioral deltas that affect agent prompts:

- **Opus 5.5** — default effort `medium` (set it explicitly). In unattended
  loops it can end a turn with a text-only progress report (`end_turn`) while
  work is still owed: keep a checklist and allow at most 2–3 automatic
  continuations. Remove "think carefully before answering" lines — effort is the
  control. Sharper reading of charts/screenshots; re-test vision workarounds.
- **Fable 5.1** — more variable parallel tool calling (may issue one call per
  turn), fewer progress updates, less bold/headers/lists in chat, denser prose,
  answers from memory more often at `low` effort, and a tendency to rewrite whole
  files for small edits. The batching and targeted-Edit instructions live in
  `rules/common/coding-style.md`.
- Both: eager subagent delegation carries over — in orchestrator prompts state
  when NOT to spawn.

## Task → Model

| Task | Model | Why |
|------|-------|-----|
| Exploration / file search | `haiku` | Fast, cheap, enough to locate code |
| Single-file / mechanical edits | `haiku` | Clear instructions, low blast radius |
| Doc scaffolding / codemaps | `haiku` | Structure is simple |
| Multi-file implementation | `sonnet` | Best coding/latency balance |
| Refactors | `sonnet` | Holds moderate context, reliable diffs |
| PR / code review | `sonnet` | Catches nuance in context |
| Implementing a fix whose cause + remedy are already known | `sonnet` | Nothing left to reason about — just apply it |
| Scanning input against a supplied rubric / taxonomy | `sonnet` | Lookup against given criteria, not open judgment |
| Rewriting / polishing spans already flagged by a detector | `sonnet` | The what-to-fix decision is upstream |
| Complex architecture | `opus` | Needs deep reasoning |
| Diagnosing a cause that is *not* yet known | `opus` | Open search space; wrong guess costs a whole cycle |
| Security analysis | `opus` | Can't afford a missed vuln |
| Ambiguous / underspecified work | `opus` | Reasoning about intent |
| Debugging system-wide bugs | `opus` | Must hold the whole system in mind |
| Overnight / long-horizon autonomous runs | `opus` at `xhigh` | Deepest reasoning available; raise effort, not tier |
| Final adversarial verify on high-stakes output | `opus` at `xhigh`/`max` | Deep judge when a miss is expensive |
| Unrecoverable-miss gate where `opus@max` already missed | `fable` | The one rung above Opus — pay ~2.5× for the single judging call, not the pipeline |
| Independent cross-family second opinion | **Codex** | Different model family — catches what re-prompting Claude cannot (see below) |

**Default to Sonnet 5.** Escalate to Opus 5.5 when: the first Sonnet attempt
failed, the task spans 5+ files, it's an architectural decision, or it's
security-critical. Past Opus, the ladder is: raise **effort**
(`high` → `xhigh` → `max`) first, then **`fable`** for the single final-judge
call where a miss is unrecoverable, then a **cross-family** opinion from Codex.
Fable costs ~2.5× Opus per token, so it buys one judging call, never a whole pipeline —
effort-on-Opus remains the default deepening move. Drop to Haiku 4.5 for
anything deterministic and low-risk.

## Agent Class → Model

### The deciding question: is the box open or closed?

Reasoning depth only pays when the *shape of the answer* is undecided. If the
criteria, the diagnosis, or the fix is already given and the agent's job is to
execute against it, Opus burns thinking tokens on a problem that has no search
space left. That's the single most common waste in the fleet.

**Closed box → `sonnet`.** The rubric/taxonomy/spec is supplied, the cause is
known, the output format is fixed:

- Scan input against a supplied checklist or taxonomy → structured report
- Rewrite/polish spans a detection report already flagged
- Implement a fix whose cause and remedy are already established
- Build/type-error repair, codemods, mechanical integration, PR/CHANGELOG drafting
- Write to a given outline in a given voice

**Open box → `opus`.** The answer's shape is genuinely undetermined, or a miss
is expensive and unrecoverable:

- Design decisions: what should exist, how it should be structured (`architect`, `planner`, `code-architect`)
- Diagnosis when the cause is *not* yet known (system-wide debugging, stuck loops)
- Judging whether meaning/fact survived a transformation — an open-ended
  equivalence call over arbitrary content (`tech-fidelity-auditor`; `humanize-finalizer` in the im-not-ai plugin)
- Finding what the taxonomy *doesn't* cover yet (`doc-clarity-reviewer`,
  taxonomist/gap-analyzer agents)
- Security review, adversarial review, ambiguous requirements
- Multi-source synthesis with no fixed answer shape (`deep-researcher`)

**`haiku`** — mechanical, high-frequency: `doc-updater`, `docs-lookup`, and any
future search/scaffold worker.

### Two traps

1. **"It's an important pipeline, so `opus` everywhere."** Importance is not
   reasoning depth. A detector reading a 40-pattern taxonomy is doing lookup, not
   reasoning — `sonnet`. Uniform-`opus` pipelines are how a 5-stage flow costs 5×
   what it needs to.
2. **"It's just a fix, so `sonnet`."** True only once the cause is *established*.
   Finding the cause is open-box work; applying the known fix is closed-box.
   Split the stages rather than tiering the whole thing up.

When the two axes disagree — closed box but an expensive miss — the miss wins.
Pick by *worst-case* cost of a wrong answer, not the average. A reviewer that
gates a merge is `opus` even if most reviews are easy.

**`fable` is not a standing assignment.** Fleet frontmatter stays within
`haiku`/`sonnet`/`opus`. Reach Fable per call — a `model: "fable"` override on
one Agent invocation, or a `fork` when the session already runs Fable — and
retag an individual judge agent only after an `opus@xhigh/max` miss is actually
observed on its gate, not preemptively.

## Multi-Agent Orchestration

**Where orchestration runs** (see CLAUDE.md → Orca Integration): in **Orca
`orchestration`**, always. Orca owns the worktrees, terminals, and blocking
waits, and two coordinators over one work set is the failure mode to avoid. The
`Workflow` tool is off globally (`~/.claude/settings.json`:
`enableWorkflows: false`, `ultracode: false`) — if in-context fan-out is ever
needed outside Orca, flip that key instead of reviving an environment branch.
The tiering rules below apply to whatever does the spawning.

**A single subagent call is not orchestration.** Default to `fork`
(`subagent_type: "fork"` / `/subtask`): it inherits the parent's system prompt,
tools, model, and history, so the harness comes along for free and the prompt
cache is shared. Use a cold agent from `agents/` only when you want a *different*
tier or a narrower tool set — and then declare what it needs in `skills:`
frontmatter, because a cold agent inherits CLAUDE.md and `rules/` but not skill
bodies.

- Orchestrate on `sonnet` (or `opus` if the plan itself is the hard part) —
  subagents inherit the session model unless overridden.
- Fan-out workers on the cheapest model sufficient for their leaf task —
  usually `haiku` for search/extract, `sonnet` for edits.
- Adversarial verify / judge stages on `opus` — that's where reasoning depth
  pays for itself. Where a missed defect is very expensive (security gate,
  production migration), run `opus` at `xhigh`/`max` **and** add a Codex axis;
  two model families disagreeing is a stronger signal than one model retried.
- **Tier per stage, not per pipeline.** A detect → fix → judge flow is
  `sonnet` → `sonnet` → `opus`, not `opus` × 3. Tiering the whole pipeline to its
  hardest stage is the default failure mode; the closed/open box test above is
  applied stage by stage.
- Opus 5.x and Fable delegate to subagents eagerly — in orchestrator prompts,
  state explicitly when NOT to spawn (single-file reads, sequential steps).
- Effort routing inside a tier is cheaper than jumping tiers: `low` for
  mechanical workers, `high` for open-box judges, `xhigh`/`max` only for the
  hardest verify/judge stages where a quality gain has been measured (docs:
  *"Reserve xhigh and max for work where you've measured a quality gain"*).
  Level names are model-relative — Opus 5.5 `medium` ≈ Opus 5 `high`.

## Fast Mode

`/fast` (Opus 5.5; Opus 5 / 4.8 as legacy) keeps Opus reasoning with faster
output at premium price (Opus 5.5: $8/$40). Prefer it over downgrading to Sonnet
when you need Opus-level judgment but want lower latency — it does **not** swap
in a smaller model. Fast mode is **Claude API only** (not Bedrock, Claude Platform
on AWS, Google Cloud, or Foundry) — the owner runs on Bedrock, so `/fast` is not
available in this environment.

## Cross-Model: Codex

Up-escalation ends at Fable 5.1; past it the remaining axis is **sideways**: a
different model family. Sideways is also the *right* move — regardless of tier —
whenever the value is independence rather than depth, because a higher Claude
still shares Claude's blind spots. Route to the OpenAI Codex CLI via the codex
plugin (`codex:rescue` skill / `codex:codex-rescue` agent — install per
`docs/plugin.md`). Treat its output as a proposal to verify, never as ground truth.

### When to hand a subagent to Codex

Codex earns the handoff where **independence** or **grind** is the value, not
where harness-specific context is. Delegate to Codex when:

| Situation | Why Codex over another Claude subagent |
|-----------|----------------------------------------|
| Adversarial review of Claude-authored code | Claude reviewing Claude shares blind spots — same training, same failure modes. A second family is the only way to break correlation |
| Tie-break after two Claude attempts disagree | A third Claude opinion correlates with the first two; Codex doesn't |
| Large mechanical edits (rename across N files, codemod) | Offloads grind without spending Opus context; verify the diff after |
| Second diagnosis when Claude is stuck in a loop | Fresh framing beats re-prompting the model that got stuck |

Keep on a Claude subagent when the task needs harness context (rules, skills,
workload tags, project conventions), tool orchestration, or Korean-language
output — Codex starts cold on all of it.

**The rule that makes this pay off:** never let Codex be the *only* reader of
something that matters. Its value is as a disagreeing second voice; a finding
only Codex reports still needs Claude to confirm against the actual code, and
findings both families flag independently are the high-confidence ones.

**Review model: CLI default.** 2-way cross review (`/cross-review`) does not pin
the Codex axis — `codex exec` runs without `--model`, so the local CLI's
configured default applies. Name the actual model in the report. Change the
default in the Codex CLI config, not in the command.
