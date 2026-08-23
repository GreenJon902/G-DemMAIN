# Config Sync

Deploy tooling for getting config from this repo onto a live host, via two scripts in `utils/`:
- `sync_static_config/main.py` - copies static config files (systemd units, mariadb config, sshd drop-ins, the sudoers drop-in, JSON app configs, etc.) to their system destinations.
- `sync-environ.py` - ensures the environment variable files in `/etc/g-demmain` have all the keys `environ/` expects.

## `sync_static_config/main.py`
Copies the contents of folders specified in `sync-map.ini` to their respective destinations.
Run this from `<repo_root>/config/prod` (or `<repo_root>/config/dev/syncDemo` for the demo mechanism, see [Testing](#testing) below).
Some copied config files have environment variables hardcoded into them, so re-run this whenever environ files are updated.

### Usage
```
main.py [syncmap] [-d/--dry-run] [-e/--environ PATH] [-v/--verbose]
```
- `syncmap` - path to the sync-map ini file, defaults to `./sync-map.ini`.
- `-d`/`--dry-run` - report what would change without writing anything.
- `-e`/`--environ` - path to the populated environment files, used for template substitution. Defaults to `/etc/g-demmain`.
- `-v`/`--verbose` - print more detail about what's being checked/copied, and show the "already correct" files in the end-of-run summary.

### Deployment
The script checks for discrepancies between the destination folders and the local (source) folders, and asks what to do in each case - it never makes changes without user input (dry-run aside). Problems (a malformed source, a destination that isn't ours to overwrite, `visudo` failing, ...) are printed as they're hit and printed again in the end-of-run summary.

`sync-map.ini` has a `[recursive]` section, a `[flat]` section, or both, each containing `<local-folder-path (relative to repo root)>=<destination-folder-path>` pairs. `recursive` entries are walked into subfolders (e.g. for systemd drop-in folders like `mysql.service.d`). `flat` entries only look at the immediate contents of the destination folder - use this when the destination is a folder you don't otherwise own (e.g. `/etc` or `/etc/sudoers.d`), so a recursive walk doesn't end up scanning unrelated files looking for orphaned synced files.

After updating systemd service config files, run `systemctl daemon-reload`.
After updating the sshd config, validate first with `sshd -t` - if there's no output, run `systemctl reload sshd`.
After updating the mariadb config, run `systemctl restart mariadb`.

### Filename flags
A source file's name can carry flags, in this fixed order, before its real extension:
```
<filename>[.drop_ext][.template][.omit_marker][.validate_sudoers].<extension>
```
- `drop_ext` - the extension is stripped from the deployed filename (e.g. for the sudoers drop-in, which must have no extension on disk).
- `template` - see [Templates](#templates) below.
- `omit_marker` - no ownership marker is added to this file at all (see [Extra information](#extra-information)) - useful for a destination the marker's comment syntax can't safely be added to. A file synced this way is never recognised as "ours" by the orphan-cleanup scan, so it's never offered for automatic removal.
- `validate_sudoers` - runs `visudo -c` both before and after the copy, and prints the previous file's contents as a manual backup - currently only used for the sudoers drop-in (see [What's not synced](#whats-not-synced)).

Only extensions the tool explicitly knows about are accepted: `json`, and the plain-text group `conf`, `cnf`, `txt`, `properties`, `service`, `timer`, `sudoers`. Anything else is reported as a problem and left alone.

### Templates
A source file flagged `.template` gets `${<file>/<var>}` occurrences replaced with the environment variable `<var>` defined in `<file>` (this doesn't validate that the destination is actually supposed to have access to that variable). Templated files get a note appended underneath the marker when copied over.

### Testing
`config/dev/syncDemo/sync-map.ini` is a self-contained demo of this mechanism, using fake source trees unrelated to any real component (see `config/dev/syncDemo/`) - including examples of the JSON marker/wildcard comparison, `drop_ext`, and `omit_marker` (`validate_sudoers` isn't exercised here, since it needs a real `visudo` binary and touches a real destination file). `devUtils/syncDemoFixture/` holds a "prior destination state" fixture that, copied to a scratch destination before running the demo, exercises every discrepancy branch (untouched exact copies, conflicts, updates, orphans, a new JSON file with a wildcarded field, and the flat/recursive subfolder distinction).

### Extra information
Every file the script manages carries a marker so it can recognise a file it created on a later run:
- For JSON files, a `G_MARKER` field is added to the root object.
- For every other supported extension, this line is prepended:
```
# This is a G-DemMAIN synced config file, and may be overwritten when sync is run. Please do not modify this line, and leave it as the first line of this file.
```
Leave the marker as-is - do not edit or remove it. A destination file that already exists without the marker is treated as a conflict (not silently overwritten) unless the source is flagged `.omit_marker`.

JSON comparison is native (not line-based) and supports partial matching: a source field whose value is the literal string `*wildcard*` matches any value the destination holds there - the key must still be present, just not any particular value.

After every run, destination folders are scanned for marked files that weren't accounted for this run (i.e. no longer have a matching source) - you'll be prompted to remove or ignore each one.

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

## What's not synced
Anything not listed in `sync-map.ini` isn't synced by `sync_static_config/main.py`.

`g_monitor` and `g_mc_monitor` config is kept local only (not synced) - it's only read by purpose-written tooling, not by anything expecting a system-wide destination.


## Requirements
- `g_mc.service` requires `mysql.service` to already exist.
- Python and `scripts/webhooks.py` must be installed.
- The environment variable files must be set up (see [Environment Variables.md](Environment%20Variables.md)).
