# Python

Every Python component (`g_monitor`, `g_discord`, `g_mc`'s helper scripts, etc.) runs from a single per-checkout virtual environment at `{ROOT}/.venv`, where `{ROOT}` is that checkout's own root - this is the same mechanism whether the checkout is the prod install, the main dev checkout, or a dev `git worktree`.

This venv has the `{ROOT}` in path, so shared tools - `libs.config`, `scripts.webhooks`, etc - are accessible via simple imports.

## `utils/createVenv.sh`

`utils/createVenv.sh` creates/updates that venv and wires up `libs/` import resolution:

1. Creates `{ROOT}/.venv` with `python3 -m venv`.
2. Installs `requirements.txt` into it.
3. Writes a `.pth` file (`g_demmain.pth`) into the venv's site-packages, containing `{ROOT}`.

That `.pth` file is what makes `import libs.config` resolve from anywhere in the codebase with no per-file `sys.path` hacks and no `PYTHONPATH` environment variable - Python's `site` module reads every `.pth` file in site-packages at startup and adds each line it contains to `sys.path`.

Root defaults to `git rev-parse --show-toplevel` (the current checkout), and is echoed so you can confirm it's correct.
An optional first argument overrides it, to target another checkout:

```
utils/createVenv.sh                    # targets the checkout you're currently inside
utils/createVenv.sh /path/to/checkout  # targets a specific checkout instead
```

## When to run it

Run it manually, once per checkout - the prod install, the main dev checkout, and each dev worktree all need their own real `.venv`, since a `.venv` created for one checkout points its `.pth` at that checkout's own root.
Since prod is itself a plain git checkout at a known path, setup there is the exact same command as dev.

In dev, `devUtils/prepDevEnv.sh` (from a later step) sources this venv's `bin/activate` automatically when you source it, so day-to-day you don't need to activate the venv by hand - but `createVenv.sh` still needs to have been run at least once first for that checkout, or there's no venv for it to source.
