# Config Sync

Deploy tooling for getting config from this repo onto a live host, via three scripts in `utils/`:
- `sync-static-config.py` - copies static config files (systemd units, mariadb config, sshd drop-ins, etc.) to their system destinations.
- `sync-environ.py` - ensures the environment variable files in `/etc/g-demmain` have all the keys `environ/` expects.
- `sync-sudoers.py` - copies the sudoers drop-in, with a validate-before/after safety check.

## `sync-static-config.py`
Copies the contents of folders specified in `sync-map.ini` to their respective destinations.
Run this from `<repo_root>/config/prod` (or `<repo_root>/config/dev/syncDemo` for the demo mechanism, see [Testing](#testing) below).
Some copied config files have environment variables hardcoded into them, so re-run this whenever environ files are updated.

### Usage
```
sync-static-config.py [syncmap] [-d/--dry-run] [-e/--environ PATH] [-v/--verbose]
```
- `syncmap` - path to the sync-map ini file, defaults to `./sync-map.ini`.
- `-d`/`--dry-run` - report what would change without writing anything.
- `-e`/`--environ` - path to the populated environment files, used for template substitution. Defaults to `/etc/g-demmain`.
- `-v`/`--verbose` - print more detail about what's being checked/copied.

### Deployment
The script checks for discrepancies between the destination folders and the local (source) folders, and asks what to do in each case - it never makes changes without user input (dry-run aside).

`sync-map.ini` has a `[recursive]` section, a `[flat]` section, or both, each containing `<local-folder-path (relative to repo root)>=<destination-folder-path>` pairs. `recursive` entries are walked into subfolders (e.g. for systemd drop-in folders like `mysql.service.d`). `flat` entries only look at the immediate contents of the destination folder - use this when the destination is a folder you don't otherwise own (e.g. `/etc` itself), so a recursive walk doesn't end up scanning unrelated files looking for orphaned synced files.

After updating systemd service config files, run `systemctl daemon-reload`.
After updating the sshd config, validate first with `sshd -t` - if there's no output, run `systemctl reload sshd`.
After updating the mariadb config, run `systemctl restart mariadb`.

### Templates
A file named `<file_name.ext>.template` is copied to `<file_name.ext>`.
Any occurrence of `${<file>/<var>}` is replaced with the environment variable `<var>` defined in `<file>` (this doesn't validate that the destination is actually supposed to have access to that variable). Templated files get a note appended underneath the header when copied over.

### Testing
`config/dev/syncDemo/sync-map.ini` is a self-contained demo of this mechanism, using fake source trees unrelated to any real component (see `config/dev/syncDemo/`). `devUtils/syncDemoFixture/` holds a "prior destination state" fixture that, copied to a scratch destination before running the demo, exercises every discrepancy branch (untouched exact copies, conflicts, updates, orphans, and the flat/recursive subfolder distinction).

### Extra information
Every file the script copies gets this header prepended:
```
# This is a G-DemMAIN synced config file, and may be overwritten when sync is run. Please do not modify this line, and leave it as the first line of this file.
```
This line is how the script recognises a file it created - leave it as the first line, unmodified.

When changing a destination folder, it can help to leave the old destination folder tracked - so the script can still find and remove any old synced files there.

## `sync-environ.py`
Some settings can't/shouldn't live in the git repo (secrets, per-host values), so they're stored as environment variable files instead. This script ensures every key defined in `environ/*` exists in the destination environment folder for the given mode (`prod`/`dev`), and flags extraneous or unset keys.
Run this from `<repo_root>/environ`.

### Usage
```
sync-environ.py prod                 # syncs to /etc/g-demmain
sync-environ.py dev path/to/dest     # syncs to the given dev destination (e.g. devConfig)
```
The `mode` positional (`prod` or `dev`) is required, and selects which per-variable spec (see Format below) is applied. The destination positional defaults to `/etc/g-demmain` when `mode` is `prod`, but must be given explicitly when `mode` is `dev` - there's no sensible shared default for it, so the script errors out rather than guessing.

### Format
Source files have no extension - `.env` is appended when copied (e.g. `environ/common` becomes `/etc/g-demmain/common.env`).
They're formatted like this:
```
ENVIRONMENT_VARIABLE_NAME
# Comment line 1
# Comment line 2
```
The `NAME` line may optionally be followed by a space-separated list of per-mode tokens, each either `mode="preset value"` or `!mode`:
```
ENVIRONMENT_VARIABLE_NAME (mode="preset value" | !mode)...
# Comment line 1
# Comment line 2
```
- `mode="value"` forces `NAME` to `value` whenever syncing for `mode`. If `NAME` is missing from the destination it's written with that value; if present with a different value the script warns and prompts you to overwrite or keep it; if present with the same value nothing happens.
- `!mode` marks `NAME` as one that must **not** be set when syncing for `mode`. If it's present in the destination anyway, the script warns (it won't remove or edit it for you).
- A `NAME` with no tokens at all, or with tokens only for other modes, is unspecified for the current mode: if missing, an empty `NAME=` is added (plus the doc comment) for you to fill in by hand.

For example (illustrating the format only - these two variables don't exist in `environ/common`):
```
G_DEMMAIN_ROOT prod="/opt/infra" !dev
# The absolute path to the repo checkout in use

G_DEMMAIN_MODE prod="prod" dev="dev"
# The mode this environment runs in
```
Here `G_DEMMAIN_ROOT` is forced to `/opt/infra` in prod and must never be set in dev, while `G_DEMMAIN_MODE` is forced to a different literal value in each mode.

See [Environment Variables.md](Environment%20Variables.md) for what each `environ/*` file actually contains.

## `sync-sudoers.py`
Copies the sudoers drop-in with `visudo` validation either side of the copy - a syntax error in a live sudoers file can lock out `sudo` entirely, so this is deliberately more cautious than `sync-static-config.py`.

Run from `<repo_root>/config/prod`, same as `sync-static-config.py`. It reads the local `sudoers` file and writes it to `/etc/sudoers.d/g-demMAIN` (mode `0440`).

Procedure (unlike `sync-static-config.py`, there's no discrepancy prompt or header-based ownership check - it always overwrites):
1. Validate the currently-installed sudoers config with `visudo -c`. If this fails, ask whether to proceed anyway.
2. Print the old `/etc/sudoers.d/g-demMAIN` contents to stdout, if the file exists - this is the only backup taken; capture the output yourself (e.g. redirect the script's output to a file) if you want to be able to restore it.
3. Copy the local `sudoers` file over `/etc/sudoers.d/g-demMAIN` and `chmod 0440` it.
4. Re-validate with `visudo -c`. If this fails, the script only prints a warning recommending you roll back or remove the file - it does **not** automatically restore the old config. Manually put back the contents printed in step 2, then re-run `visudo -c` to confirm.

## What's not synced
Anything not listed in `sync-map.ini` isn't synced by `sync-static-config.py`.

`g_monitor` and `g_mc_monitor` config is kept local only (not synced) - it's only read by purpose-written tooling, not by anything expecting a system-wide destination.
`sudoers` is synced by `sync-sudoers.py`, not `sync-static-config.py` (see above).

## Requirements
- `g_mc.service` requires `mysql.service` to already exist.
- Python and `scripts/webhooks.py` must be installed.
- The environment variable files must be set up (see [Environment Variables.md](Environment%20Variables.md)).
