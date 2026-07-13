---
description: 교차 모델 코드리뷰 — 현재 diff(또는 PR)를 codex·kiro-cli 두 외부 모델에 보내 독립 리뷰를 받고 대조·종합
argument-hint: [pr-number | pr-url | blank for local diff]
workloads: [core]
---

# Cross-Model Code Review

같은 diff를 **서로 다른 모델 패밀리** 두 곳(OpenAI Codex, Amazon Kiro)에 독립적으로
리뷰시키고, 각자의 지적을 대조해 종합한다. Claude 자기 자신이 놓치는 사각을 다른
모델의 시선으로 메우는 게 목적. 두 모델 출력은 **검증 대상인 제안**이지 정답이 아니다.

**Input**: $ARGUMENTS

## 1. 리뷰 대상 diff 확보

- `$ARGUMENTS`가 비어 있으면: 로컬 변경분
  ```bash
  git diff HEAD 2>/dev/null; git diff --cached 2>/dev/null
  ```
  둘 다 비면 최근 커밋 `git show HEAD`를 대상으로 삼는다.
- `$ARGUMENTS`가 PR 번호/URL이면: `gh pr diff <n>` 로 diff 확보.

diff가 비어 있으면 "리뷰할 변경 없음"으로 보고하고 중단.

## 2. 두 리뷰어에 병렬 전송

diff를 임시 파일에 저장한 뒤(프롬프트 인자로 직접 넘기면 길이·이스케이프 문제) 두 CLI를
한 메시지에서 **동시에** 호출한다. 프리플라이트: `codex --version`, `kiro-cli --version`이
non-zero면 그 리뷰어는 건너뛰고 사용자에게 알린다.

공통 리뷰 프롬프트(파일 경로를 프롬프트에 박아 각 CLI가 직접 읽게 한다):

> `<diff-file>`의 변경을 리뷰해라. 다음만 보고: 1) correctness 버그 2) 보안 이슈
> (injection, secret, auth) 3) 에러 처리 누락 4) 놓친 엣지 케이스. severity(CRITICAL/HIGH/
> MEDIUM/LOW)와 파일:라인을 붙여라. 스타일 지적은 생략. 문제 없으면 "No issues"만.

```bash
# codex — read-only, stdin 반드시 /dev/null, thinking 억제
codex exec --skip-git-repo-check --sandbox read-only \
  "Review the diff in <diff-file>. Report only: correctness bugs, security \
issues, missing error handling, missed edge cases. Tag severity + file:line. \
Skip style. Say 'No issues' if clean." </dev/null 2>/dev/null

# kiro-cli — 비대화형, 도구 신뢰 안 함(읽기 리뷰만)
kiro-cli chat --no-interactive --trust-tools= \
  "Review the diff in <diff-file>. Report only: correctness bugs, security \
issues, missing error handling, missed edge cases. Tag severity + file:line. \
Skip style. Say 'No issues' if clean." 2>/dev/null
```

codex는 완료 시점에만 출력하니 **동기 실행**(백그라운드 금지). 둘 다 최대 ~600s.

## 3. 대조·종합

- 두 리뷰어가 **공통 지적**한 항목 → 신뢰도 높음, 최상단.
- 한쪽만 지적한 항목 → 각 소스 명시(`[codex]` / `[kiro]`)하고 나열.
- **직접 검증**: 두 모델 다 자기 knowledge cutoff가 있고 틀릴 수 있다. 지적을 그대로
  받아쓰지 말고, 실제 코드/diff를 열어 확인한 것만 CONFIRMED로 표시. 확인 못 한 건
  PLAUSIBLE로 구분.
- 최종 출력: severity 내림차순 표 1개 + 한 줄 요약. 사용자가 fix 여부 결정.

## 참고

- codex 호출 3종 세트(`</dev/null`·`2>/dev/null`·`--skip-git-repo-check`)는 필수 —
  자세한 규약은 `skills/codex-cli/SKILL.md`.
- 쓰기 권한(codex `--sandbox workspace-write`, kiro `--trust-all-tools`)은 리뷰엔 불필요.
  fix를 외부 모델에 시키려면 사용자 승인 후에만.
