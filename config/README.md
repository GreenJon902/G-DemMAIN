# Config
This module manages the contents and deployments of the configuration files.

## Deployment
The `sync.py` script will copy the of the contents of folders specified in `conf-map.ini` to their respective destinations (also specified by that file).
This script will check for any discrepancies between the destination folders and the local folders, and ask you what to do in each case. This will not make any changes without user-input.

The `conf-map.ini` should contain a section with header `conf-map`, which should contain key-value pairs of `<local-folder-name>=<destination-folder-path>`.

After updating systemd service config files, you'll need to run `systemctl daemon-reload`.
After updating the sshd config, first validate the config is correct with `sshd -t`, if there are no errors (no output) then run `systemctl reload sshd`.
After updating the mariadb config, run `systemctl restart mariadb`.

### Requirements
Note that the `g_mc.service` requires the `mysql.service` to already exist.

## Testing
Running `sync.py test-map.ini` will map the folders to `./test/...`. You may need to create the destination folders beforehand. Then mess around whith files in the test folder to see that everything is working.

You can also use the `-d`/`--dry-run` flag to test the program without making any changes.

## Extra information
Any files we copy have the following header pre-pended to them:
```
# This is a G-DemMAIN synced config file, and may be overwritten when sync is run. Please do not modify this line, and leave it as the first line of this file.
```
This line is used to check if a file is created by the `sync.py` script, and it is expected this is left as it is, on the first line.

