# 훅 정책 — 무엇이 코어이고 왜 나머지가 아닌가

CLAUDE.md 는 결론과 명령만 담는다(매 세션 100% 로드되므로). 이 문서는 그 결론에 이르게 한
**근거와 은퇴 이력**을 담는다 — 훅을 추가·제거하려 할 때 읽는다.

---

## 1. 설계 기준

**훅은 "되돌리기 어려운 행위 차단"만 담당한다.**

모델이 좋아질수록 훅을 늘리면 답변 품질이 *내려간다* — 스스로 판단해서 하려던 일을 매번
끼어들어 되돌리기 때문이다. 그래서 훅 수는 늘릴 대상이 아니라 줄일 대상이다. 품질·관찰·
거버넌스는 훅이 아니라 커맨드(`/quality-gate`, `/code-review`, `/cost-report`)로 사람이
부를 때 돈다.

이유는 비용이 아니라 **간섭**이다. Opus 5 는 지시가 많을 때보다 *서로 반대되는 지시*가
있을 때 판단이 무너지고, 매 Edit 마다 끼어드는 경고·차단 훅이 그 충돌의 최대 공급원이었다.
그래서 `Edit`·`Write`·`Stop` 에 붙는 코어 훅은 **0개**다.

### 코어 판정 기준 두 개

1. **산출물에 독자가 있는가** — 아무도 읽지 않는 파일을 쓰는 훅은 코어가 아니다
2. **커맨드·rule·스킬로 커버되지 않는가** — 사람이 부를 수 있으면 상시 훅으로 끼워넣지 않는다

둘을 못 넘기면 옵트인으로 내린다.

---

## 2. 코어 2그룹

전 프로파일에서 동일하게 2그룹이다 — **minimal (2훅)** / **standard (2훅)** / **strict (2훅)**.
프로파일은 그룹 수가 아니라 dispatcher 내부 서브훅의 강도만 바꾼다.
(이 문장은 `scripts/ci/validate-hooks.js` 가 hooks.json 실측과 대조한다 — 지우면 CI 가 실패한다.)

| id | 이벤트 | 왜 코어인가 |
|---|---|---|
| `pre:bash:dispatcher` | PreToolUse(Bash) | minimal 서브훅은 `block-no-verify`·`git-push-reminder`. `rules/common/git-workflow.md` 가 이미 main 직행을 금지하는데도 위반이 발생한 실증이 있어 rule 만으로는 부족하다 |
| `subagent:budget` | SubagentStart | 서브에이전트는 SessionStart 컨텍스트(= ponytail 규율)를 상속하지 않아 다른 주입 경로가 없다. 스폰 시에만 발동하므로 평시 비용 0 |

`subagent:budget` 브리프는 두 종류다: 기본형(구현·탐색)과 **리뷰 변형**(`agent_type` 이
review/audit/detector/scorer/critic/analyzer 매칭). 리뷰 변형은 탐색 규율만 유지하고
**findings 개수는 압박하지 않는다.** ponytail 이 `off` 면 주입하지 않고,
`HARNESS_SUBAGENT_BUDGET=off` 로 개별 차단한다.

`pre:bash:dispatcher` 서브훅의 프로파일:

- **minimal 부터**: `block-no-verify` · `git-push-reminder`(기본 브랜치 직행 — minimal/standard 경고, strict 차단, 의도적 직행은 `HARNESS_ALLOW_MAIN_PUSH=1`)
- **standard 부터**: `auto-tmux-dev`
- **strict 전용**: `tmux-reminder` · `commit-quality` · `gateguard-fact-force`

`gateguard-fact-force` 는 **strict 전용이다.** 과거 dispatcher 쪽 사본만 `standard,strict` 로
새어 있어서 standard 프로파일에서 매 세션 첫 Bash 가 차단됐다 — 문서가 strict 라고 적어둔
것과 코드가 어긋난 사례이므로, 프로파일 CSV 를 바꿀 때는 hooks.json 과 dispatcher 양쪽을
함께 본다.

---

## 3. 은퇴 이력

### `post:bash:dispatcher` — 2026-08-15

서브훅 4개(`command-log-audit`·`command-log-cost`·`pr-created`·`build-complete`)가 전부
standard 이상이라 — 앞의 둘은 `profiles` 미지정이어서 기본값 `standard,strict` 로 떨어진다 —
**minimal 에서는 Bash 호출마다 node 를 띄워 아무 일도 하지 않았다.** 산출물
`bash-commands.log` 도 읽는 코드가 없다.

### 라이프사이클 4종 — 2026-08-16

| id | 근거 |
|---|---|
| `stop:cost-tracker` | `metrics/costs.jsonl` 의 유일한 독자가 `harness-metrics-bridge.js` 인데 같은 날 standard+ 로 내려갔다. minimal 에선 **매 응답마다 아무도 읽지 않는 무한증가(rotation 없음) 파일을 썼다.** `/cost-report` 는 전혀 다른 외부 DB(`~/.claude-cost-tracker/usage.db`)를 본다 |
| `stop:session-end` | `session-data/*.tmp` 자동 저장. **`/save-session` 커맨드가 같은 파일을 직접 쓴다**(커맨드가 커버). 세션 재개 1순위는 Orca 워크트리 / 네이티브 `/resume` 다 |
| `session:start` | minimal 주입 실적은 `Project type: {...}` 한 줄(레포 보면 아는 정보)뿐. 나머지 주입분은 observer instinct·learned-skill 요약인데 **observer 를 시작하는 코드가 하네스에 없다.** 게이팅은 `session-start-bootstrap.js` 안의 CSV 로 한다 — 부트스트랩이 이미 `run-with-flags` 를 부르므로 hooks.json 에서 한 번 더 감싸면 이중 래핑이다 |
| `session:end:marker` | `session:start` 가 쓴 observer lease 를 지우는 짝. 쌍으로만 의미가 있어 함께 내렸다 |

### 삭제된 스크립트 — 2026-08-16

어느 훅에도 등록돼 있지 않던 7개:

- `insaits-security-monitor.py` + `insaits-security-wrapper.js` — 서로만 참조하는 고아 쌍
- `check-hook-enabled.js` + `run-with-flags-shell.sh` — node 런너로 대체된 셸 변종
- `post-edit-format.js` + `post-edit-typecheck.js` — `stop-format-typecheck.js` 가 Stop 시점에
  루트별로 한 번에 처리한다. **매 Edit 개입이 없어진 것이 이 정리의 요지**
- `pre-bash-dev-server-block.js` — dispatcher 의 `auto-tmux-dev`/`tmux-reminder` 로 대체

`harness-statusline.js` 는 2026-08 에 같은 이유로 삭제됐다(등록된 적이 없고 statusLine 슬롯은
claude-dashboard 가 쓴다).

---

## 4. 프로파일

**글로벌 기본은 `HARNESS_HOOK_PROFILE=minimal`.** 설치가 `settings.json` 의 `env` 에
명시한다(`merge-hooks.js` 의 `applyDefaultHookProfile`) — `hook-flags.js` 의 코드 기본값도 같은
값이지만 암묵적 기본값은 사용자가 볼 수도 바꿀 수도 없어서 적어두는 것이 요점이다.

| 상황 | 설치 동작 |
|---|---|
| 값이 없음 | `minimal` 기록 |
| `standard` / `strict` | 그대로 둔다 (사용자의 결정) |
| 유효하지 않은 값 | 고치지 않고 알린다 — 런타임이 minimal 로 떨어진다는 사실을 알리는 편이 조용히 덮어쓰는 것보다 낫다 |
| `--uninstall` | 우리가 심은 `minimal` 만 걷고, 올려둔 값은 남긴다 |

### 뜻

- `minimal` = **최소한의 가드레일만**(되돌리기 어려운 행위 차단)
- `standard` = + 품질·관찰·거버넌스 **경고**
- `strict` = + **차단형**

그래서 `minimal` 에 훅을 추가하는 변경은 정의 위반이다 — 판단이 필요하면 커맨드로 부르지,
훅으로 상시 끼워넣지 않는다.

### 옵트인 스택은 standard 이상 전용이다

optional 28그룹 중 minimal 에서 켜지는 것은 **0개**여야 한다(2026-08-16 기준:
`standard,strict` 24 · `strict` 3 · 게이트 없음 1 = dispatcher 내부 게이팅).

과거 `post:harness-metrics-bridge`·`stop:evaluate-session`·`stop:capture-lessons` 셋이
`minimal` 을 포함해 minimal 인데도 켜졌다 — 특히 metrics-bridge 는 matcher `*` 이고 유일한
소비자(`post:harness-context-monitor`)가 `standard` 이상이라 **매 툴 호출마다 아무도 읽지 않는
파일을 썼다.** `--optional` 을 minimal 에 머지하면 `merge-hooks.js` 가 경고한다.

게이팅은 `run-with-flags.js <id> <script> <profilesCsv>` 로 하고, `HARNESS_DISABLED_HOOKS`
CSV 로 개별 차단한다.

---

## 5. 머지 — `scripts/install/merge-hooks.js`

**머지는 선언적이다**: 실행 후 settings.json 의 하네스 소유분은 머지한 집합과 정확히
일치하고, 그 밖의 하네스 훅은 전부 걷힌다 — hooks.json 에서 은퇴한 id, 그리고 **옛 설치가
남긴 `id` 없는 그룹**까지(`isLegacyHarnessGroup`: command 에 하네스 스크립트 경로 마커가
있으면 하네스 소유로 판정).

서드파티 훅(예: `~/.orca/agent-hooks/claude-hook.sh` 를 부르는 Orca 훅 11개)은 마커가 없어
보존된다. `--dry-run` 으로 sweep 목록을 먼저 확인할 것.

### `settings.json` 의 `id`·`description` 은 살아남지 못한다

Claude Code 가 그 파일을 재작성할 때(설정 변경·권한 규칙 추가 등) 스키마에 없는 키를
떨어뜨린다 — 2026-08-16 실측: 머지 직후 있던 `id` 6개가 이후 전부 사라졌고, 그때
`settings.json` 의 mtime 은 머지 시각보다 뒤였으며 top-level 에 `ultracode`·`enableWorkflows`
같은 Claude Code 자체 키가 들어와 있었다.

그래서 소유권 판정을 **실행하는 스크립트**(`runsHarnessScript`) 기준으로 두었고 `id` 는
보고용일 뿐이다. 부작용: `--dry-run` 이 매번 "swept N + added N" 으로 보인다(결과는
정확하다 — 스크립트 대조로 검증).

Tests: `tests/scripts/install/merge-hooks.test.js`.

---

## 6. Loop Control — 루프를 돌릴 때만 켠다

자율 루프(관찰→계획→도구실행→결과확인→재계획)에 필요한 제어는 **상시 훅이 아니라 루프를
돌릴 때 켠다.** 코어 훅이 되돌리기 어려운 행위만 막는 것과 같은 이유다 — 루프 계측은 루프를
돌리는 동안에만 값을 하고, 평시에는 매 툴 호출에 끼어드는 노이즈다.

```bash
node scripts/install/merge-hooks.js --optional   # 루프 시작 전: 계측 켜기
node scripts/install/merge-hooks.js              # 끝난 뒤: 코어만 남기기(선언적이라 자동 정리)
```

| 실패 모드 | 담당 |
|-----------|------|
| **무한 루프** | `post:harness-context-monitor`(optional) 의 `detectLoop` — 동일 서명 3회면 경고. 서명은 `hashToolCall` = **도구명 + 입력 전체**의 해시다(일부 필드만 고르면 빠뜨린 필드가 곧 오탐이 된다 — 한 파일 연속 편집, offset 페이징, `replace_all` 토글이 모두 "같은 호출"로 뭉쳤던 전례). 여기에 `/loop-start` 의 max_turns·명시적 종료 조건 |
| **컨텍스트 폭증** | `pre:compact`·`pre:edit-write:suggest-compact`(optional), `session:start`(optional) 주입 캡(`HARNESS_SESSION_START_MAX_CHARS`, 기본 8000자), `subagent:budget`(코어). 잔량 **경고**는 없다 — 컨텍스트 퍼센트는 statusLine 훅만 볼 수 있고 그 슬롯은 claude-dashboard 가 쓴다(대신 사용자가 눈으로 본다) |
| **동일 실수 반복** | `stop:capture-lessons`(optional) 가 반복 교정 신호를 감지 → `/lessons add` → `skills/lessons-learned`. 안정된 교훈은 `/lessons promote`. 단 rules 는 상시 로드 예산이므로 불변 제약만 올린다 |
| **비용 폭증** | `stop:cost-tracker`(optional) + `/cost-report`. 그리고 파이프라인을 단계별로 태깅한다 — detect→fix→judge 는 `sonnet`→`sonnet`→`opus` |

**경계**: 한 세션 안의 read-edit-test 반복은 Claude Code + 위 optional 스택이 담당한다. 그 밖의
다중 에이전트 실행(팬아웃, 블로킹 ask/reply, task DAG, worker_done 대기, 워크트리 격리)은 전부
Orca `orchestration` 이 담당한다 — 둘을 겹쳐 돌리지 않는다.

**계측이 틀리면 없는 것보다 나쁘다.** 오탐이 잦은 경고는 읽는 사람을 길들여 무시하게 만들고,
그러면 진짜 루프도 함께 묻힌다. 루프 감지 로직을 바꿀 때는
`tests/hooks/loop-detection.test.js` 의 "정상 진행은 루프가 아니다" 케이스를 먼저 통과시킨다.

---

## 7. `hooks/prompt-pack.json`

실행되지 않는 참고용 프롬프트 2개(`ref:pre-write-guard`, `ref:review-on-stop`). 무엇과
겹치는지와 필요할 때 배선하는 방법은 `hooks/README-prompt-pack.md`.
