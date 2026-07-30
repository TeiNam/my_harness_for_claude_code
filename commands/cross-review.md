---
description: 교차 모델 코드리뷰 — 현재 diff(또는 PR)를 Claude 자체 리뷰 + OpenAI Codex 독립 리뷰로 2-way 대조·종합
argument-hint: [pr-number | pr-url | blank for local diff]
workloads: [core]
---

# Cross-Model Code Review (2-way)

같은 diff를 **두 모델 패밀리**가 독립적으로 리뷰한다 — 이 세션의 **Claude**(직접
정독)와 **OpenAI Codex**(다른 모델 패밀리, CLI 호출). Claude 혼자 놓치는 사각을
Codex의 시선으로 메우고, 두 관점이 겹치는 지적은 신뢰도가 높다. Codex 출력은
**검증 대상인 제안**이지 정답이 아니다.

> Amazon Kiro(kiro-cli)는 한때 3번째 리뷰어였으나, `--no-interactive` 모드가 도구
> 호출 후 최종 리뷰 텍스트를 안정적으로 내놓지 못해 제외했다. 필요하면 대화형으로
> 직접 붙여 쓰는 편이 낫다.

**Input**: $ARGUMENTS

## 1. 리뷰 대상 diff 확보

- `$ARGUMENTS`가 비어 있으면: 로컬 변경분
  ```bash
  git diff HEAD 2>/dev/null; git diff --cached 2>/dev/null
  ```
  둘 다 비면 최근 커밋 `git show HEAD`를 대상으로 삼는다.
- `$ARGUMENTS`가 PR 번호/URL이면: `gh pr diff <n>` 로 diff 확보.

diff가 비어 있으면 "리뷰할 변경 없음"으로 보고하고 중단. diff가 크면(수백 줄+)
데이터·생성물 덩어리는 빼고 **로직 파일만** 추려 리뷰 신호를 높인다.

## 1.5 Blast radius — "바뀌지 않았지만 검토할 것"

diff는 *무엇이 바뀌었나*만 말해준다. *그래서 어디가 깨지나*는 모른다. 두 리뷰 축에
넘기기 전에 **diff 밖 영향권**을 뽑는다. 인덱스를 만들지 않으므로 stale 될 것이 없다.

```bash
# 변경 파일 목록 (PR 모드면 `gh pr diff <n> --name-only`)
changed() { git diff --name-only HEAD; git diff --cached --name-only; }

# (a) 역참조 — 바뀐 모듈을 require/import 하는 파일
changed | sort -u | while IFS= read -r f; do
  case "$f" in *.js|*.ts|*.tsx) base=$(basename "${f%.*}");; *) continue;; esac
  rg -l "(require|from)\s*\(?\s*['\"][^'\"]*${base}['\"]" . --glob '!node_modules' </dev/null 2>/dev/null
done | sort -u

# (b) 동반변경 — 히스토리상 같은 커밋에 자주 등장한 파일 (import 관계가 없어도 잡힌다)
changed | sort -u | while IFS= read -r f; do
  git log --format='C%H' --name-only -- "$f" </dev/null \
    | awk -v t="$f" '/^C/{if(n>1&&n<20){for(i=1;i<=n;i++)if(f[i]!=t)print f[i]};n=0;next} NF{f[++n]=$0}' \
    | sort | uniq -c | sort -rn | head -5
done | sort -rn
```

> **셸 함정 두 개** — 실측으로 확인했다. ① `rg` 에 **경로 인자(`.`)와 `</dev/null` 을 반드시**
> 준다. 경로 없이 쓰면 rg 가 stdin 을 읽어 `while` 루프의 입력을 삼켜 **첫 파일만 처리하고
> 조용히 끝난다**(빈 결과처럼 보인다). ② `$CHANGED` 를 `for` 로 돌리지 말고 위처럼 한 줄씩
> 읽는다 — 공백 있는 경로가 깨지고, `awk -v` 에 개행이 섞여 `newline in string` 으로 죽는다.

결과에서 **diff에 포함되지 않은 파일만** 남겨 "참조 대상" 목록으로 만들고, 2단계의 두
축에 함께 넘긴다. 특히 이 두 부류를 노린다:

- **카운터·카탈로그 정합** — diff가 어떤 숫자·목록을 고쳤으면 그 숫자의 *출처* 파일을 연다.
  (실제 사례: `CLAUDE.md` 훅 카운트를 고치면서 `hooks/hooks.json`을 안 봐서 틀린 값을 커밋. diff만 보면 완벽히 타당해 보이므로 두 리뷰 축 모두 통과했다. 지금은 `scripts/ci/validate-hooks.js`가 이 부류를 기계로 잡는다.)
- **import 없는 커플링** — (b)만 잡는 종류. 예: `install/menu.js` 와 `tests/.../workloads.test.js` 는
  import 관계가 없는데 워크로드 키가 양쪽에 걸쳐 있어 6회 동반변경됐다.

**한계를 알고 쓴다.** (b)는 히스토리 깊이가 필요하다 — 커밋이 1~2개뿐인 신규 파일에서는
빈 결과가 정상이며, 그때는 (a)에만 의존한다. 목록이 20개를 넘으면 상위 5개만 쓰고
**잘랐다는 사실을 리포트에 남긴다**(조용한 절단 금지).

## 2. 두 관점으로 리뷰

**(A) Codex — 독립 축.** diff를 임시 파일에 저장한 뒤(프롬프트 인자로 직접 넘기면
길이·이스케이프 문제) 호출한다. 프리플라이트: `codex --version`이 non-zero면 Codex는
건너뛰고 Claude 단독 리뷰임을 사용자에게 알린다.

```bash
# read-only, stdin 반드시 /dev/null, thinking 억제(2>/dev/null), git 체크 skip
# 모델은 핀하지 않는다 — codex CLI 기본 모델을 그대로 쓴다
codex exec --skip-git-repo-check --sandbox read-only \
  "Review the diff in <diff-file>. Report only: correctness bugs, security \
issues (injection/secret/auth), missing error handling, missed edge cases. \
Tag severity CRITICAL/HIGH/MEDIUM/LOW with file:line. Skip style. \
Say 'No issues' if clean." </dev/null 2>/dev/null
```

`--model` 을 주지 않으므로 codex CLI 설정(`~/.codex/config.toml` 등)의 기본 모델이
쓰인다. 최종 리포트에는 실제 사용된 모델을 명시한다 — 필요하면 `codex exec` 출력
헤더나 `codex --version` / 설정에서 확인한다.

Codex는 완료 시점에만 출력하니 **동기 실행**(백그라운드 금지). 최대 ~600s.

**(B) Claude — 자체 축.** Codex를 기다리는 동안(또는 이후) 같은 diff를 직접 정독한다.
Codex가 약한 곳을 특히 본다: 파일 간 정합(예: 두 스크립트의 플래그·상수 대조), 프로젝트
관례 위반, 카탈로그-코드 키 일치, 사용 맥락상 자연스러운 엣지 케이스.

## 3. 대조·종합·검증

- 두 축이 **공통 지적**한 항목 → 신뢰도 높음, 최상단.
- 한쪽만 지적한 항목 → 소스 명시(`[codex]` / `[claude]`)하고 나열.
- **직접 검증이 핵심**: Codex는 knowledge cutoff·코드 오독이 있을 수 있다. 지적을 그대로
  받아쓰지 말고 실제 코드/diff를 열거나 명령을 재현해 확인한 것만 **CONFIRMED**로,
  확인 못 한 건 **PLAUSIBLE**로 구분한다.
- 최종 출력: severity 내림차순 표 1개 + 한 줄 요약. 사용자가 fix 여부 결정.

## 참고

- codex 호출 3종 세트(`</dev/null`·`2>/dev/null`·`--skip-git-repo-check`)는 필수 —
  자세한 규약은 codex 플러그인의 `codex:codex-cli-runtime` 스킬 참고.
- 쓰기 권한(codex `--sandbox workspace-write`)은 리뷰엔 불필요. fix를 Codex에 시키려면
  사용자 승인 후에만.
