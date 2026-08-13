#!/usr/bin/env bash
# install.sh — Symlink this harness into ~/.claude/ by workload.
#
# 자산(agent / command / skill / rule)은 frontmatter `workloads:` 라인으로
# 워크로드 그룹에 분류된다 (없으면 scripts/install/workloads.js 휴리스틱).
# 사용자가 고른 그룹과 교집합인 자산만 심볼릭 링크로 설치한다.
#
# 워크로드 결정은 두 가지 방식 모두 지원한다:
#   A) 대화형 메뉴      — 인자가 없고 TTY 가 있을 때.
#   B) 메뉴 CLI 플래그  — 6개 톱레벨 카테고리(dev/cloud/ai/data/research/writing)와
#                          sub-옵션·상세 플래그.
#                          예: --category=dev,cloud --dev=frontend,python --cloud=infra,finops
#                              --data=mysql,aws-analytics --research=websearch,report
#                          상세(3단계): --writing-social=voice,content (writing.social 상세),
#                              --writing-social=voice,content (writing.social 상세).
#   C) 저수준 플래그    — 워크로드 키를 직접 넣고 싶을 때 (--workload=...).
#
# 저수준 플래그가 들어오면 메뉴는 무시한다.
#
# 그 외 옵션:
#   --dry-run        실제 변경 없이 미리 보기
#   --uninstall      모든 하네스 심볼릭 링크 제거 (선택과 무관하게 전체 정리)
#   --force          기존 파일/링크 덮어쓰기
#   --with-hooks     hooks/hooks.json 을 ~/.claude/settings.json 에 병합.
#                    TTY 면 워크로드 설치 후 hooks·mcp 추가 설치를 물어본다;
#                    이 플래그를 주면 hooks 는 묻지 않고 바로 병합한다.
#   --with-mcp       MCP proxy(mcp-configs/proxy/)를 묻지 않고 바로 docker
#                    compose up -d 로 기동한다. 비대화형(CI)에서도 동작.
#                    docker/데몬/compose 미비 시 경고만 하고 넘어간다.
#   --no-extras      워크로드 외(hooks·mcp) 추가 설치 프롬프트를 건너뛴다.
#                    비대화형(CI)에서는 기본적으로 묻지 않으므로 불필요.
#   --no-core        baseline core 워크로드를 제외 (= --skip-workload=core).
#                    core 는 글로벌(~/.claude)에만 두고 프로젝트 로컬 설치엔
#                    워크로드만 담고 싶을 때. 예:
#                    CLAUDE_HOME=$PWD/.claude ./install.sh --no-core --category=frontend
#   --no-home-link   CLAUDE_HOME 이 ~/.claude 가 아닐 때도 ~/.claude/_harness
#                    보조 링크를 만들지 않음 (자세한 내용은 main() 의 보조 링크
#                    블록 주석을 참고)

set -euo pipefail

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="${CLAUDE_HOME:-$HOME/.claude}"

DRY_RUN=0
UNINSTALL=0
FORCE=0
WITH_HOOKS=0
WITH_MCP=0
NO_EXTRAS=0
NO_HOME_LINK=0
WORKLOAD=""
SKIP_WORKLOAD=""

# 메뉴 모드 인자는 한 번에 select-workloads.js 로 넘기기 위해 그대로 보관.
MENU_ARGS=()

for arg in "$@"; do
    case "$arg" in
        --dry-run)              DRY_RUN=1 ;;
        --uninstall)            UNINSTALL=1 ;;
        --force)                FORCE=1 ;;
        --with-hooks)           WITH_HOOKS=1 ;;
        --with-mcp)             WITH_MCP=1 ;;
        --no-extras)            NO_EXTRAS=1 ;;
        --no-home-link)         NO_HOME_LINK=1 ;;
        --workload=*)           WORKLOAD="${arg#--workload=}" ;;
        --workloads=*)          WORKLOAD="${arg#--workloads=}" ;;
        --skip-workload=*)      SKIP_WORKLOAD="${arg#--skip-workload=}" ;;
        --skip-workloads=*)     SKIP_WORKLOAD="${arg#--skip-workloads=}" ;;
        # 프로젝트 로컬 설치용: baseline core 를 글로벌에만 두고 여기선 뺀다.
        # --skip-workload=core 의 읽기 쉬운 별칭. 둘 다 주면 core 를 합쳐 제외.
        --no-core)              SKIP_WORKLOAD="${SKIP_WORKLOAD:+$SKIP_WORKLOAD,}core" ;;
        --all)                  MENU_ARGS+=("--all") ;;
        --category=*|--dev=*|--cloud=*|--ai=*|--data=*|--research=*|--writing=*|--writing-social=*)
                                MENU_ARGS+=("$arg") ;;
        -h|--help)
            grep '^#' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *) echo "Unknown flag: $arg" >&2; exit 1 ;;
    esac
done

if ! command -v node >/dev/null 2>&1; then
    echo "install.sh requires Node.js, but \`node\` is not on PATH" >&2
    exit 1
fi

# 워크로드 결정:
#   1) --workload / --skip-workload 가 있으면 그 값을 그대로 쓴다 (저수준 모드).
#   2) 아니면 select-workloads.js 를 호출. 메뉴 플래그가 있으면 비대화형으로,
#      없으면 TTY 일 때 대화형, 아니면 --all 로 폴백.
resolve_workloads() {
    if [ -n "$WORKLOAD" ]; then
        return 0
    fi

    local sel_args=("${MENU_ARGS[@]}")
    if [ ${#sel_args[@]} -gt 0 ]; then
        sel_args=("--non-interactive" "${sel_args[@]}")
    fi

    # `local resolved=$(...)` 는 set -e 환경에서도 exit code 를 가린다.
    # 별도 라인으로 캡처하면 노드 스크립트의 실패가 그대로 install.sh 에 전파된다.
    local resolved
    if [ ${#sel_args[@]} -eq 0 ]; then
        resolved="$(node "$HARNESS_DIR/scripts/install/select-workloads.js")" || exit $?
    else
        resolved="$(node "$HARNESS_DIR/scripts/install/select-workloads.js" "${sel_args[@]}")" || exit $?
    fi
    if [ -z "$resolved" ]; then
        echo "[install.sh] select-workloads.js returned no workloads" >&2
        exit 1
    fi
    WORKLOAD="$resolved"
}

# 알려지지 않은 워크로드 키가 들어오지 않도록 select-assets.js 로 사전 검증.
validate_workloads() {
    local validate_args=()
    [ -n "$WORKLOAD" ] && validate_args+=("--workload=$WORKLOAD")
    [ -n "$SKIP_WORKLOAD" ] && validate_args+=("--skip-workload=$SKIP_WORKLOAD")
    if [ ${#validate_args[@]} -gt 0 ]; then
        if ! node "$HARNESS_DIR/scripts/install/select-assets.js" "${validate_args[@]}" >/dev/null; then
            exit 1
        fi
    fi
}

run() {
    if [ "$DRY_RUN" -eq 1 ]; then
        echo "[dry-run] $*"
    else
        eval "$@"
    fi
}

ensure_parent() {
    local target_parent
    target_parent="$(dirname "$1")"
    if [ ! -d "$target_parent" ]; then
        run mkdir -p "\"$target_parent\""
    fi
}

symlink_one() {
    local src_rel="$1"
    local dest_rel="$2"
    local src
    if [ -z "$src_rel" ]; then
        src="$HARNESS_DIR"
    else
        src="$HARNESS_DIR/$src_rel"
    fi
    local dest="$CLAUDE_DIR/$dest_rel"

    if [ ! -e "$src" ]; then
        echo "skip: source missing — $src" >&2
        return
    fi

    ensure_parent "$dest"

    if [ -L "$dest" ] || [ -e "$dest" ]; then
        if [ -L "$dest" ] && [ "$(readlink "$dest")" = "$src" ]; then
            echo "ok:   $dest -> $src"
            return
        fi
        if [ "$FORCE" -eq 1 ]; then
            run rm -rf "\"$dest\""
        else
            echo "skip: $dest already exists (use --force to overwrite)" >&2
            return
        fi
    fi

    run ln -s "\"$src\"" "\"$dest\""
    echo "link: $dest -> $src"
}

unlink_one() {
    local src_rel="$1"
    local dest_rel="$2"
    local src
    if [ -z "$src_rel" ]; then
        src="$HARNESS_DIR"
    else
        src="$HARNESS_DIR/$src_rel"
    fi
    local dest="$CLAUDE_DIR/$dest_rel"

    if [ -L "$dest" ] && [ "$(readlink "$dest")" = "$src" ]; then
        run rm "\"$dest\""
        echo "unlink: $dest"
    fi
    # 하네스가 만들지 않은 링크는 건드리지 않는다 (uninstall 은 best-effort).
}

# 선언(build_selection) 기반 unlink 는 *레포에 아직 있는* 자산만 지운다. 자산을
# 지우거나 옮긴 뒤에 남은 링크(orphan)는 그 목록에 없으므로 영구히 남는다 —
# 링크가 살아 있으면 rule 은 계속 매 세션 로드된다.
#
# 소유권 판정은 디렉토리 이름이 아니라 **링크가 가리키는 곳**으로 한다: 타깃이 이
# 레포 안이면 우리가 만든 링크다. 그래야 `skills/<name>` 처럼 `_harness` 밖에 깔리는
# 자산도 함께 잡히고, 다른 플러그인·수동 링크는 타깃이 레포 밖이라 손대지 않는다.
#
# `run`(eval)을 쓰지 않고 직접 rm 한다 — 여기 경로는 선언이 아니라 파일시스템에서
# 온 것이라 이름에 `$(...)` 가 섞이면 eval 이 그걸 실행해버린다. find 는 -print0,
# rm 은 `--` 로 받아 개행·하이픈이 든 이름도 안전하게 넘긴다.
unlink_orphans() {
    local kind base link target removed=0
    # 설치가 만드는 두 형태만 훑는다. 전 디렉토리를 재귀하면 사용자가 자기 skill
    # *안에* 만든 링크까지 orphan 으로 보고 지워버린다.
    #   1. <kind>/_harness/**  — agents·commands·rules (중첩)
    #   2. <kind>/<name>       — skills (직계 자식 하나)
    # 직계 링크는 skills 뿐이다 — agents·commands·rules 는 _harness/ 아래에만 깔린다.
    # 그 폴더 최상위의 사용자 링크는 우리 것이 아니므로 훑지 않는다.
    for kind in agents/_harness commands/_harness skills/_harness rules/_harness skills; do
        base="$CLAUDE_DIR/$kind"
        [ -d "$base" ] || continue
        # 빈 배열을 쓰지 않는다: macOS 기본 bash 3.2 는 `set -u` 에서 `"${arr[@]}"`
        # 확장을 unbound variable 로 죽이고, 이 find 는 process substitution 안에
        # 있어서 그 실패가 부모에 전파되지 않는다 — 스캔이 조용히 0건이 된다.
        find_links() {
            case "$1" in
                */_harness) find "$1" -type l -print0 2>/dev/null ;;   # 중첩 전부
                *)          find "$1" -maxdepth 1 -type l -print0 2>/dev/null ;;  # 직계만
            esac
        }
        while IFS= read -r -d '' link; do
            target="$(readlink "$link" 2>/dev/null || true)"
            case "$target" in
                # `..` 가 섞이면 문자열 비교로는 레포 안팎을 가릴 수 없다
                # ($HARNESS_DIR/../foreign 은 접두어만 같고 레포 밖이다). 정규화
                # 없이 지우는 대신 건너뛴다 — check-drift 는 경로를 제대로 resolve
                # 하므로 이런 링크도 orphan 으로 보고된다. 설치가 만드는 링크는
                # 항상 절대경로라 실제로는 걸리지 않는다.
                *..*) continue ;;
                "$HARNESS_DIR"|"$HARNESS_DIR"/*) ;;
                *) continue ;;   # 레포 밖(또는 상대경로)을 가리키는 링크는 우리 것이 아니다
            esac
            if [ "$DRY_RUN" -eq 1 ]; then
                echo "[dry-run] rm -- $link"
            else
                rm -- "$link"
            fi
            echo "unlink(orphan): $link"
            removed=$((removed + 1))
        done < <(find_links "$base")
        # 비게 된 하네스 서브디렉토리 정리 (dry-run 에서는 건드리지 않는다)
        case "$kind" in
            */_harness)
                if [ "$DRY_RUN" -eq 0 ]; then
                    find "$base" -depth -type d -empty -exec rmdir {} + 2>/dev/null || true
                fi
                ;;
        esac
    done
    [ "$removed" -gt 0 ] && echo "orphan links removed: $removed"
    return 0
}

merge_hooks() {
    local merge_args=()
    if [ "$DRY_RUN" -eq 1 ]; then merge_args+=("--dry-run"); fi
    if [ "$UNINSTALL" -eq 1 ]; then merge_args+=("--uninstall"); fi
    merge_args+=("--hooks" "$HARNESS_DIR/hooks/hooks.json")
    merge_args+=("--settings" "$CLAUDE_DIR/settings.json")

    echo
    echo "==> Hook merge (settings.json)"
    node "$HARNESS_DIR/scripts/install/merge-hooks.js" "${merge_args[@]}"
}

# 워크로드 외 자산(hooks·mcp)은 워크로드 분류 밖이다. 설치 후 TTY 면 물어본다.
# 비대화형(파이프/CI)이면 묻지 않고 기존 플래그 동작만 따른다.
#   $1 = 프롬프트 문구, 반환 0 = yes
prompt_yes_no() {
    local question="$1"
    # TTY 아님(비대화형) 또는 --no-extras → no
    if [ "$NO_EXTRAS" -eq 1 ] || [ ! -t 0 ]; then
        return 1
    fi
    local reply
    printf '%s [y/N] ' "$question" >&2
    read -r reply || return 1
    case "$reply" in
        [yY]|[yY][eE][sS]) return 0 ;;
        *) return 1 ;;
    esac
}

# mcp 는 proxy-first: 프록시 가능한 서버(github·exa·context7·brave-search·time)는
# mcp-proxy 컨테이너에서 중앙 구동하고, 클라이언트는 localhost:9090 만 바라본다.
# OAuth·브라우저 의존 서버(sentry·playwright 등)는 클라이언트에 로컬로 남긴다.
PROXY_DIR="$HARNESS_DIR/mcp-configs/proxy"

# compose v2 확인 (없으면 brew 로 설치 시도). 반환 0 = 사용 가능.
ensure_compose() {
    if docker compose version >/dev/null 2>&1; then
        return 0
    fi
    echo "  docker compose(v2) 없음."
    if command -v brew >/dev/null 2>&1; then
        echo "  brew install docker-compose 로 설치…"
        run brew install docker-compose
        docker compose version >/dev/null 2>&1 && return 0
    fi
    echo "  compose v2 설치 실패 — https://docs.docker.com/compose/install/ 수동 설치 후 재실행." >&2
    return 1
}

# 프록시를 실제로 기동한다. --dry-run 이면 명령만 출력.
setup_mcp_proxy() {
    echo
    echo "==> MCP proxy (mcp-configs/proxy/)"

    if ! command -v docker >/dev/null 2>&1; then
        echo "  ✗ docker 없음 — MCP proxy 는 docker 컨테이너로 돕니다. 먼저 docker 를 설치하세요:" >&2
        if command -v brew >/dev/null 2>&1; then
            echo "      brew install colima docker docker-compose && colima start   # 경량 (권장)" >&2
            echo "      또는 Docker Desktop: https://docs.docker.com/desktop/" >&2
        else
            echo "      Colima: https://github.com/abiosoft/colima  /  Docker Desktop: https://docs.docker.com/desktop/" >&2
        fi
        echo "  설치 후 다시 실행: ./install.sh --with-mcp" >&2
        echo "  (프록시 없이 쓰려면 .mcp.json 의 localhost:9090 항목을 직접 연결로 바꾸면 됩니다.)" >&2
        return 1
    fi
    if [ "$DRY_RUN" -eq 0 ] && ! docker info >/dev/null 2>&1; then
        echo "  ✗ docker 데몬 미동작 — 데몬을 먼저 켜세요:" >&2
        echo "      colima start   (Colima)   또는   Docker Desktop 실행" >&2
        echo "  그다음 다시 실행: ./install.sh --with-mcp" >&2
        return 1
    fi
    ensure_compose || return 1

    # 시크릿: 셸 rc export 가 우선(빈 .env 를 덮음). rc 에 없으면 proxy/.env 에서 읽음.
    if [ -z "${GITHUB_PAT:-}" ] || [ -z "${BRAVE_API_KEY:-}" ]; then
        echo "  API 키 넣는 법 (하나 택):"
        echo "    1) 셸 rc (권장) — ~/.zshrc 또는 ~/.bashrc 에:"
        echo "         export GITHUB_PAT=\"ghp_...\"      # github.com/settings/tokens"
        echo "         export BRAVE_API_KEY=\"BSA_...\"    # api.search.brave.com/app/keys"
        echo "       그다음 'source ~/.zshrc' 후 이 설치를 다시 실행."
        echo "    2) $PROXY_DIR/.env 에 직접 값 채우기 (.env.example 참고)."
    fi
    if [ ! -f "$PROXY_DIR/.env" ]; then
        run cp "\"$PROXY_DIR/.env.example\"" "\"$PROXY_DIR/.env\""
    fi

    # 선택된 워크로드에 맞는 proxy 서버만 골라 config.json 을 빌드한다.
    # (통짜로 전부 띄우지 않고 필요한 것만 — CLAUDE.md 의 "동시 MCP 10개 이하" 원칙.)
    local build_out compose_profiles="" build_dry=""
    [ "$DRY_RUN" -eq 1 ] && build_dry="--dry-run"
    build_out="$(node "$HARNESS_DIR/scripts/install/build-mcp-config.js" --workload="$WORKLOAD" $build_dry 2>&1)" || true
    echo "$build_out" | sed 's/^/  /'
    # terraform 서버가 선택되면 compose 의 terraform-mcp profile 도 켠다.
    if printf '%s' "$build_out" | grep -q "terraform 선택됨"; then
        compose_profiles="--profile terraform"
    fi

    echo "  docker compose up -d …"
    run docker compose $compose_profiles -f "\"$PROXY_DIR/docker-compose.yaml\"" --project-directory "\"$PROXY_DIR\"" up -d

    echo "  프록시 서버 → http://localhost:9090/<서버>/mcp (선택된 워크로드 기준, 위 목록 참고)."
    echo "  로컬 유지: sentry(OAuth)·playwright(브라우저) — .mcp.json 에 직접."
    echo "  시크릿(GITHUB_PAT·BRAVE_API_KEY·OBSIDIAN_API_KEY)은 $PROXY_DIR/.env 한 곳에만."
    echo "  확인: curl -i http://localhost:9090/time/mcp  (405 계열이면 정상 기동)"
}

# 자산 선택 출력. uninstall 일 때는 *모든* 자산을 순회해서 이전(더 넓은) 설치
# 흔적까지 정리한다.
build_selection() {
    local args=()
    if [ "$UNINSTALL" -eq 0 ]; then
        [ -n "$WORKLOAD" ] && args+=("--workload=$WORKLOAD")
        [ -n "$SKIP_WORKLOAD" ] && args+=("--skip-workload=$SKIP_WORKLOAD")
    fi
    if [ ${#args[@]} -eq 0 ]; then
        node "$HARNESS_DIR/scripts/install/select-assets.js"
    else
        node "$HARNESS_DIR/scripts/install/select-assets.js" "${args[@]}"
    fi
}

# 1단계: 글로벌 baseline 설치 상태를 보고한다 (check-global.js).
#   absent   — 매니페스트/루트링크 없음 → 신규 설치 진행
#   outdated — 설치된 버전 < repo VERSION → 갱신 진행
#   current  — 최신 → 그대로(멱등 재링크)
# 심볼릭 설치는 멱등이라 세 경우 모두 아래 링크 루프를 그대로 태운다.
# 여기서는 사용자에게 상태만 알린다.
report_global_state() {
    local json state installed repo
    json="$(node "$HARNESS_DIR/scripts/install/check-global.js" --claude-home="$CLAUDE_DIR" --root="$HARNESS_DIR" 2>/dev/null)" || return 0
    state="$(printf '%s' "$json" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{console.log(JSON.parse(d).state)}catch{console.log("")}})' 2>/dev/null)"
    installed="$(printf '%s' "$json" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{console.log(JSON.parse(d).installedVersion||"")}catch{console.log("")}})' 2>/dev/null)"
    repo="$(printf '%s' "$json" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{console.log(JSON.parse(d).repoVersion||"")}catch{console.log("")}})' 2>/dev/null)"
    echo "==> Global baseline: ${state:-unknown} (installed: ${installed:-none}, repo: ${repo:-?})"
    case "$state" in
        absent)   echo "    글로벌 하네스 없음 — 신규 설치합니다." ;;
        outdated) echo "    설치된 버전이 오래됨 — 갱신합니다 (필요 시 --force)." ;;
        current)  echo "    최신 상태 — 선택한 워크로드만 반영합니다." ;;
    esac
}

# 설치 종료 후 매니페스트를 기록한다 (다음 실행의 버전/상태 판정 근거).
write_manifest() {
    [ "$DRY_RUN" -eq 1 ] && { echo "[dry-run] write manifest ($CLAUDE_DIR)"; return 0; }
    local repo
    repo="$(cat "$HARNESS_DIR/VERSION" 2>/dev/null | tr -d '[:space:]')"
    node "$HARNESS_DIR/scripts/install/manifest.js" write \
        --claude-home="$CLAUDE_DIR" \
        --version="$repo" \
        --workloads="$WORKLOAD" 2>/dev/null \
        && echo "manifest: $CLAUDE_DIR/_harness-manifest.json (v${repo}, workloads: ${WORKLOAD:-<all>})"
}

main() {
    if [ ! -d "$CLAUDE_DIR" ]; then
        echo "Claude config dir not found: $CLAUDE_DIR" >&2
        echo "Set CLAUDE_HOME or create it first." >&2
        exit 1
    fi

    if [ "$UNINSTALL" -eq 0 ]; then
        report_global_state
        echo
        resolve_workloads
        validate_workloads
        echo "workloads: ${WORKLOAD:-<all>}${SKIP_WORKLOAD:+ (skip: $SKIP_WORKLOAD)}"
    fi
    echo

    # repo root 를 $CLAUDE_DIR/_harness 로 링크.
    # hooks.json 의 inline bootstrap 은 다음 순서로 harness root 를 찾는다:
    #   1) $CLAUDE_PLUGIN_ROOT (claude-code 가 직접 주입)
    #   2) $CLAUDE_PROJECT_DIR/.claude/_harness, $CLAUDE_PROJECT_DIR/.claude
    #   3) $HOME/.claude, $HOME/.claude/_harness, $HOME/.claude/plugins/_harness
    # CLAUDE_HOME 을 통해 프로젝트 로컬 설치한 경우라면 (2) 가 잡아준다.
    if [ "$UNINSTALL" -eq 1 ]; then
        unlink_one "" "_harness"
    else
        symlink_one "" "_harness"
    fi

    # 보조 링크: 일부 환경 (CLAUDE_PROJECT_DIR 미주입, 또는 inline bootstrap 이
    # 갱신되지 않은 기존 settings.json 사용) 에서는 여전히 ~/.claude/_harness 만
    # 본다. CLAUDE_HOME 이 ~/.claude 가 아니고 hooks 도 같이 머지하는 경우라면
    # 안전망으로 ~/.claude/_harness 를 함께 만들어둔다. --no-home-link 로 끌 수 있다.
    if [ "$UNINSTALL" -eq 0 ] && [ "$WITH_HOOKS" -eq 1 ] \
       && [ "$NO_HOME_LINK" -eq 0 ] && [ "$CLAUDE_DIR" != "$HOME/.claude" ]; then
        home_link="$HOME/.claude/_harness"
        if [ ! -e "$home_link" ] && [ ! -L "$home_link" ]; then
            echo
            echo "note: \$CLAUDE_HOME=$CLAUDE_DIR (not \$HOME/.claude)."
            echo "note: creating safety link $home_link -> $HARNESS_DIR"
            echo "note: (re-run with --no-home-link to skip)"
            run mkdir -p "\"$HOME/.claude\""
            run ln -s "\"$HARNESS_DIR\"" "\"$home_link\""
        fi
    fi

    while IFS=$'\t' read -r kind src_rel dest_rel; do
        [ -z "$kind" ] && continue
        if [ "$UNINSTALL" -eq 1 ]; then
            unlink_one "$src_rel" "$dest_rel"
        else
            symlink_one "$src_rel" "$dest_rel"
        fi
    done < <(build_selection)

    # uninstall 은 선언에 없는 잔여 링크까지 쓸어야 완결된다.
    if [ "$UNINSTALL" -eq 1 ]; then
        unlink_orphans
    fi

    # ── 워크로드 외 자산(hooks·mcp) ───────────────────────────────────────
    # uninstall: hooks 도 함께 제거. install: --with-hooks / --with-mcp 면
    # 각각 묻지 않고 바로 실행. 그 외엔 TTY 일 때 물어본다(--no-extras / 비대화형은 skip).
    local hooks_done=0
    local mcp_done=0
    if [ "$UNINSTALL" -eq 1 ]; then
        merge_hooks || true
    else
        # --with-hooks / --with-mcp 는 프롬프트 없이 바로 실행 (비대화형에서도 동작).
        if [ "$WITH_HOOKS" -eq 1 ]; then
            merge_hooks || true
            hooks_done=1
        fi
        if [ "$WITH_MCP" -eq 1 ]; then
            setup_mcp_proxy || true
            mcp_done=1
        fi
        # 남은 항목은 TTY 이고 --no-extras 아닐 때만 물어본다.
        if [ "$NO_EXTRAS" -eq 0 ] && [ -t 0 ] \
            && { [ "$hooks_done" -eq 0 ] || [ "$mcp_done" -eq 0 ]; }; then
            echo
            echo "──> 워크로드 외 추가 설치 (선택)"
            if [ "$hooks_done" -eq 0 ] \
                && prompt_yes_no "hooks 를 settings.json 에 병합할까요? (포맷·품질·세션 훅)"; then
                merge_hooks || true
                hooks_done=1
            fi
            if [ "$mcp_done" -eq 0 ] \
                && prompt_yes_no "MCP proxy 를 지금 설치·기동할까요? (docker compose up -d)"; then
                setup_mcp_proxy || true
                mcp_done=1
            fi
        fi
    fi

    if [ "$UNINSTALL" -eq 1 ]; then
        # 비어 있는 _harness 컨테이너만 정리. 사용자 자산은 안 건드림.
        # dry-run 은 부작용이 없어야 하므로 실제 삭제는 건너뛴다.
        for sub in agents commands skills rules; do
            local container="$CLAUDE_DIR/$sub/_harness"
            if [ -d "$container" ] && [ "$DRY_RUN" -eq 0 ]; then
                find "$container" -type d -empty -delete 2>/dev/null || true
            fi
        done
        # 매니페스트 제거 (설치 흔적 정리).
        if [ "$DRY_RUN" -eq 0 ]; then
            rm -f "$CLAUDE_DIR/_harness-manifest.json" 2>/dev/null || true
        fi
    fi

    if [ "$UNINSTALL" -eq 0 ]; then
        write_manifest
        echo
        if [ "$hooks_done" -eq 1 ]; then
            echo "Done. Symlinks installed and hooks merged into \$CLAUDE_DIR/settings.json."
        else
            echo "Done. Symlinks installed. Hooks NOT merged — re-run with --with-hooks"
            echo "(or answer yes to the hooks prompt) to enable them."
        fi
    fi
}

main
