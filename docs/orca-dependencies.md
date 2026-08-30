# Orca 의존성

이 하네스는 **Orca 안에서** 돌아간다. 둘은 `~/.claude/` 를 공유하므로, 어디까지가 Orca 소유이고
어디부터 하네스 소유인지 알아야 서로를 깨뜨리지 않는다. 이 문서는 그 경계와 실제 의존 지점을
기록한다.

**의존의 성격: 느슨하다.** Orca 쪽 자산은 전부 Orca 가 스스로 설치·관리하고, 하네스는 그것을
*보존*할 뿐이다. Orca 없이도 하네스는 그대로 동작한다(아래 "Orca 없이 쓸 때" 참고).

---

## 1. 훅 — settings.json 공유

Orca 는 자기 훅을 `~/.claude/settings.json` 의 **12개 이벤트**에 심는다. 전부 `matcher: "*"` 이고
같은 스크립트(`~/.orca/agent-hooks/claude-hook.sh`)를 부른다.

| 이벤트 |
|---|
| `SessionStart` · `UserPromptSubmit` · `PreToolUse` · `PostToolUse` · `PostToolUseFailure` |
| `Stop` · `StopFailure` · `SubagentStart` · `SubagentStop` · `TeammateIdle` · `PermissionRequest` |
| `PostCompact` (2026-08 확인 — 예전 11개 표에는 없었다) |

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
| 다중 에이전트 오케스트레이션(팬아웃 · DAG · 블로킹 ask/reply · coordinator 루프) | **Orca** (`orchestration`) **전담.** `Workflow` 툴은 `~/.claude/settings.json` 의 `enableWorkflows: false` 로 아예 내렸다(`ultracode: false`) — 환경 분기 대신 설정 한 줄이다 |
| 서브에이전트 1회 호출(오케스트레이션 아님, 그냥 도구 호출) | `Agent` 도구 — **`fork` 우선**, 역할이 필요할 때만 cold 에이전트. 공통 규율은 `subagent:budget` 훅 (§4) |
| 워크트리 격리 실행 · 소유권 핸드오프 · 터미널 제어 | **Orca** (`orca-cli`) |
| 한 세션 안의 read-edit-test 반복 | Claude Code + 하네스 optional 훅 스택 (`docs/hooks-policy.md` 의 루프 제어 표). 단일 세션 루프라 오케스트레이션이 아니다 — `/loop-start`·`/loop-status`·`loop-operator` 는 하네스에 남는다 |
| statusLine | **claude-dashboard 플러그인** (하네스 `harness-statusline.js` 는 2026-08 제거) |
| 세션 재개 | Claude Code 네이티브 `/resume` 또는 Orca 워크트리가 1순위. 하네스 `/save-session`·`/resume-session` 은 *요약된* 컨텍스트를 남기고 싶을 때만 |
| 데스크톱 UI 조작 | Orca 임베디드 브라우저는 `orca-cli`, 그 밖의 앱·웹뷰는 `computer-use` |
| 브라우저 자동화(탐색·클릭·스냅샷·JS 평가) | **Orca 안**: `orca-cli` — `tab create/switch/close` · `goto` · `snapshot`(element ref) · `click`/`fill`/`type` · `eval` · `screenshot` · `wait` + **세션 프로필**(로그인 상태 유지). playwright MCP 는 쓰지 않는다(기능 중복). **Orca 밖**에서만 playwright MCP 를 등록한다 |
| E2E 테스트 작성·실행 | Playwright **테스트 러너**(`npx playwright test`) — MCP 가 아니다. `agents/e2e-runner` 는 Agent Browser 우선, 그다음 이 CLI 다 |

하네스가 담당하는 것은 셋뿐이다: **① 취향·언어 규칙(`rules/`) ② 도메인 스킬(`skills/`)
③ 되돌리기 어려운 행위 차단(코어 훅 2개 — `pre:bash:dispatcher`·`subagent:budget`)**. 오케스트레이션·세션 상태·핸드오프는 Orca 에 맡긴다.

---

## 4. 서브에이전트에 하네스를 상속시키기

`Agent` 호출은 오케스트레이션이 아니라 도구 호출이라 Orca 안에서도 그대로 쓴다. 관건은
**하네스가 그 서브에이전트까지 따라가는지**인데, 상속되는 것과 안 되는 것이 갈린다.

| 항목 | `fork` | cold 커스텀 에이전트 |
|---|---|---|
| 대화 히스토리 | 상속 | ✗ (위임 프롬프트만) |
| 시스템 프롬프트 · 툴 풀 | 부모와 동일 | 에이전트 파일 것으로 **교체** |
| 모델 · effort | 부모 고정(`model` override 무시) | `model:` 필드 |
| CLAUDE.md 계층 + `rules/` | 상속 | **상속됨** — 내장 `Explore`·`Plan` 둘만 예외이고 frontmatter 로 바꿀 수 없다 |
| 스킬 본문 | 상속 | ✗ → `skills:` frontmatter 로 preload |
| SessionStart 훅 컨텍스트 | ✗ | ✗ → `SubagentStart` 훅으로 주입 |
| 프롬프트 캐시 | 부모와 공유(그래서 cold 보다 싸다) | 별도 |
| 중첩 | fork 는 fork 를 못 만든다 | 가능하지만 `subagent:budget` 이 leaf 로 못박는다 |

종속 레버는 4개다:

1. **CLAUDE.md 계층 + `rules/`** — 자동. 프로젝트를 가리지 않는 전역 규칙을 서브에이전트까지
   내리려면 `~/.claude/CLAUDE.md` 에 둔다(현재 없음). `rules/` 는 설치가 링크한다.
2. **`skills:` frontmatter** — 에이전트가 쓸 스킬 본문(description 이 아니라 **전문**)을 preload
   한다. `agents/` 46종 중 **38종에 적용**(2026-08-30) — 나머지 8종은 lab 메타 에이전트 6종
   (lab 만 설치했을 때 preload 가 깨진다)과 매칭되는 rubric 스킬이 없는 2종(`tdd-guide`
   — TDD 는 superpowers 플러그인 담당, `quick-rules-integrator`)이다. 규칙은
   `docs/rules-reference/agents.md` → Frontmatter Conventions.
3. **`SubagentStart` 훅** — `subagent:budget` 이 예산·탐색 규율을 모든 서브에이전트에 주입한다
   (SessionStart 컨텍스트가 상속되지 않기 때문에 존재하는 훅이다). 훅은 늘릴 대상이 아니므로
   규칙을 더 얹기 전에 `rules/` 나 에이전트 프롬프트로 되는지 먼저 본다.
4. **`memory:` frontmatter** — 에이전트별 영속 메모리(`~/.claude/agent-memory/<name>/`). 사용 0건.

### 플러그인은 어떻게 상속되나

| 플러그인이 주는 것 | 서브에이전트 도달 |
|---|---|
| 스킬 | `tools:` 에 **`Skill` 이 있어야** 호출된다(46종 전부 보유, 2026-08-30). rubric 이면 `skills:` 로 preload |
| SessionStart·UserPromptSubmit 훅으로 심는 규율 | **도달하지 않는다.** 플러그인이 자체 `SubagentStart` 훅을 갖고 있어야 한다 — ponytail 4.9.0 은 `ponytail-subagent.js`(upstream #252)로 직접 넣으므로 하네스는 그 룰셋을 **복제하지 않는다** |
| 에이전트(`codex:codex-rescue` 등) | 서브에이전트는 leaf 라 재위임 불가 — 메인 세션에서 부른다 |
| 슬래시 커맨드 | 서브에이전트는 실행하지 않는다 |

**ponytail 은 상시 켜둔다.** 플러그인 자체 기본값도 `full` 이지만(`ponytail-config.js` 의
`DEFAULT_MODE`), 드리프트를 막기 위해 `~/.claude/settings.json` 의
`env.PONYTAIL_DEFAULT_MODE = "full"` 로 **고정**했다(env 가 config·기본값보다 우선).
세션 중 `off` 로 바꿔도 다음 SessionStart 에서 다시 `full` 로 복귀한다. 하네스의
`subagent:budget` 은 같은 값을 **off 스위치로만** 읽으므로 양쪽 판정이 어긋나지 않는다.

2026-08-30 한때 ponytail 이 죽어 보인 적이 있는데(`~/.claude/.ponytail-active` 없음, 스킬 목록에
플러그인 스킬 0개) 원인은 mode 가 아니라 **플러그인 전체 로드 실패**였다 — 홈 경로가 잘린
사용자명으로 기록돼 6개 플러그인이 전부 `cache-miss` 였다. 하네스 심볼릭 링크 218개가 같은 날
끊긴 것과 **동일한 원인**이다. 복구 절차는 `docs/plugin.md` 의 트러블슈팅 절.

### Opus 5 에 내장된 제한

Opus 5 프롬프트 번들에는 "사용자가 요청하지 않으면 Agent 툴·workflow 를 쓰지 말라"가
하드코딩돼 있다(Claude Code 2.1.236 바이너리에서 확인 — 모델이 `opus_5_prompt_bundle` 을
가질 때 주입되고 원격 플래그로만 교체된다. `settings.json` 으로는 못 끈다). 하네스도 Orca 도
넣은 것이 아니다. 탈출구는 문구 자체에 있다 — **"unless the user requested it"**. 그래서
CLAUDE.md 의 "서브에이전트는 fork 우선" 표가 그 상시 요청 역할을 한다.

---

## 5. Orca 없이 쓸 때

| 잃는 것 | 결과 |
|---|---|
| Orca 훅 12개 | 이미 no-op 이었으므로 변화 없음. `merge-hooks.js --uninstall` 로도 지워지지 않으니(우리 것이 아니다) 손으로 지우려면 `settings.json` 에서 직접 |
| Orca 스킬 5종 | 878 tok 절약. 팬아웃이 필요해지면 `~/.claude/settings.json` 의 `enableWorkflows` 를 켠다 — **컨텍스트 내 팬아웃까지만** 되고 워크트리 격리·블로킹 ask/reply·worker_done 대기는 그래도 못 얻는다 |
| 워크트리 기반 세션 보존 | Claude Code 네이티브 `/resume`, 또는 하네스 `/save-session`·`/resume-session` |

즉 하네스 자체 기능은 하나도 잃지 않는다. 반대로 **Orca 만 쓰고 하네스를 빼도** Orca 는
정상 동작한다 — 의존은 단방향도 아니고, 양쪽 다 없어도 되는 관계다.

---

## 6. 점검 명령

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

# settings.json 이 하네스 기준에 맞는지 (프로파일·죽은 env·평문 비밀값 사본)
npm run optimize-settings
```

`optimize-settings` 는 `env` 와 `settings.json.bak.*` 만 본다 — `hooks` 는 손대지 않으므로
Orca 훅과 마주치지 않는다. Orca 가 쓰는 `ORCA_*` env 는 `HARNESS_*` 가 아니라서 판정 대상 밖이다.

---

## 7. 알려진 마찰

- ~~**`obsidian` 플러그인 이중 scope**~~: **2026-08-30 해소** — 플러그인 자체를 제거했다(`docs/plugin.md`).
  기록해둘 함정 하나: 홈 디렉터리(`~`)가 project 인 구성에서는 project 설정 파일이 user 의
  `~/.claude/settings.json` 과 **같은 파일**이라, `--scope project` uninstall 이 `enabledPlugins`
  에서 키를 통째로 지워 user scope 설치까지 disabled 로 떨어뜨린다. 한쪽만 남길 생각이면
  uninstall 후 `claude plugin enable <plugin> --scope user` 로 되살려야 한다.
  Obsidian 작업 자체는 MCP 서버 `obsidian` 이 담당하고 플러그인과 무관하게 유지된다.
- **`TeammateIdle`·`PermissionRequest` 이벤트**: 하네스는 이 두 이벤트에 훅을 붙이지 않는다.
  Orca 전용 이벤트로 두고, 하네스 쪽에서 쓸 일이 생기면 겹침을 먼저 확인할 것.
