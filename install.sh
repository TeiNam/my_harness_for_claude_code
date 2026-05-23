#!/usr/bin/env bash
# install.sh — Symlink this harness into ~/.claude/ by workload.
#
# 자산(agent / command / skill / rule)은 frontmatter `workloads:` 라인으로
# 워크로드 그룹에 분류된다 (없으면 scripts/install/workloads.js 휴리스틱).
# 사용자가 고른 그룹과 교집합인 자산만 심볼릭 링크로 설치한다.
#
# 워크로드 결정은 두 가지 방식 모두 지원한다:
#   A) 대화형 메뉴      — 인자가 없고 TTY 가 있을 때.
#   B) 메뉴 CLI 플래그  — 6개 톱레벨 카테고리와 sub-옵션 플래그.
#                          예: --category=backend,writing --backend=python,cloud
#                              --data-design=mysql
#   C) 저수준 플래그    — 워크로드 키를 직접 넣고 싶을 때 (--workload=...).
#
# 저수준 플래그가 들어오면 메뉴는 무시한다.
#
# 그 외 옵션:
#   --dry-run        실제 변경 없이 미리 보기
#   --uninstall      모든 하네스 심볼릭 링크 제거 (선택과 무관하게 전체 정리)
#   --force          기존 파일/링크 덮어쓰기
#   --with-hooks     hooks/hooks.json 을 ~/.claude/settings.json 에 병합

set -euo pipefail

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="${CLAUDE_HOME:-$HOME/.claude}"

DRY_RUN=0
UNINSTALL=0
FORCE=0
WITH_HOOKS=0
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
        --workload=*)           WORKLOAD="${arg#--workload=}" ;;
        --workloads=*)          WORKLOAD="${arg#--workloads=}" ;;
        --skip-workload=*)      SKIP_WORKLOAD="${arg#--skip-workload=}" ;;
        --skip-workloads=*)     SKIP_WORKLOAD="${arg#--skip-workloads=}" ;;
        --all)                  MENU_ARGS+=("--all") ;;
        --category=*|--backend=*|--frontend=*|--plugin=*|--data-analysis=*|--data-design=*|--writing=*)
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

main() {
    if [ ! -d "$CLAUDE_DIR" ]; then
        echo "Claude config dir not found: $CLAUDE_DIR" >&2
        echo "Set CLAUDE_HOME or create it first." >&2
        exit 1
    fi

    if [ "$UNINSTALL" -eq 0 ]; then
        resolve_workloads
        validate_workloads
        echo "workloads: ${WORKLOAD:-<all>}${SKIP_WORKLOAD:+ (skip: $SKIP_WORKLOAD)}"
    fi
    echo

    # 항상 repo root 를 링크 — hooks.json 의 inline bootstrap 이
    # ~/.claude/_harness/scripts/lib/utils.js 를 찾는다.
    if [ "$UNINSTALL" -eq 1 ]; then
        unlink_one "" "_harness"
    else
        symlink_one "" "_harness"
    fi

    while IFS=$'\t' read -r kind src_rel dest_rel; do
        [ -z "$kind" ] && continue
        if [ "$UNINSTALL" -eq 1 ]; then
            unlink_one "$src_rel" "$dest_rel"
        else
            symlink_one "$src_rel" "$dest_rel"
        fi
    done < <(build_selection)

    if [ "$WITH_HOOKS" -eq 1 ] || [ "$UNINSTALL" -eq 1 ]; then
        merge_hooks || true
    fi

    if [ "$UNINSTALL" -eq 1 ]; then
        # 비어 있는 _harness 컨테이너만 정리. 사용자 자산은 안 건드림.
        for sub in agents commands skills rules; do
            local container="$CLAUDE_DIR/$sub/_harness"
            if [ -d "$container" ]; then
                find "$container" -type d -empty -delete 2>/dev/null || true
            fi
        done
    fi

    if [ "$UNINSTALL" -eq 0 ]; then
        echo
        if [ "$WITH_HOOKS" -eq 1 ]; then
            echo "Done. Symlinks installed and hooks merged into \$CLAUDE_DIR/settings.json."
        else
            echo "Done. Hooks are NOT auto-installed — re-run with --with-hooks to merge them,"
            echo "or edit \$CLAUDE_DIR/settings.json by hand."
        fi
    fi
}

main
