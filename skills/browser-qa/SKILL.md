---
name: browser-qa
description: Use this skill to automate visual testing and UI interaction verification using browser automation after deploying features.
origin: harness
workloads: [frontend]
---

# Browser QA — Automated Visual Testing & Interaction

## When to Use

- After deploying a feature to staging/preview
- When you need to verify UI behavior across pages
- Before shipping — confirm layouts, forms, interactions actually work
- When reviewing PRs that touch frontend code
- Accessibility audits and responsive testing

## How It Works

라이브 페이지를 실제 사용자처럼 조작한다. **Orca 안에서는 Orca 임베디드 브라우저를 쓴다**
(`orca-cli` 스킬) — playwright MCP 는 등록하지 않는다. 매핑은 그대로 대응된다:

| 필요한 동작 | Orca CLI |
|---|---|
| 이동 | `orca tab create --url <URL>` · `orca goto --url <URL>` |
| 요소 파악 | `orca snapshot` — element ref(`@e1`)를 돌려준다. 셀렉터 대신 이걸 쓴다 |
| 조작 | `orca click --element @e1` · `fill --element @e1 --value` · `type` · `select` · `hover` · `keypress` · `scroll` |
| 검증 | `orca eval --expression <JS>` · `orca screenshot` · `orca wait` |
| 로그인 상태 | `orca tab profile create/set` — 세션 프로필로 유지된다(헤드리스에는 없는 이점) |

Orca 밖에서는 브라우저 자동화 MCP(claude-in-chrome, Playwright, Puppeteer)를 쓴다.

### Phase 1: Smoke Test
```
1. Navigate to target URL
2. Check for console errors (filter noise: analytics, third-party)
3. Verify no 4xx/5xx in network requests
4. Screenshot above-the-fold on desktop + mobile viewport
5. Check Core Web Vitals: LCP < 2.5s, CLS < 0.1, INP < 200ms
```

### Phase 2: Interaction Test
```
1. Click every nav link — verify no dead links
2. Submit forms with valid data — verify success state
3. Submit forms with invalid data — verify error state
4. Test auth flow: login → protected page → logout
5. Test critical user journeys (checkout, onboarding, search)
```

### Phase 3: Visual Regression
```
1. Screenshot key pages at 3 breakpoints (375px, 768px, 1440px)
2. Compare against baseline screenshots (if stored)
3. Flag layout shifts > 5px, missing elements, overflow
4. Check dark mode if applicable
```

### Phase 4: Accessibility
```
1. Run axe-core or equivalent on each page
2. Flag WCAG AA violations (contrast, labels, focus order)
3. Verify keyboard navigation works end-to-end
4. Check screen reader landmarks
```

## Output Format

```markdown
## QA Report — [URL] — [timestamp]

### Smoke Test
- Console errors: 0 critical, 2 warnings (analytics noise)
- Network: all 200/304, no failures
- Core Web Vitals: LCP 1.2s ✓, CLS 0.02 ✓, INP 89ms ✓

### Interactions
- [✓] Nav links: 12/12 working
- [✗] Contact form: missing error state for invalid email
- [✓] Auth flow: login/logout working

### Visual
- [✗] Hero section overflows on 375px viewport
- [✓] Dark mode: all pages consistent

### Accessibility
- 2 AA violations: missing alt text on hero image, low contrast on footer links

### Verdict: SHIP WITH FIXES (2 issues, 0 blockers)
```

## Integration

순서대로 첫 번째로 가능한 것을 쓴다:
- **Orca 안: `orca-cli`** — `ORCA_PANE_KEY`·`ORCA_AGENT_HOOK_PORT` 가 있으면 Orca 안이다.
  임베디드 브라우저가 위 표의 동작을 전부 커버하므로 여기서 멈춘다.
- `claude-in-chrome` 확장 (실제 Chrome 을 쓴다)
- playwright MCP — Orca 밖에서만. `--browser chromium` 이 필요하다(`mcp-configs/README.md`)
- 직접 Puppeteer 스크립트

Pair with `/canary-watch` for post-deploy monitoring.
