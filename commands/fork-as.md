---
description: 지정한 에이전트의 rubric 을 지키면서 현재 대화 맥락을 상속하는 fork 를 띄운다 — cold 에이전트로는 맥락이 넘어가지 않을 때.
argument-hint: <agent-name> [작업 지시]
workloads: [core]
---

# Fork As \<agent>

`fork` 와 named agent 는 **배타적이다** — fork 는 정의 파일의 시스템 프롬프트를 쓰지 않고 부모
세션 것을 그대로 쓴다(호출은 `fork` 를 지목하거나 정의로 해석되거나 둘 중 하나다). 그래서
"이 대화 맥락이 필요한데 그 에이전트의 rubric 도 필요한" 경우는 **fork 를 띄우고 rubric 을
파일로 넘겨** 근사한다.

**Input**: `$ARGUMENTS` — 첫 토큰이 에이전트 이름, 나머지가 작업 지시.

## 언제 쓰나

| 상황 | 선택 |
|---|---|
| 방금까지의 진행·시도·실패가 판단에 필요하다 | **이 커맨드** (fork) |
| 독립적인 시선이 필요하다 (리뷰·감사·판정) | `Agent(subagent_type: "<name>")` — cold 가 맞다 |
| 티어를 내려 비용을 아끼고 싶다 | cold — fork 는 부모 모델 고정이다 |
| 툴을 좁혀 사고를 막고 싶다 | cold — fork 는 부모의 툴 풀을 그대로 받는다 |

**리뷰·감사 계열(`*-reviewer`·`*-auditor`·`*-detector`)에는 쓰지 않는다.** 부모의 합리화와
사각을 그대로 물려받아 상관을 최대로 만들고, 그건 리뷰의 존재 이유를 지운다.

## 절차

1. 에이전트 정의를 찾는다 — 레포 우선, 없으면 설치본:
   ```bash
   ls agents/<name>.md 2>/dev/null || ls ~/.claude/agents/_harness/<name>.md
   ```
   못 찾으면 이름이 비슷한 후보를 나열하고 멈춘다.
2. 정의를 읽어 **body(역할·절차·산출물 규격)** 와 frontmatter 의 `skills:`·`tools:` 를 확인한다.
3. `Agent(subagent_type: "fork")` 로 띄우고 프롬프트에 넣는다:
   - `You are acting as the "<name>" agent. Read agents/<name>.md first and follow it.`
   - `skills:` 에 적혀 있던 스킬을 **fork 가 직접 Skill 툴로 읽도록** 지시한다 —
     preload 는 정의 기반 서브에이전트에만 적용되므로 fork 에는 오지 않는다.
   - 원래 작업 지시(`$ARGUMENTS` 의 나머지).
   - 산출물 형식은 그 에이전트가 원래 내놓는 형식으로 고정.
4. 정의의 `model:`·`effort:`·`tools:` 는 **무시된다**(부모 값으로 돈다). 그 값이 판단에
   중요하면 fork 를 쓰지 말고 cold 로 돌린다.

## 제약

- **fork 는 fork 를 못 만든다** — 이 fork 안에서 다시 위임할 수 없다.
- 툴 축소가 적용되지 않는다. 읽기 전용으로 좁혀둔 에이전트(대부분의 리뷰어)는 cold 가 안전하다.
- headless(`-p`)·Agent SDK 에서는 fork mode 가 기본 off 다 — 필요하면
  `CLAUDE_CODE_FORK_SUBAGENT=1`.
- 판단 기준 전문은 `CLAUDE.md` → "서브에이전트는 fork 우선" 과
  `docs/orca-dependencies.md` §4.
