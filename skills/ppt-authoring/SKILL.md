---
name: ppt-authoring
description: >
  Authoring presentation slides — narrative arc, slide hygiene, assertion
  titles, data viz, Korean typography. Tools: Keynote, PowerPoint, Marp,
  Slidev, reveal.js, python-pptx. Trigger: keynote, marp, slidev,
  reveal.js, python-pptx, slide deck, pitch, talk, conference talk,
  webinar, internal review.
origin: custom
---

# Presentation Authoring

A deck is a script for a live performance, not a document. The slide is the
visual aid; you are the explanation. Every slide that fails the "would I
believe this without the speaker" test belongs in the appendix.

## When to Activate

- Building a new deck from scratch
- Reviewing / tightening an existing deck
- Choosing a tool (Keynote, PowerPoint, Marp, Slidev, reveal.js, python-pptx)
- Generating slides programmatically (reports, weekly metrics)

## Pick the Tool by Audience

| Context | Tool |
|---|---|
| Investor pitch, exec, polished visuals | **Keynote** (Mac) / **PowerPoint** |
| Engineering talk, code-heavy, version-controlled | **Slidev** (Markdown + Vue) or **reveal.js** |
| Static one-pager, fast to write, PDF-friendly | **Marp** (Markdown) |
| Programmatic / data-driven slides | **python-pptx** + Jinja templates |
| Live coding / browser-only | **Slidev** or **reveal.js** |

If the deck will live for >6 months and be edited by collaborators, prefer
Markdown-based tools — diffs are reviewable.

## Narrative Templates

Pick one structure before opening the slide tool:

- **Problem → Insight → Solution → Proof → Ask**
  Investor and product pitches.
- **BLUF (Bottom Line Up Front)**: Recommendation → Reasons → Evidence.
  Internal exec reviews. Time-boxed.
- **SCQA**: Situation → Complication → Question → Answer.
  Strategy / consulting decks. Sets up the answer with tension.
- **Hero's Journey**: Status quo → Disruption → Struggle → Resolution.
  Keynotes, conference talks, narrative-heavy.
- **Pyramid (Minto)**: Single answer → 3 supporting arguments → evidence per arg.
  Decision documents that double as decks.

Match the template to the *time slot*. A 5-min update is BLUF. A 45-min
keynote is the Hero's Journey. Mismatched structure burns half the room's
attention.

## Slide Hygiene

1. **One idea per slide.** If the title needs an "and", split.
2. **Assertion titles, not topic titles.**
   - Topic title: "Q3 Performance"
   - Assertion title: "Q3 revenue grew 28% — driven by enterprise upsell"
   The assertion is the slide's argument. The chart is the proof.
3. **6×6 max** — at most 6 lines, 6 words per line. If you need more, you
   need another slide or a handout.
4. **Font ≥ 24 pt** for body. If it doesn't fit at 24 pt, the slide has too
   much text.
5. **High contrast.** Dark text on light background, or the inverse — never
   medium-grey on medium-blue.
6. **Animations only when they teach.** Build-on-click for sequential reveals,
   never "fly in from the left" for decoration.
7. **No bullet points if a sentence will do.** Prose with a key phrase bolded
   beats five truncated bullets.

## Data Viz on Slides

- **One number per slide** when the number is the point. 28% in 200pt font
  beats a chart.
- **Strip chartjunk**: drop gridlines, drop legends if there are ≤2 series
  (label directly), drop axis titles when units are obvious from the slide title.
- **Callouts > tables.** Annotate the one bar/dot/line that supports the
  argument. Tables on slides are unreadable past row 4.
- **Color = meaning.** One brand color, one accent for the highlighted data,
  grey for everything else. No rainbow palettes.
- **Source line at bottom-right** in 10–12 pt grey. Builds credibility.

## Markdown Slide Workflows

### Slidev (Vue + Markdown, dev-friendly)

```markdown
---
theme: seriph
title: Q3 Engineering Review
---

# Q3 Engineering Review
2026-Q3

---

## p99 latency dropped 42%

```ts {monaco}
// before
const handler = async (req) => { /* sync DB write */ }
// after
const handler = async (req) => { await queue.enqueue(req) }
```

→ async write moved p99 from 820ms → 470ms
```

Live coding, syntax highlighting, embeddable Vue components.

### Marp (pure Markdown, fast)

```markdown
---
marp: true
theme: default
size: 16:9
---

# Title slide

Speaker — date

---

## Assertion title in bold

- Supporting point 1
- Supporting point 2

![bg right](./screenshot.png)
```

Renders to PDF/HTML/PPTX in one command.

## python-pptx (Programmatic)

Use when the deck is generated from data — weekly metrics, customer reviews,
A/B test reports.

```python
from pptx import Presentation
from pptx.util import Inches, Pt

prs = Presentation("template.pptx")  # start from a brand template
slide = prs.slides.add_slide(prs.slide_layouts[1])
slide.shapes.title.text = f"WoW revenue +{growth_pct:.1f}%"

tf = slide.placeholders[1].text_frame
tf.text = f"${revenue:,.0f} this week"
tf.paragraphs[0].font.size = Pt(24)

prs.save("weekly-2026-w20.pptx")
```

Always start from a brand template — placeholders inherit the theme. Building
a deck from scratch in python-pptx is hours of fighting the COM model.

## Speaker Notes vs Handouts

- **Speaker notes** are for you, on the lectern. Bullet phrases, transition
  cues, time markers ("at 8 min, you should be on slide 12").
- **Handouts** are the document version that survives the meeting. If your
  deck must double as a handout, commit to one or the other:
  - Slide-doc style (Edward Tufte): dense slides, prose-like, readable cold.
    Good for internal decision docs.
  - Two-doc style: minimal deck for the talk + separate written memo.
    Better when the deck will be reused.

## Korean Typography on Slides

- **Font**: `Pretendard`, `Apple SD Gothic Neo`, `Noto Sans KR`. Avoid Malgun
  Gothic for production decks (heavier, dated).
- **Mixed Korean + English**: pick a Korean font with matching Latin
  glyphs (Pretendard ships both) — otherwise English looks pasted in.
- **Line height**: 1.5–1.7 for Korean body text. The default 1.2 is too tight.
- **Numbers**: use **tabular figures** so columns align in financial slides.
- **Won symbol**: `₩` not `\` — the backslash is a font glitch from CP949 era.
- Avoid mixing 한자 unless the audience will recognise it; transliterate or
  drop.

## Review Checklist

Before sending the deck:

- [ ] Every title is an assertion, not a topic
- [ ] Every chart has a one-line takeaway visible without speaking
- [ ] Slide count ≤ minutes of talk (rule of thumb)
- [ ] Backup slides moved to appendix
- [ ] Speaker notes have time markers
- [ ] Last slide is **not** "Thank you / Questions" — it's the **call to action**
- [ ] Exported PDF still readable (in case projector dies)
- [ ] Practiced once at full speed to confirm timing

## Common Pitfalls

- **Topic titles** ("Architecture") instead of assertion titles
  ("Async write moved p99 from 820 → 470 ms")
- **Reading slides aloud** — the audience can read faster than you talk
- **Animation overdose** — every transition slows you down
- **Chart with 6 series, no highlight** — pick one, grey the rest
- **Tiny screenshots** of dashboards — crop to the data point or recreate the chart
- **"Thank you" as the last slide** — wastes the most-remembered moment of the deck

## Related

- `[skills/article-writing]` — for the written companion memo
- `[skills/brand-voice]` — voice consistency across talks and posts
- `[skills/markdown-writing]` — Marp / Slidev source authoring
