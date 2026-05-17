# Scripts
This file contains the utility scripts that are used for managing the server.

## Syncing Configs - `sync-static-config.py`
This module manages the contents and deployments of the synced static-config files.
This script should be executed in the `<repo_root>/static-config` folder.

### Deployment
The `sync-static-config.py` script will copy the of the contents of folders specified in `sync-map.ini` to their respective destinations (also specified by that file).
This script will check for any discrepancies between the destination folders and the local folders, and ask you what to do in each case. This will not make any changes without user-input.

The `sync-map.ini` should contain a section with header `sync-map`, which should contain key-value pairs of `<local-folder-path (relative to root of repo)>=<destination-folder-path>`.

After updating systemd service config files, you'll need to run `systemctl daemon-reload`.
After updating the sshd config, first validate the config is correct with `sshd -t`, if there are no errors (no output) then run `systemctl reload sshd`.
After updating the mariadb config, run `systemctl restart mariadb`.

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
This script ensures that all the keys defined in /environ/** are defined in the environment folder. It will also check for extraneous keys, and unset values.
This script should be executed in the `<repo_root>/environ` folder. Only the `README.md` file will be ignored.

### Format
The source files should have no extension, they will have `.env` appended when copied.
They should be formatted like this:
```
ENVIRONMENT_VARIABLE_NAME
# Comment line 1
# Comment line 2
```
