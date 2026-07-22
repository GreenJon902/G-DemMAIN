# Scripts
This file contains the utility scripts that are used for managing the server.

## Syncing Configs - `sync-static-config.py`
This module manages the contents and deployments of the synced static-config files.
This script should be executed in the `<repo_root>/static-config` folder.
Note, some copied config files have environment variables hardcoded, so this should be ran whenever environ-files are updated.

### Deployment
The `sync-static-config.py` script will copy the of the contents of folders specified in `sync-map.ini` to their respective destinations (also specified by that file).
This script will check for any discrepancies between the destination folders and the local folders, and ask you what to do in each case. This will not make any changes without user-input.

The `sync-map.ini` should contain a `recursive` section, a `flat` section, or both, each containing key-value pairs of `<local-folder-path (relative to root of repo)>=<destination-folder-path>`. `recursive` entries are walked into subfolders (e.g. for systemd drop-in folders like `mysql.service.d`). `flat` entries only look at the immediate contents of the destination folder - use this when the destination is a folder you don't otherwise own (e.g. `/etc` itself), so a recursive walk doesn't end up scanning unrelated files looking for orphaned synced files.

After updating systemd service config files, you'll need to run `systemctl daemon-reload`.
After updating the sshd config, first validate the config is correct with `sshd -t`, if there are no errors (no output) then run `systemctl reload sshd`.
After updating the mariadb config, run `systemctl restart mariadb`.

### Templates
A file named `<file_name.ext>.template` will be copied to `<file_name.ext>`. 
Any occurances of `${<file>/<var>}` found will be replaced with the corresponding environment variable `<var>` that is defined in `<file>`. Note that this will not validate if the destination is actually supposed to be allowed access.
Template files will have a note appended underneath the header when copied over.

### Testing
Running `sync-static-config.py test-map.ini` will map the folders to `./test/...`. You may need to create the destination folders beforehand. Then mess around whith files in the test folder to see that everything is working.

You can also use the `-d`/`--dry-run` flag to test the program without making any changes.

### Extra information
Any files we copy have the following header pre-pended to them:
```
# This is a G-DemMAIN synced config file, and may be overwritten when sync is run. Please do not modify this line, and leave it as the first line of this file.
```
This line is used to check if a file is created by the `sync.py` script, and it is expected this is left as it is, on the first line.

When changing destination folders, it might be a good idea to leave the destination folder as dummy, so that `sync-static-config.py` can find still find any old scripts and remove them.

## Syncing environment variable names - `sync-environ.py`
While some settings are always the same, some variables cannot/should not be set in the git repo. So we store these with environment variable files.
This script ensures that all the keys defined in /environ/** are defined in the destination environment folder for the given mode (`prod`/`dev`). It will also check for extraneous keys, and unset values.
This script should be executed in the `<repo_root>/environ` folder. Only the `README.md` file will be ignored.

### Usage
```
sync-environ.py prod                 # syncs to /etc/g-demmain
sync-environ.py dev path/to/dest     # syncs to the given dev destination (e.g. devConfig)
```
The `mode` positional (`prod` or `dev`) is required, and selects which per-variable spec (see Format below) is applied. The destination positional defaults to `/etc/g-demmain` when `mode` is `prod`, but must be given explicitly when `mode` is `dev` - there's no sensible shared default for it, so the script errors out rather than guessing.

### Format
The source files should have no extension, they will have `.env` appended when copied.
They should be formatted like this:
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
- A `NAME` with no tokens at all, or with tokens only for other modes, is unspecified for the current mode: this is today's original behaviour - if missing, an empty `NAME=` is added (plus the doc comment) for you to fill in by hand.

For example (illustrating the format only - these two variables don't exist in `environ/common` yet):
```
G_DEMMAIN_ROOT prod="/opt/infra" !dev
# The absolute path to the repo checkout in use

G_DEMMAIN_MODE prod="prod" dev="dev"
# The mode this environment runs in
```
Here `G_DEMMAIN_ROOT` is forced to `/opt/infra` in prod and must never be set in dev, while `G_DEMMAIN_MODE` is forced to a different literal value in each mode.
