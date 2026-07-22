#!/bin/bash
# utils/createVenv.sh - creates/updates the venv for a checkout (prod install or any dev worktree)
# and wires up libs/ import resolution. Run manually, once per checkout. Accepts an optional root
# override as $1; defaults to the current git checkout's root.
ROOT="${1:-$(git rev-parse --show-toplevel)}"
echo "Creating venv at: $ROOT/.venv"
python3 -m venv "$ROOT/.venv"
"$ROOT/.venv/bin/pip" install -r "$ROOT/requirements.txt"
SITE=$("$ROOT/.venv/bin/python" -c "import site; print(site.getsitepackages()[0])")
echo "$ROOT" > "$SITE/g_demmain.pth"
echo "Venv ready at $ROOT/.venv, libs.config resolvable via $SITE/g_demmain.pth"
