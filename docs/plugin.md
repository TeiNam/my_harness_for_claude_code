# 동반 플러그인

하네스 설치 스크립트는 플러그인을 **건드리지 않는다** (`install.sh` 는 agent·command·skill·rule
심볼릭 링크와 hooks·mcp 프롬프트까지만 담당). 아래 명령은 손으로 실행한다.

설치된 6종의 상시 컨텍스트 비용은 스킬 `description` 합계 약 3.4k tok 이다
(`claude plugin details <name>` 으로 개별 확인).

  # 1) superpowers — anthropics 공식 마켓플레이스
  claude plugin marketplace add anthropics/claude-plugins-official
  claude plugin install superpowers@claude-plugins-official

  # 2) ponytail
  claude plugin marketplace add DietrichGebert/ponytail
  claude plugin install ponytail@ponytail

  # 3) codex (OpenAI 공식)
  claude plugin marketplace add openai/codex-plugin-cc
  claude plugin install codex@openai-codex

  # 4) ui-ux-pro-max
  claude plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
  claude plugin install ui-ux-pro-max@ui-ux-pro-max-skill

  # 5) claude-dashboard — statusLine 담당 (하네스 harness-statusline.js 는 2026-08 제거)
  claude plugin marketplace add uppinote20/claude-dashboard
  claude plugin install claude-dashboard@claude-dashboard

  # 6) obsidian — 유일하게 project scope (홈 디렉터리 프로젝트 한정)
  claude plugin marketplace add kepano/obsidian-skills
  claude plugin install obsidian@obsidian-skills --scope project

# ── 설치하지 않는 것 ──
#
# 하네스 스킬과 이중 노출 (하네스 쪽을 SSOT 로 유지):
#   humanize-korean@im-not-ai                → 하네스 skills/humanize-korean 이 v1.6.1 로 더 최신
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
# 등록만 남은 고아 마켓플레이스: skill-codex (skills-directory/skill-codex) — 설치된
# 플러그인이 없다. 쓸 계획이 없으면 `claude plugin marketplace remove skill-codex`.

# ── 점검 ──
#   claude plugin list                  설치 목록 + scope + enabled 여부
#   claude plugin details <name>        컴포넌트 인벤토리 + 예상 토큰 비용
#   claude plugin marketplace list      등록된 마켓플레이스 (고아 확인용)
