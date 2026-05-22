---
name: skill-health
description: Show skill portfolio health dashboard with charts and analytics
command: true
---

# Skill Health Dashboard

Shows a comprehensive health dashboard for all skills in the portfolio with success rate sparklines, failure pattern clustering, pending amendments, and version history.

## Implementation

Run the skill health CLI in dashboard mode:

```bash
HARNESS_ROOT="${CLAUDE_PLUGIN_ROOT:-$(node -e "var r=(()=>{var e=process.env.CLAUDE_PLUGIN_ROOT;if(e&&e.trim())return e.trim();var p=require('path'),f=require('fs'),h=require('os').homedir(),d=p.join(h,'.claude'),q=p.join('scripts','lib','utils.js');if(f.existsSync(p.join(d,q)))return d;for(var l of [p.join(d,'_harness'),p.join(d,'plugins','_harness')]){if(f.existsSync(p.join(l,q)))return l}return d})();console.log(r)")}"
node "$HARNESS_ROOT/scripts/skills-health.js" --dashboard
```

For a specific panel only:

```bash
HARNESS_ROOT="${CLAUDE_PLUGIN_ROOT:-$(node -e "var r=(()=>{var e=process.env.CLAUDE_PLUGIN_ROOT;if(e&&e.trim())return e.trim();var p=require('path'),f=require('fs'),h=require('os').homedir(),d=p.join(h,'.claude'),q=p.join('scripts','lib','utils.js');if(f.existsSync(p.join(d,q)))return d;for(var l of [p.join(d,'_harness'),p.join(d,'plugins','_harness')]){if(f.existsSync(p.join(l,q)))return l}return d})();console.log(r)")}"
node "$HARNESS_ROOT/scripts/skills-health.js" --dashboard --panel failures
```

For machine-readable output:

```bash
HARNESS_ROOT="${CLAUDE_PLUGIN_ROOT:-$(node -e "var r=(()=>{var e=process.env.CLAUDE_PLUGIN_ROOT;if(e&&e.trim())return e.trim();var p=require('path'),f=require('fs'),h=require('os').homedir(),d=p.join(h,'.claude'),q=p.join('scripts','lib','utils.js');if(f.existsSync(p.join(d,q)))return d;for(var l of [p.join(d,'_harness'),p.join(d,'plugins','_harness')]){if(f.existsSync(p.join(l,q)))return l}return d})();console.log(r)")}"
node "$HARNESS_ROOT/scripts/skills-health.js" --dashboard --json
```

## Usage

```
/skill-health                    # Full dashboard view
/skill-health --panel failures   # Only failure clustering panel
/skill-health --json             # Machine-readable JSON output
```

## What to Do

1. Run the skills-health.js script with --dashboard flag
2. Display the output to the user
3. If any skills are declining, highlight them and suggest running /evolve
4. If there are pending amendments, suggest reviewing them

## Panels

- **Success Rate (30d)** — Sparkline charts showing daily success rates per skill
- **Failure Patterns** — Clustered failure reasons with horizontal bar chart
- **Pending Amendments** — Amendment proposals awaiting review
- **Version History** — Timeline of version snapshots per skill
