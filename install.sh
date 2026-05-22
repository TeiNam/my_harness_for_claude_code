#!/usr/bin/env bash
# install.sh — Symlink this harness into ~/.claude/
#
# Creates symlinks for agents, commands, skills, rules, and hooks so that
# edits in this repo take effect immediately in Claude Code.
#
# Usage:
#   ./install.sh                   Install (default)
#   ./install.sh --dry-run         Show what would happen without writing
#   ./install.sh --uninstall       Remove symlinks created by this script
#   ./install.sh --force           Overwrite existing files/links at the target
#   ./install.sh --with-hooks      Also merge hooks/hooks.json into settings.json
#                                  (combine with --uninstall to remove them;
#                                   combine with --dry-run to preview changes)

set -euo pipefail

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="${CLAUDE_HOME:-$HOME/.claude}"

DRY_RUN=0
UNINSTALL=0
FORCE=0
WITH_HOOKS=0
for arg in "$@"; do
    case "$arg" in
        --dry-run)    DRY_RUN=1 ;;
        --uninstall)  UNINSTALL=1 ;;
        --force)      FORCE=1 ;;
        --with-hooks) WITH_HOOKS=1 ;;
        -h|--help)
            grep '^#' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *) echo "Unknown flag: $arg" >&2; exit 1 ;;
    esac
done

# Items to symlink: <repo-relative-source>:<.claude-relative-target>
# Empty source means "this harness repo's root" — needed by the inline hook
# bootstrap, which probes ~/.claude/_harness/scripts/lib/utils.js to locate
# this harness when CLAUDE_PLUGIN_ROOT is unset.
ITEMS=(
    ":_harness"
    "agents:agents/_harness"
    "commands:commands/_harness"
    "skills:skills/_harness"
    "rules:rules/_harness"
    "hooks:hooks/_harness"
)

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
    local src="$HARNESS_DIR/$src_rel"
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
    local src="$HARNESS_DIR/$src_rel"
    local dest="$CLAUDE_DIR/$dest_rel"

    if [ -L "$dest" ] && [ "$(readlink "$dest")" = "$src" ]; then
        run rm "\"$dest\""
        echo "unlink: $dest"
    else
        echo "skip:   $dest is not a link to this harness" >&2
    fi
}

merge_hooks() {
    local merge_args=()
    if [ "$DRY_RUN" -eq 1 ]; then merge_args+=("--dry-run"); fi
    if [ "$UNINSTALL" -eq 1 ]; then merge_args+=("--uninstall"); fi
    merge_args+=("--hooks" "$HARNESS_DIR/hooks/hooks.json")
    merge_args+=("--settings" "$CLAUDE_DIR/settings.json")

    if ! command -v node >/dev/null 2>&1; then
        echo "skip: --with-hooks requires Node.js, but \`node\` is not on PATH" >&2
        return 1
    fi

    echo
    echo "==> Hook merge (settings.json)"
    node "$HARNESS_DIR/scripts/install/merge-hooks.js" "${merge_args[@]}"
}

main() {
    if [ ! -d "$CLAUDE_DIR" ]; then
        echo "Claude config dir not found: $CLAUDE_DIR" >&2
        echo "Set CLAUDE_HOME or create it first." >&2
        exit 1
    fi

    for item in "${ITEMS[@]}"; do
        local src_rel="${item%%:*}"
        local dest_rel="${item##*:}"
        if [ "$UNINSTALL" -eq 1 ]; then
            unlink_one "$src_rel" "$dest_rel"
        else
            symlink_one "$src_rel" "$dest_rel"
        fi
    done

    if [ "$WITH_HOOKS" -eq 1 ]; then
        merge_hooks || true
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
