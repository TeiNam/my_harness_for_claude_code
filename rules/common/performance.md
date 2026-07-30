# Performance Optimization

## Model Selection Strategy

> Full policy — task tables, agent-class map, orchestration, Codex — lives in
> [model-routing.md](./model-routing.md). Summary below.

**Haiku 4.5** (~90% of Sonnet capability, ~3x cost savings):
- Lightweight agents with frequent invocation
- Mechanical edits, search, doc scaffolding
- Worker agents in multi-agent systems

**Sonnet 5** (Best coding model — default for ~90% of coding):
- Main development work
- Orchestrating multi-agent workflows
- Multi-file implementation and refactors

**Opus 5** (Top tier — deepest reasoning available):
- Complex architectural decisions
- Security analysis and adversarial review
- Ambiguous requirements, system-wide debugging
- Long-horizon autonomous runs (overnight builds, large migrations) at `xhigh` effort
- Final adversarial judge on highest-stakes output at `xhigh`/`max`
- Fast mode (`/fast`) keeps Opus reasoning with faster output
- Falls back to Opus 4.8 on safety-classifier refusals, web-fetch needs, or Priority Tier capacity

**Codex** (cross-family, not a Claude tier):
- Independent adversarial review — breaks the correlated blind spots of Claude reviewing Claude
- Tie-break when two Claude attempts disagree
- Large mechanical edits you want offloaded from Opus context

## Context Window Management

Avoid last 20% of context window for:
- Large-scale refactoring
- Feature implementation spanning multiple files
- Debugging complex interactions

Lower context sensitivity tasks:
- Single-file edits
- Independent utility creation
- Documentation updates
- Simple bug fixes

## Extended Thinking + Plan Mode

Extended thinking is enabled by default, reserving up to 31,999 tokens for internal reasoning.

Control extended thinking via:
- **Toggle**: Option+T (macOS) / Alt+T (Windows/Linux)
- **Config**: Set `alwaysThinkingEnabled` in `~/.claude/settings.json`
- **Budget cap**: `export MAX_THINKING_TOKENS=10000`
- **Verbose mode**: Ctrl+O to see thinking output

For complex tasks requiring deep reasoning:
1. Ensure extended thinking is enabled (on by default)
2. Enable **Plan Mode** for structured approach
3. Use multiple critique rounds for thorough analysis
4. Use split role sub-agents for diverse perspectives

## Build Troubleshooting

If build fails:
1. Use **build-error-resolver** agent
2. Analyze error messages
3. Fix incrementally
4. Verify after each fix
