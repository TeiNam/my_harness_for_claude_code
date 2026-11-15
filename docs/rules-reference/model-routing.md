# Model Routing Policy

Authoritative policy for which Claude model each task and agent runs on. This
is the single source of truth; `performance.md`, `commands/model-route.md`, and
the agent frontmatter all defer to it.

## Current Lineup (2026-11, Fable 5.2 / Opus 5.5 / Sonnet 5.5 / Haiku 5.5)

| Alias | Resolves to | Character |
|-------|-------------|-----------|
| `fable` | **Fable 5.2** | The tier above Opus, for demanding reasoning and long-horizon agentic work (Mythos 5.2 is the same model for verified organizations). $8/$40 per MTok — **2× Opus per token** (Fable 5.1 was $10/$50) — and cache reads are $0.20 (0.025×), the same as Opus, so in a cache-heavy Claude Code session the premium is almost entirely the 2× on output. Thinking always on, default effort `high`, latency class "moderate" like Opus. **Three roles** (see "Fable 5.2 roles" below): solo solver of problems Opus could not solve, orchestrator that plans, delegates and judges, and one-call final judge. **Never a frontmatter assignment** — reach it by session (`/model fable`), per call, or `fork`. Operating rules: the `fable-mode` skill. |
| `opus` | **Opus 5.5** | Workhorse deep-reasoning tier: architecture, ambiguity, adversarial review, hard debugging, long-horizon autonomous runs, high-stakes judging. $4/$20 (cheaper than Opus 5's $5/$25), cache reads $0.20 (0.05×). **Default effort is `medium`** — per the docs, Opus 5.5 at `medium` matches or beats Opus 5 at `high`, and at a given level it thinks more per turn than Opus 5. Thinking cannot be disabled. Escalate *within* the tier via effort (`high` → `xhigh` → `max`) before reaching for `fable`. |
| `sonnet` | **Sonnet 5.5** | Best coding model. Default for implementation, refactors, PR review. Handles ~90% of coding. $2/$10, cache reads $0.20 (0.1×) — same price as Sonnet 5. API default effort `high`; levels are recalibrated vs Sonnet 5. Released 2026-09-28; requires Claude Code ≥ v2.1.284. *Provider-dependent — see below.* |
| `haiku` | **Haiku 5.5** (pin required on Bedrock) | Mechanical edits, search, doc scaffolding, high-frequency workers. Successor to Haiku 4.5 (retirement "not sooner than 2026-10-15"). Price: $0.10/$0.50 per MTok for prompts up to 100k tokens, $0.50/$2.50 above — keep haiku subagent context under 100k (the new tokenizer counts ~30% more tokens than Haiku 4.5). Adaptive thinking with effort, default `medium`; `low` skips searches/checks and stops early in long agent prompts, so harness haiku agents pin `medium`. Measured 2026-11-03 with the skill evals: strong baseline judgment, but it rarely invokes skills on its own — put the trigger first in descriptions of skills that guard destructive or billing actions. |

> **Use aliases, never version IDs.** Agent frontmatter must say `model: sonnet`,
> not `model: claude-sonnet-5-5`. Aliases auto-resolve to the current lineup, so
> the harness follows model upgrades without a mass re-tag. The one place a
> pinned ID belongs is application code calling the API (see `skills/claude-api`).

### Current generation only

The harness uses **Opus 5.5, Sonnet 5.5, Haiku 5.5, and Fable 5.2 — nothing
earlier.** The lineup lives in one file, `scripts/lib/model-lineup.js`, and
`npm run optimize-settings` enforces it in `~/.claude/settings.json` two ways
(read-only check, exit 1 on drift; `-- --apply` writes):

1. **Alias pins** — `ANTHROPIC_DEFAULT_OPUS_MODEL`, `…_SONNET_MODEL`,
   `…_HAIKU_MODEL`, `…_FABLE_MODEL` name the current IDs (with the Bedrock
   `global.anthropic.` prefix when the settings say Bedrock), so an alias cannot
   resolve to another generation. All four env vars are honoured (measured
   2026-11-15: pinning `fable` to 5.1 and `opus` to Opus 5 changed what ran).
2. **`availableModels`** — the same four **full IDs**. A request for anything
   else, alias or explicit ID, runs on an allowed model instead. Measured
   2026-11-15: with the full-ID list, `--model global.anthropic.claude-opus-5`
   ran on Sonnet 5.5, while aliases and the `[1m]` context variant still worked;
   with an **alias** list (`["opus", …]`) Opus 5, Fable 5.1 and Haiku 4.5 all
   still ran — an alias entry allows the whole family, so the list must be IDs.

Consequences:

- **No fallback to an earlier generation.** A safety refusal stands; rephrase,
  or go sideways to Codex. (Server-side refusal fallback targets — Opus 4.8 and
  Opus 5 for Fable 5.2 — are an API feature for application code, and are not
  available on Bedrock anyway.)
- The default session model (`model` in settings) is the user's choice and is
  never rewritten; a legacy value there is reported.
- Moving to a new generation: edit `model-lineup.js`, run
  `npm run optimize-settings -- --apply`, then update this page.
- `scripts/hooks/cost-tracker.js` keeps earlier generations' prices only so old
  transcripts are costed correctly.

### Provider caveat — aliases resolve per provider

The table above is the Anthropic API resolution. On **Amazon Bedrock / Google
Agent Platform** `opus`→Opus 5.5 and `fable`→Fable 5.2 (measured 2026-11-15 on
Bedrock, Claude Code 2.1.325: `claude -p --model fable` reports
`global.anthropic.claude-fable-5-2`), but `sonnet`→**Sonnet 4.5**
and `haiku` is unspecified unless you pin them with `ANTHROPIC_DEFAULT_SONNET_MODEL`
/ `ANTHROPIC_DEFAULT_HAIKU_MODEL`. The owner runs on Bedrock: measured 2026-09-25,
default `sonnet` answered as `claude-sonnet-4-5`; measured 2026-10-06 with
`ANTHROPIC_DEFAULT_SONNET_MODEL=claude-sonnet-5-5`, `claude -p --model sonnet`
reports `modelUsage` key `claude-sonnet-5-5`. Without the pin every
`model: sonnet` agent silently runs an older generation. Verify after any
upgrade with `claude -p --model sonnet --output-format json "ok"` → `modelUsage`.
The same applies to `haiku`: until 2026-11-03 the owner's pin pointed at
`global.anthropic.claude-haiku-4-5-20251001-v1:0`. It is now
`ANTHROPIC_DEFAULT_HAIKU_MODEL=global.anthropic.claude-haiku-5-5`, and
`claude -p --model haiku --effort medium` reports `modelUsage` key
`global.anthropic.claude-haiku-5-5` (verified 2026-11-03).

Trade-off of pinning Sonnet 5.5 on Bedrock: its cybersecurity-flagged refusals
re-run on the `ANTHROPIC_DEFAULT_SONNET_MODEL` target — a pin naming Sonnet 5.5
itself leaves the refusal standing unless a Sonnet 5 entry is in the provider's
model list (and an Opus target must also resolve). Security review agents are
`opus` anyway, so this mostly hits `sonnet` agents reading exploit-adjacent code.

Effort settings (Claude Code):

- A top-level `effortLevel` in user settings **does not apply to Opus 5.5**. Save
  its level with `/effort` or `modelSettings["claude-opus-5-5"].effortLevel`.
- `max` isn't accepted in either settings key — it's per session only.
- Don't set `CLAUDE_CODE_EFFORT_LEVEL`: the env var overrides subagent `effort:`
  frontmatter, which flattens the fleet's per-agent tiers.

### Switching models mid-session

Thinking blocks are bound to the model that produced them, and every switch
starts a fresh prompt cache. **Only Fable 5.2 and Mythos 5.2 read Fable 5.2's
thinking blocks**, so leaving Fable for any other model (Opus 5.5 and Fable 5.1
included) drops its reasoning for the turns that follow. Moving *onto* Fable 5.2
keeps the earlier model's reasoning on the Claude API and Google-managed Google
Cloud; the docs do not promise that on Bedrock, so treat a switch there as a
cold start for reasoning. Rule: escalate *up* with a handoff summary (what was
tried, what failed and why), preferably in a fresh session; to come *down*,
always start a fresh session. A per-call `model: "fable"` Agent invocation is its
own conversation, so it's unaffected.

### Refusals and fallback

Opus 5.5 and Fable 5.2 run safety classifiers; a decline returns HTTP 200 with
`stop_reason: "refusal"` and a `stop_details` category. In this harness a refusal
stands (no earlier-generation fallback). Application code on the Claude API can
opt in to server-side fallback (`fallbacks: "default"`, beta) — see `skills/claude-api`.

- **Opus 5.5 categories:** biology (new vs Opus 5), cybersecurity, and
  `reasoning_extraction`. `reasoning_extraction` declines are **not** retried by
  server-side fallback — don't write prompts that ask the model to reproduce its
  reasoning in the response; read summarized thinking instead.
- **Fable 5.2:** categories `cyber`, `bio`, `frontier_llm`, `reasoning_extraction`,
  `general_harms`. The API's permitted fallback targets are Opus 4.8 and Opus 5
  (beta on the Claude API and Anthropic-managed Google Cloud — not Bedrock);
  **this harness does not use them** (Current generation only).

Behavioral deltas that affect agent prompts:

- **Opus 5.5** — default effort `medium` (set it explicitly). In unattended
  loops it can end a turn with a text-only progress report (`end_turn`) while
  work is still owed: keep a checklist and allow at most 2–3 automatic
  continuations. Remove "think carefully before answering" lines — effort is the
  control. Sharper reading of charts/screenshots; re-test vision workarounds.
- **Fable 5.2** (official "Prompting Claude Fable 5.2"; the working rules are in
  the `fable-mode` skill) — start at `high`: most of the gain is there, `xhigh`
  only where a gain was measured. A prompt line asking it to think less does not
  work at `medium` and above; lower the effort instead. It can end a turn with
  work still owed (more at `low`/`medium`), goes quiet during long tool runs,
  and follows instructions closely: a rule containing "never" is treated as
  absolute, hard style limits make its prose choppy, and stacked cautions from
  memory or notes make it ask for approvals it doesn't need — write scoped rules
  with their reason. It reads code ownership from the prompt: unowned or
  someone else's code gets additive changes, "you own this" gets consolidation
  plus unrequested changes. How much it delegates depends on the harness; this
  one invites delegation, so it delegates readily — and **a subagent with no
  model of its own inherits Fable** (see Multi-Agent Orchestration). Do not show
  it a token budget in prompts. The `coding-style.md` Tool Use lines were
  written for Fable 5.1 (whole-file rewrites, one tool call per turn); they are
  harmless on 5.2 and stay until measured otherwise.
- **Sonnet 5.5** — effort levels are recalibrated (don't carry Sonnet 5
  settings). Docs: `medium` for well-specified agentic coding, `high` for harder
  or longer tasks. The five closed-box coding executors pin `effort: medium`
  (rationale: `agents.md` → Frontmatter Conventions); other `sonnet` agents
  inherit the session. At `low`/`medium` it
  may **stop to check in** before a multipart task is done and, at `low`, report
  done without running a check; at every level it **adds unrequested tests/docs**;
  at `xhigh`/`max` it starts its own review rounds, sometimes with reviewer
  subagents. The `subagent:budget` brief counters all three (finish the task,
  no scope additions, leaf). Text between tool calls arrives as `thinking`
  blocks. Prefers its training knowledge over a search on "what's
  allowed/charged" questions — don't tell research agents to minimize tool calls.
- **Haiku 5.5** — first Haiku with effort (default `medium`). At `low` in long
  agent prompts it skips searches and checks and stops early; the two `haiku`
  agents pin `medium`. Give it today's date and an explicit "versions and
  'latest' may have changed — look them up" line when it searches (`docs-lookup`
  has one). Strong baseline judgment but rarely invokes skills unprompted —
  safety-critical skills lead their description with "Use before …". Treats
  user text inside `tool_result` as untrusted; omit `temperature`/`top_p`/`top_k`.
- Opus 5.5 / Fable 5.2: both delegate readily in this harness — orchestrator
  prompts state when NOT to spawn, and what a subagent costs.

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
| Overnight / long-horizon autonomous runs | `opus` at `xhigh` | Raise effort before tier; move the run to `fable` if Opus stalls or the miss is expensive |
| Final adversarial verify on high-stakes output | `opus` at `xhigh`/`max` | Deep judge when a miss is expensive |
| A hard or complex problem Opus could not solve (two failed attempts or a loop at raised effort) | `fable`, solo session | The tier above Opus: it works the core itself at `high`, with a handoff of what was tried |
| Planning and judging work that spans several tiers | `fable` as orchestrator | Fable's output goes to plan, briefs and verdicts; execution runs on `opus`/`sonnet`/`haiku` |
| Unrecoverable-miss gate where the Opus verdict is not trusted | `fable`, one call | Pay 2× for the single judging call, not the pipeline |
| Independent cross-family second opinion | **Codex** | Different model family — catches what re-prompting Claude cannot (see below) |

**Default to Sonnet 5.5.** Escalate to Opus 5.5 when: the first Sonnet attempt
failed, the task spans 5+ files, it's an architectural decision, or it's
security-critical. Past Opus, raise **effort** first (`high` → `xhigh`), then go
to **`fable`** when Opus still fails, then take a **cross-family** opinion from
Codex. Drop to Haiku 5.5 for anything deterministic and low-risk.

### Fable 5.2 roles

Fable is the model for what Opus cannot do, and the one that directs the others.
It is never the default worker: at 2× Opus per token its output is spent on
reasoning, plans and verdicts.

| Role | Enter when | How |
|------|-----------|-----|
| **Solo solver** | Opus failed twice or loops on the same hard problem at raised effort; or the work is demanding, long-horizon, and a miss is expensive | A Fable session (`/model fable`, ideally fresh, with a handoff). Fable works the core itself; it delegates only broad search and the fix once the cause is known |
| **Orchestrator** | The work splits into pieces that suit different tiers, or the plan and the final judgment are the hard part | The Fable main thread plans, briefs, and judges; pieces run on tiered agents with an explicit model, at most 3 at once. Past that, Orca `orchestration` with this session as coordinator |
| **Final judge** | One unrecoverable-miss gate (production migration, security sign-off, meaning-preservation verdict) | A single Agent call with `model: "fable"` from an Opus/Sonnet session, or a `fork` on a Fable session |

Which mode a Fable session uses is decided per task — solo when the pieces
depend on each other's reasoning, orchestration when each piece has a done
criterion you can write down, mixed when there is one hard core plus specified
execution. The decision table, the Fable 5.2 operating rules (effort, finishing
the whole task, approvals, code ownership, progress updates, reports), and the
delegation brief are in **`skills/fable-mode/`**, which a Fable session loads
before planning or delegating. Measured 2026-11-15 with `npm run eval:skills`
on Fable 5.2: the skill fired and passed 3/3 on the orchestration and solo
cases (0/3 without it); on Opus the escalation case passed 2/2 (0/2 without).

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
`haiku`/`sonnet`/`opus`: a tier in frontmatter runs on every call, and Fable is
chosen per problem. Reach it by session (`/model fable`), per call (a
`model: "fable"` override on one Agent invocation), or a `fork` when the
session already runs Fable.

## Multi-Agent Orchestration

**Where orchestration runs** (see CLAUDE.md → Orca Integration): there are two
layers. *In-session* — one main thread that plans, delegates to at most 3 leaf
subagents at a time, and judges — runs in Claude Code, led by Fable 5.2 when
the session is on Fable (`fable-mode` skill). *Across worktrees* — fan-out past
3, task DAGs, blocking waits — runs in **Orca `orchestration`**, always. Orca owns the worktrees, terminals, and blocking
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

- Orchestrate on `sonnet` (or `opus` if the plan itself is the hard part). When
  the session runs **Fable 5.2, Fable is the orchestrator**: it plans, writes
  the briefs, verifies what comes back, and makes the final call (Anthropic:
  early testers "had good results with Claude Fable 5.2 as the planner and
  orchestrator for other models").
- **Subagents inherit the session model unless one is set.** Measured
  2026-11-15 on a Fable session: `general-purpose` and the built-in `Explore`
  with no `model` both ran on Fable; an agent with `model:` frontmatter
  (`code-reviewer` → Sonnet) and a call with `model: "sonnet"`/`"haiku"` ran on
  that tier. A subagent that only answers "OK" cost about $0.40–0.50 on
  inherited Fable, $0.11 on Sonnet, and $0.005 as `Explore` + Haiku (mostly the
  system-prompt cache write). So on a Fable session every delegation names a
  tiered agent or passes `model`; `fork` (always inherits) is for pieces that
  need this conversation's context.
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
- Opus 5.x and Fable delegate to subagents readily in this harness — state
  explicitly when NOT to spawn (single-file reads, sequential steps, anything
  cheaper to do than to brief).
- Effort routing inside a tier is cheaper than jumping tiers: `low` for
  mechanical workers, `high` for open-box judges, `xhigh`/`max` only for the
  hardest verify/judge stages where a quality gain has been measured (docs:
  *"Reserve xhigh and max for work where you've measured a quality gain"*).
  Level names are model-relative — Opus 5.5 `medium` ≈ Opus 5 `high`.

## Fast Mode

`/fast` (Opus 5.5; Opus 5 / 4.8 as legacy; Fable 5.2 also has a fast mode at
$16/$80) keeps the same reasoning with faster output at premium price (Opus 5.5:
$8/$40). Prefer it over downgrading to Sonnet
when you need Opus-level judgment but want lower latency — it does **not** swap
in a smaller model. Fast mode is **Claude API only** (not Bedrock, Claude Platform
on AWS, Google Cloud, or Foundry) — the owner runs on Bedrock, so `/fast` is not
available in this environment.

## Cross-Model: Codex

Up-escalation ends at Fable 5.2; past it the remaining axis is **sideways**: a
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
