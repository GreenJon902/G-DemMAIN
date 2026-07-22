# devUtils/prepDevEnv.sh
#
# Sets up a dev shell for THIS worktree. Must be SOURCED once per terminal, never executed:
#   . devUtils/prepDevEnv.sh
#
# In order, this:
#   1. Exports G_DEMMAIN_ROOT as this worktree's root.
#   2. Safely loads the shared devConfig/ folder from the main repo's root (same folder no
#      matter which worktree you're in) into the shell's environment.
#   3. Sources this worktree's own .venv, if it has been created.
# It never runs a sync, never touches .venv creation, and never changes the shell's cwd - if any
# of the above is missing it warns and continues rather than treating it as fatal, since a fresh
# worktree legitimately won't have devConfig/.venv until the one-time manual setup steps are run.

# Bail out (without killing the caller's shell, since this is sourced) if we're not in a git repo at all
_prepdevenv_root="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$_prepdevenv_root" ]; then
    echo "prepDevEnv.sh: warning: not inside a git repo, nothing to set up" >&2
    unset _prepdevenv_root
    return 1 2>/dev/null || exit 1
fi
export G_DEMMAIN_ROOT="$_prepdevenv_root"

# Resolve the MAIN repo's root (shared across every worktree) rather than this worktree's own
# root - --git-common-dir always points at the one real .git directory, which for a worktree
# lives inside the main checkout, so stripping its trailing "/.git" gives the main repo's root
_prepdevenv_common_git_dir="$(git -C "$G_DEMMAIN_ROOT" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)"
_prepdevenv_main_root="${_prepdevenv_common_git_dir%/.git}"
_prepdevenv_devconfig="${_prepdevenv_main_root}/devConfig"

# devConfig/ holds one systemd-EnvironmentFile-format file per environ/* source (as produced by
# `sync-environ.py dev <devConfig-path>`, run once manually from environ/) - NOT bash syntax, so
# each file is parsed by hand rather than raw-sourced
if [ -d "$_prepdevenv_devconfig" ]; then
    for _prepdevenv_envfile in "$_prepdevenv_devconfig"/*; do
        [ -f "$_prepdevenv_envfile" ] || continue
        while IFS= read -r _prepdevenv_line || [ -n "$_prepdevenv_line" ]; do
            # Skip blank lines and comment lines
            case "$_prepdevenv_line" in
                ""|"#"*) continue ;;
            esac
            # Split on the first "=" only, since values (e.g. webhook URLs) may contain their own "="
            _prepdevenv_name="${_prepdevenv_line%%=*}"
            _prepdevenv_value="${_prepdevenv_line#*=}"
            export "${_prepdevenv_name}=${_prepdevenv_value}"
        done < "$_prepdevenv_envfile"
    done
else
    echo "prepDevEnv.sh: warning: no devConfig found at ${_prepdevenv_devconfig} - bootstrap it once with 'sync-environ.py dev ${_prepdevenv_devconfig}' (run from environ/)" >&2
fi

# Activate this worktree's own venv (created by utils/createVenv.sh) so python3/pip resolve
# inside it for ad-hoc script runs - each worktree has its own real venv, none are shared
_prepdevenv_venv_activate="${G_DEMMAIN_ROOT}/.venv/bin/activate"
if [ -f "$_prepdevenv_venv_activate" ]; then
    . "$_prepdevenv_venv_activate"
else
    echo "prepDevEnv.sh: warning: no .venv found at ${G_DEMMAIN_ROOT}/.venv - run utils/createVenv.sh once for this worktree" >&2
fi

unset _prepdevenv_root _prepdevenv_common_git_dir _prepdevenv_main_root _prepdevenv_devconfig \
      _prepdevenv_envfile _prepdevenv_line _prepdevenv_name _prepdevenv_value _prepdevenv_venv_activate
