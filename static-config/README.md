// TODO: Set up management-server instead of rcon for minecraft.

An item not stored in sync-map.ini will not be synced.

`g_monitor` is kept stored locally, as that config is only accessed by my purpose-written tooling.
`sudoers` is synced by `utils/sync-sudoers.py` rather than `utils/sync-static-config.py`. This is copied to `/etc/sudoers.d/g-demMain`.

### Requirements
Note that the `g_mc.service` requires the `mysql.service` to already exist.
This also requires python and the `webhooks.py` script to be installed.
This also requires the environment variable files to be set up.
