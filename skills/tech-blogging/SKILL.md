---
name: tech-blogging
description: >
  Technical blog post authoring — hooks, structure, code samples, diagrams,
  SEO, cross-posting. Trigger: blog post, dev blog, devto, medium, velog,
  substack, hashnode, hacker news, mermaid / excalidraw diagram, code
  sample, canonical URL, RSS, OpenGraph, Korean tech blog.
origin: custom
workloads: [writing]
---

# Tech Blogging

Tech blog posts that work share a structure: a concrete problem, a working
artifact, and the smallest amount of explanation that still teaches. Pair
this skill with `article-writing` (long-form discipline), `crosspost`
(distribution), `seo` (discoverability), and `brand-voice` (consistency
across destinations).

## When to Activate

- Drafting a technical blog post (tutorial, post-mortem, deep dive, opinion)
- Editing for clarity, hook, payoff
- Preparing cross-posts (personal blog, dev.to, Medium, velog, Substack,
  Hashnode, company blog)
- Picking diagram / code-sample tooling
- SEO sanity check before publish

## Pick Post Type Before Outlining

| Type | Reader's job | Default length |
|---|---|---|
| **Tutorial / how-to** | Reproduce a result | 1500–3000 words |
| **Deep dive / explainer** | Understand a system | 2500–5000 words |
| **Post-mortem** | Avoid the same incident | 1200–2500 words |
| **Opinion / take** | Update a belief | 800–1800 words |
| **Release / changelog narrative** | Try the new thing | 600–1500 words |
| **Annotated artifact** (gist + notes) | Read working code | 400–1200 words |

Mismatched type and length is the #1 reason tech posts feel padded or rushed.
A 4000-word "opinion" is exhausting; a 600-word "deep dive" is hand-wavy.

## The Hook (First 100 Words)

Earn the scroll. Choose one of:

- **Concrete artifact**: paste the working command/snippet first, then explain.
  > `pg_stat_statements` told us a 4ms query was being called 800k times/min.
- **Number that surprises**: a metric a reader can compare against.
  > Our cold start dropped from 1.4s to 180ms after one config change.
- **Wrong-then-right**: state the common belief, then the correction.
  > Most "use Redis for caching" advice assumes you have a cache miss problem.
- **Problem statement, no fluff**: 1–2 sentences, then "Here's how we fixed it."

Banned openers:
- "In today's fast-paced world…"
- "Have you ever wondered…"
- A definition of the technology you're writing about
- A history lesson that doesn't earn its space

## Structure

```
1. Hook (problem + stakes, 50–150 words)
2. The minimum context the reader needs (200–400 words)
3. The walk-through / argument (the bulk)
4. Result + what was surprising (200 words)
5. Caveats + what didn't work (200 words — optional but builds trust)
6. Takeaways (3–5 bullets, NOT a summary of the post)
```

Use **assertion subheadings**, not topic ones:
- Topic: "Caching"
- Assertion: "Caching at the edge cut p99 by 40%, but we paid for it in cache invalidation"

The subheading should state the section's argument so a skimmer-reading-only-headings still gets the post.

## Code Samples

- **Runnable > illustrative.** If the reader can paste it and it works, you've
  earned trust. If it requires unstated setup, you've created a support burden.
- **Real names, not `foo` / `bar`** unless explicitly demonstrating syntax.
  `user_id` and `Order` over `x` and `Bar`.
- **Show the diff for changes**, not the whole file. Use `// before` / `// after`
  comments or fenced diff blocks.
- **Trim to the relevant section.** Replace surrounding context with `// ...`.
  20-line snippet beats 80-line file dump.
- **Always specify the language fence** for syntax highlighting.
- For multi-file examples, link to a Gist or repo at the top of the section
  rather than dumping all files inline.
- **Pin versions** when the API has churned recently. "Postgres 16, pgvector 0.8".
  Stale tutorials are how trust dies.

## Diagrams

| Tool | When |
|---|---|
| **Mermaid** | Flowcharts, sequence diagrams, ER. Renders on GitHub / Hashnode / Notion natively. |
| **Excalidraw** | Hand-drawn feel, sketchy boxes. Architecture overviews. Export PNG/SVG. |
| **tldraw** | Same niche as Excalidraw, slightly more polished. |
| **D2** | Declarative diagrams as code. Better than Mermaid for complex layouts. |
| **Screenshot + Skitch / CleanShot** | Annotating real UI / dashboards. |

Rules:
- **One diagram per concept.** A 12-box diagram explains nothing.
- **Add the diagram source** (Mermaid block, Excalidraw `.excalidraw` file)
  somewhere — repo, Gist, end of post. Future-you will need to edit it.
- **Caption the diagram with its claim**, not its title. "How write traffic
  flows during failover" beats "Architecture".

## SEO Without Selling Out

Don't pad for keywords. Do the boring hygiene:

- **Title**: 50–60 chars, the thing the post actually delivers, plus the
  technology. "Why our Postgres `LIKE '%foo%'` query was 800× slower than expected"
- **Meta description** (150–160 chars): the takeaway, not "In this post we
  will…"
- **One H1, multiple H2/H3.** Don't skip levels.
- **Internal links** to your own related posts — every relevant phrase, not just
  the obvious ones.
- **Slug**: short, hyphenated, keyword-bearing. `/postgres-like-slow` over
  `/2026/05/post-19`.
- **Image alt text**: describe the image's *information*, not its appearance.
  "Diagram of write path during AZ failure" not "diagram1".
- **Canonical URL** when cross-posting (see below).

## Cross-Posting

Order:
1. Personal blog (canonical)
2. Wait 2–7 days for indexing
3. dev.to / Hashnode / Medium with `canonical_url` pointing back
4. velog (Korean audience) — use the `<!-- 원문 -->` pattern
5. Hacker News / Reddit / X — link to the canonical, don't paste the body

`canonical_url` is non-negotiable. Without it, the Medium / dev.to copy
outranks your own site.

## Korean Tech Blog Notes

- **velog** is the default destination for Korean dev audiences. Markdown,
  series support, decent SEO.
- **tistory** for older audiences and SEO-heavy long-form.
- **Brunch** for narrative-leaning, less for code-heavy.
- **Mixed Korean + English code**: keep code in English (variable names,
  comments) — translating identifiers makes the post unsearchable.
- **Title patterns that work**: 숫자/결과 + 기술 + 짧은 설명.
  > "p99 지연 1.4s → 180ms: Lambda 콜드 스타트 줄인 한 줄 설정"
- **Honorifics**: blog posts default to `-습니다` (formal). `-요` for friendlier
  newsletter / personal voice.
- **Cross-posting Korean → English** is harder than vice versa — English audiences
  expect more upfront context (background sentences Koreans assume).

## Pre-Publish Checklist

- [ ] Hook earns the scroll within 100 words
- [ ] Subheadings are assertions, readable on their own
- [ ] Code blocks have language fences and are runnable (or explicitly noted as illustrative)
- [ ] Diagrams have captions stating their claim
- [ ] One concrete number or artifact per major section
- [ ] No "In conclusion" / "I hope you enjoyed" / "Thanks for reading"
- [ ] Title is 50–60 chars and describes the result
- [ ] Meta description written
- [ ] OG image set (or default theme image is acceptable)
- [ ] Internal links to ≥2 related posts
- [ ] One trusted reader has read it before publish (or 24h cooldown if not)

## Common Pitfalls

- **Hedge stacking**: "It might be the case that some users could potentially…"
  Trust the claim or cut it.
- **Tutorial that doesn't run** — the worst kind of tech post.
  Run the snippets in a clean environment before publish.
- **Burying the lede** — readers leave. Put the result up front.
- **Generic stock images** — drop them. A real screenshot or no image at all.
- **Year in the title for evergreen posts** — "Best practices in 2026" rots
  the post by 2027. Use `Updated 2026-05` in the body instead.
- **Forgetting RSS / OG tags** — losing the Hacker News / Twitter preview is
  losing half the click-through.

## Related

- `[skills/article-writing]` — long-form discipline, voice
- `[skills/crosspost]` — multi-platform distribution mechanics
- `[skills/brand-voice]` — voice consistency across destinations
- `[skills/markdown-writing]` — the source format for most blog tools
- `[skills/seo]` — when SEO is the primary driver
