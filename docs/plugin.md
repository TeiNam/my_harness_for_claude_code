# 동반 플러그인

하네스 설치 스크립트는 플러그인을 **건드리지 않는다** (`install.sh` 는 agent·command·skill·rule
심볼릭 링크와 hooks·mcp 프롬프트까지만 담당). 아래 명령은 손으로 실행한다.

설치된 6종의 상시 컨텍스트 비용은 스킬 `description` 합계 약 4.0k tok 이다
(`claude plugin details <name>` 으로 개별 확인).

  # 1) superpowers — anthropics 공식 마켓플레이스 (~584 tok)
  claude plugin marketplace add anthropics/claude-plugins-official
  claude plugin install superpowers@claude-plugins-official

  # 2) ponytail (~676 tok)
  claude plugin marketplace add DietrichGebert/ponytail
  claude plugin install ponytail@ponytail

  # 3) codex (OpenAI 공식) (~327 tok)
  claude plugin marketplace add openai/codex-plugin-cc
  claude plugin install codex@openai-codex

  # 4) ui-ux-pro-max (~720 tok)
  claude plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
  claude plugin install ui-ux-pro-max@ui-ux-pro-max-skill

  # 5) claude-dashboard — statusLine 담당 (하네스 harness-statusline.js 는 2026-08 제거) (~89 tok)
  claude plugin marketplace add uppinote20/claude-dashboard
  claude plugin install claude-dashboard@claude-dashboard

  # 6) easy-rdbms — 하네스에서 분리한 RDBMS 자산의 도착지 (~1,603 tok)
  #    bcb4bcb 에서 제거한 mysql-guideline·postgres-guideline·database-migrations·
  #    rdbms-data-modeler 가 여기로 갔다. RDBMS 작업을 하지 않는 기간에는 빼도 된다
  #    (6종 중 상시 비용이 가장 크다 — 나머지 5종 합계의 2/3).
  claude plugin marketplace add TeiNam/easy-rdbms
  claude plugin install easy-rdbms@easy-rdbms

# ── 설치하지 않는 것 ──
#
# 하네스 스킬과 이중 노출 (하네스 쪽을 SSOT 로 유지):
#   humanize-korean@im-not-ai                → 하네스 skills/humanize-korean 이 SSOT (2026-09-02 상류 v2.3.2 동기화)
#   frontend-design@claude-plugins-official   → 하네스 skills/frontend-design 과 동일 출처(anthropics/skills)
#   둘 다 2026-07-26 제거.
#
# 워크로드와 무관 (2026-08-14 제거, 마켓플레이스 등록·캐시까지 정리):
#   motion-creative@motion-mcp     → 광고 크리에이티브 분석. 17스킬 395 tok.
#                                    2026-07-26 제거했다가 재설치돼 있던 것을 다시 걷어냈다.
#   scroll-world@scroll-world      → 스크롤 시네마틱 랜딩. 1스킬 4 tok.
#                                    랜딩페이지는 하네스 taste/redesign/soft/output-skill 이 담당.
#   rust-analyzer-lsp@claude-plugins-official → LSP 서버(스킬 0개라 컨텍스트 비용은 없었다).
#                                    Rust 작업에서 쓰지 않아 제거.
#
# 2026-08-30 제거 (마켓플레이스 등록·캐시까지 정리):
#   obsidian@obsidian-skills       → 이전에는 유일하게 project scope 로 두던 것(홈 디렉터리 프로젝트
#                                    한정)인데, user·project 양쪽에 설치돼 있던 드리프트를 걷어내면서
#                                    플러그인 자체를 내렸다. Obsidian 작업은 MCP 서버 `obsidian` 이
#                                    담당하고 그쪽은 플러그인과 무관하게 그대로 살아 있다.
#   andrej-karpathy-skills@karpathy-skills → 스킬 1개(`karpathy-guidelines`)뿐인 플러그인.
#                                    "Think Before Coding / Simplicity First / Surgical Changes /
#                                    Goal-Driven Execution" 인데 ponytail(YAGNI·최단 해법 강제)과
#                                    역할이 겹친다. 2026-08-22 설치 후 줄곧 disabled 였다.
#
# 고아 마켓플레이스: 없다. skill-codex(skills-directory/skill-codex) 는 설치된 플러그인이 없던
# 등록만 남은 상태였고 obsidian-skills·karpathy-skills 와 함께 2026-08-30 정리했다.

# ── 점검 ──
#   claude plugin list                  설치 목록 + scope + enabled 여부
#   claude plugin details <name>        컴포넌트 인벤토리 + 예상 토큰 비용
#   claude plugin marketplace list      등록된 마켓플레이스 (고아 확인용)
#
# 세 층이 다 일치해야 정상이다 — 위 목록 / `~/.claude/plugins/marketplaces/` /
# `~/.claude/plugins/cache/`. uninstall 후에도 cache 디렉터리가 남는 경우가 있어 따로 본다.

# ── 트러블슈팅: 홈 경로 손상으로 전부 cache-miss (2026-08-30) ──
#
# 증상: `claude plugin list` 가 설치된 플러그인 전부를 이렇게 표시한다.
#   Status: ✘ failed to load
#   Error: Marketplace <name> failed to load: cache-miss
#
# 원인: 플러그인 메타데이터가 홈 경로를 잘린 사용자명으로 기록한 것. 존재하지 않는 디렉터리를
# 가리키므로 페이로드를 찾지 못하고 `~/.claude/plugins/cache/` 가 비어 있게 된다. 손상 지점 3곳:
#   ~/.claude/plugins/known_marketplaces.json   installLocation
#   ~/.claude/plugins/installed_plugins.json    installPath, projectPath
#   ~/.claude/settings.json                     statusLine.command (claude-dashboard 용)
#
# 복구: `marketplace update` 는 "corrupted installLocation … Run `claude plugin marketplace remove`
# and re-add it" 을 안내하지만, remove + re-add 는 설치 기록까지 날린다. 두 JSON 의 경로를 직접
# 고치는 편이 짧고 안전하다(백업 먼저).
#   cd ~/.claude/plugins
#   cp -p known_marketplaces.json known_marketplaces.json.bak
#   cp -p installed_plugins.json  installed_plugins.json.bak
#   sed -i '' 's|/Users/<잘린이름>/|/Users/<올바른이름>/|g; s|"/Users/<잘린이름>"|"/Users/<올바른이름>"|g' \
#     known_marketplaces.json installed_plugins.json
#   node -e 'for (const f of ["known_marketplaces.json","installed_plugins.json"]) JSON.parse(require("fs").readFileSync(f,"utf8"))'
#   claude plugin marketplace update      # 이름 없이 부르면 등록된 전부를 갱신한다
#
# statusLine 은 자동 복구되지 않는다 — 별도로 손대야 한다. claude-dashboard 의
# `hooks/ensure-statusline.mjs` 는 `statusLine.command` 가 **옛 pinned 형태**
# (`plugins/cache/claude-dashboard/claude-dashboard/<ver>/dist/index.js`) 일 때만 고쳐 쓴다.
# 이미 shim 형태(`plugins/data/claude-dashboard-claude-dashboard/statusline.mjs`) 면 경로가
# 깨져 있어도 "이미 마이그레이션됨"으로 보고 건너뛴다(`migrateStatusLine` → 'skipped').
# 그래서 `settings.json` 의 `statusLine.command` 경로는 손으로 고치고, shim 파일 자체는
# SessionStart 훅을 한 번 돌려 만든다.
#   D=~/.claude/plugins/cache/claude-dashboard/claude-dashboard/<ver>
#   CLAUDE_PLUGIN_ROOT="$D" \
#   CLAUDE_PLUGIN_DATA="$HOME/.claude/plugins/data/claude-dashboard-claude-dashboard" \
#     node "$D/hooks/ensure-statusline.mjs"
#
# 복구 후에는 **새 세션이 필요하다.** 스킬·커맨드·statusLine 은 세션 시작 시점에 로드되므로,
# 깨진 상태로 시작한 세션에는 붙지 않는다.
#
# 곁다리로 나온 것: 같은 손상이 `settings.json` 의 `env.NODE_EXTRA_CA_CERTS` 에도 있었다.
# 죽은 경로를 가리키면 `claude` 호출마다 "Ignoring extra certs … load failed" 경고가 찍힌다.
# 플러그인과 무관한 설정이므로 함께 고치지 말고 따로 판단할 것.
