# Orca 의존성

이 하네스는 **Orca 안에서** 돌아간다. 둘은 `~/.claude/` 를 공유하므로, 어디까지가 Orca 소유이고
어디부터 하네스 소유인지 알아야 서로를 깨뜨리지 않는다. 이 문서는 그 경계와 실제 의존 지점을
기록한다.

**의존의 성격: 느슨하다.** Orca 쪽 자산은 전부 Orca 가 스스로 설치·관리하고, 하네스는 그것을
*보존*할 뿐이다. Orca 없이도 하네스는 그대로 동작한다(아래 "Orca 없이 쓸 때" 참고).

---

## 1. 훅 — settings.json 공유

Orca 는 자기 훅을 `~/.claude/settings.json` 의 **11개 이벤트**에 심는다. 전부 `matcher: "*"` 이고
같은 스크립트(`~/.orca/agent-hooks/claude-hook.sh`)를 부른다.

| 이벤트 |
|---|
| `SessionStart` · `UserPromptSubmit` · `PreToolUse` · `PostToolUse` · `PostToolUseFailure` |
| `Stop` · `StopFailure` · `SubagentStart` · `SubagentStop` · `TeammateIdle` · `PermissionRequest` |

`claude-hook.sh` 가 하는 일은 하나다: stdin 으로 받은 훅 payload 를
`127.0.0.1:$ORCA_AGENT_HOOK_PORT/hook/claude` 로 POST 한다(토큰·paneKey·worktreeId 동봉,
connect 0.5s / total 1.5s 타임아웃, 실패는 무시).

**Orca 밖에서는 no-op 이다.** `ORCA_AGENT_HOOK_PORT`·`ORCA_AGENT_HOOK_TOKEN`·`ORCA_PANE_KEY`
중 하나라도 없으면 즉시 `exit 0` 하고, `DEVIN_PROJECT_DIR` 가 있으면 아예 빠진다. 그래서 하네스만
쓰는 환경에 이 훅이 남아 있어도 해가 없다.

### 하네스가 지키는 규칙

- **`settings.json` 의 `hooks` 를 손으로 편집하지 않는다.** `scripts/install/merge-hooks.js` 를 쓴다.
- 머저의 소유권 판정은 **"우리가 배포하는 스크립트를 우리 런처로 부르는가"**(`runsHarnessScript`)
  하나다. Orca 훅은 그 조건에 걸리지 않으므로 자동으로 보존된다 — 머저는 Orca 를 *알지* 못하고,
  알 필요도 없다. `tests/scripts/install/merge-hooks.test.js` 가 이 보존을 검증한다.
- 같은 이유로 `id` 접두어(`pre:`·`stop:` 등)는 소유권 근거로 쓰지 않는다. 그건 관례일 뿐이고
  서드파티가 흉내낼 수 있다.

### 확인

```bash
node scripts/install/merge-hooks.js --dry-run   # sweep 목록에 Orca 훅이 없어야 한다
```

---

## 2. 스킬 — `~/.agents/skills/` 에서 링크됨

Orca 는 자기 스킬을 `~/.agents/skills/<name>` 에 두고 `~/.claude/skills/<name>` 으로 링크한다.
5종이고 상시 컨텍스트 비용은 약 **878 tok** (스킬 `description` 기준).

| 스킬 | 비용 | 역할 |
|---|---|---|
| `orchestration` | 239 tok | 여러 에이전트 조정 — threaded message, 블로킹 ask/reply, task DAG, decision gate, coordinator 루프 |
| `orca-cli` | 229 tok | 워크트리·터미널·repo·artifact·임베디드 브라우저 제어. 소유권 핸드오프 |
| `orca-per-workspace-env` | 161 tok | 워크스페이스별 일회용 런타임(클라우드 샌드박스·VM·로컬) 레시피 |
| `computer-use` | 158 tok | 데스크톱 앱 접근성 트리·스크린샷·UI 조작 |
| `find-skills` | 92 tok | 스킬 탐색·설치 |

**하네스 자산이 아니다.** `check-drift` 는 링크 타깃이 이 레포 안인지로 소유권을 판정하므로
(`~/.agents/...` 는 레포 밖) 이 링크들을 orphan 으로 보고하지 않고 `install.sh --uninstall` 도
건드리지 않는다.

---

## 3. 역할 분리 — 겹치는 기능은 한쪽만

| 관심사 | 담당 |
|--------|------|
| 다중 에이전트 오케스트레이션(팬아웃 · DAG · 블로킹 ask/reply · coordinator 루프) | **Orca** (`orchestration`) — 일임. `Workflow` 도구는 쓰지 않는다 |
| 서브에이전트 1회 호출(오케스트레이션 아님, 그냥 도구 호출) | `Agent` 도구 + `subagent:budget` 훅 |
| 워크트리 격리 실행 · 소유권 핸드오프 · 터미널 제어 | **Orca** (`orca-cli`) |
| 한 세션 안의 read-edit-test 반복 | Claude Code + 하네스 optional 훅 스택 (`CLAUDE.md` 의 Loop Control) |
| statusLine | **claude-dashboard 플러그인** (하네스 `harness-statusline.js` 는 2026-08 제거) |
| 세션 재개 | Claude Code 네이티브 `/resume` 또는 Orca 워크트리가 1순위. 하네스 `/save-session`·`/resume-session` 은 *요약된* 컨텍스트를 남기고 싶을 때만 |
| 데스크톱 UI 조작 | Orca 임베디드 브라우저는 `orca-cli`, 그 밖의 앱·웹뷰는 `computer-use` |

하네스가 담당하는 것은 셋뿐이다: **① 취향·언어 규칙(`rules/`) ② 도메인 스킬(`skills/`)
③ 되돌리기 어려운 행위 차단(코어 훅 7개)**. 오케스트레이션·세션 상태·핸드오프는 Orca 에 맡긴다.

---

## 4. Orca 없이 쓸 때

| 잃는 것 | 결과 |
|---|---|
| Orca 훅 11개 | 이미 no-op 이었으므로 변화 없음. `merge-hooks.js --uninstall` 로도 지워지지 않으니(우리 것이 아니다) 손으로 지우려면 `settings.json` 에서 직접 |
| Orca 스킬 5종 | 878 tok 절약. **오케스트레이션을 잃는다** — 워크트리 격리 팬아웃과 coordinator 루프를 대신할 것이 없다. Orca 없이 굳이 하려면 `Workflow` 도구로 컨텍스트 내 팬아웃까지만 가능하고, 그때는 CLAUDE.md 의 "일임" 규칙을 그 환경에 한해 뒤집는 것이다 |
| 워크트리 기반 세션 보존 | Claude Code 네이티브 `/resume`, 또는 하네스 `/save-session`·`/resume-session` |

즉 하네스 자체 기능은 하나도 잃지 않는다. 반대로 **Orca 만 쓰고 하네스를 빼도** Orca 는
정상 동작한다 — 의존은 단방향도 아니고, 양쪽 다 없어도 되는 관계다.

---

## 5. 점검 명령

```bash
# Orca 훅이 settings.json 에 몇 개 있고 하네스 훅과 섞이지 않았는지
node -e "const j=require(process.env.HOME+'/.claude/settings.json');
let o=0,h=0;for(const gs of Object.values(j.hooks||{}))for(const g of gs){
const c=(g.hooks||[]).map(x=>x.command||'').join(' ');c.includes('.orca')?o++:h++}
console.log('Orca',o,'| harness',h)"

# 하네스 머지가 Orca 훅을 건드리지 않는지 (sweep 목록 확인)
node scripts/install/merge-hooks.js --dry-run

# Orca 스킬 링크가 orphan 으로 잡히지 않는지
npm run check-drift
```

---

## 6. 알려진 마찰

- **`obsidian` 플러그인 이중 scope**: project(홈 디렉터리 프로젝트) + user 양쪽에 설치돼 있어 업데이트가
  한쪽만 올라간다(현재 project 1.0.0 / user 1.0.1). `docs/plugin.md` 는 project scope 한정을
  명시한다 — 어느 쪽을 남길지 정해서 한쪽을 제거해야 한다. Orca 와 직접 관계는 없지만 같은
  `~/.claude` 공유 문제라 여기 적어둔다.
- **`TeammateIdle`·`PermissionRequest` 이벤트**: 하네스는 이 두 이벤트에 훅을 붙이지 않는다.
  Orca 전용 이벤트로 두고, 하네스 쪽에서 쓸 일이 생기면 겹침을 먼저 확인할 것.
