# Services

All services are managed by systemd. Unit files live in `config/prod/systemd-services/` and are synced to the host by `utils/sync-static-config.py` (see [Config Sync.md](Config%20Sync.md)).

# Daemons

| Service | User/Group | After/Requires/BindsTo | Restart | WorkingDirectory | ExecStart | ExecStop |
|---|---|---|---|---|---|---|
| `g_discord.service` | g_discord/g_discord | After=network.target; OnFailure=g_service_failed@Discord-g_discord.service | on-failure, RestartSec=10 | unset (commented out, TODO in the unit file) | `/opt/infra/.venv/bin/python3 /opt/infra/scripts/g_discord/g_discord.py` | none |
| `g_mc.service` | g_mc/g_mc | After/Requires/BindsTo=mysql.service | on-failure, RestartSec=10 | /var/lib/g_mc | `java -Xms1G -Xmx3G -jar /var/lib/g_mc/minecraft_server.jar nogui`, plus a block of G1GC tuning flags | `/opt/infra/.venv/bin/python3 /opt/infra/scripts/g_mc/service_stop.py` |
| `g_monitor.service` | g_monitor/g_monitor | none (OnFailure=g_service_failed@Monitor-g_monitor.service) | on-failure, RestartSec=10 | /var/lib/g_monitor | `/opt/infra/.venv/bin/python3 /opt/infra/scripts/g_monitor/monitor.py` | none |
| `g_nightly_restart.service` | root, unset | none | Restart=no, Type=oneshot | none | `/usr/bin/systemctl try-restart g_mc.service` | none |
| `g_nightly_restart.timer` | — | OnCalendar=`*-*-* 00:00:00` (daily midnight), Persistent=false | — | — | triggers `g_nightly_restart.service` | — |
| `g_service_failed@.service` | root, unset | none, templated (`%i` = `<readable_name>-<service_name>`) | Type=oneshot | none | `/bin/bash -c 'IFS="-"; set -- "%i"; /opt/infra/.venv/bin/python3 /opt/infra/scripts/webhooks.py status $@ crashed'` | none |
| `g_web_mcc.service` | g_web/g_web | After=network.target; OnFailure=g_service_failed@ConsoleWebsocket-g_web_mcc.service | on-failure, RestartSec=10 | /var/lib/g_web/mcc | `/usr/bin/node /var/lib/g_web/mcc/dist/server.js` | none |
| `g_web_nxt.service` | g_web/g_web | After=network.target; OnFailure=g_service_failed@Website-g_web_nxt.service | on-failure, RestartSec=10 | /var/lib/g_web/nxt | `/usr/bin/node /var/lib/g_web/node_modules/.bin/next start -p 3000`, plus an ExecStartPre= prisma migrate-diff check | none |
| `mysql.service.d/override.conf` | drop-in on the MariaDB-provided unit | Before=g_mc.service; OnFailure=g_service_failed@MariaDB_Database-mysql.service | inherited from the base unit, not overridden here | inherited | inherited | inherited |

Notes:
- Every service sets `UMask=0002` and `IOAccounting=yes` (the latter lets `g_monitor` read per-cgroup disk I/O).
- Long-running services (all except the oneshots/timer) set `StartLimitIntervalSec=5m`/`StartLimitBurst=2` - after 2 crashes within 5 minutes systemd marks the unit failed and stops auto-restarting it. Use `systemctl reset-failed <service_name>` to clear this before starting it again.
- `g_mc.service`'s `ExecStop` sends a graceful `stop` over `g_mc_monitor`'s console socket (see [G-DemMAIN Monitor Mod.md](G-DemMAIN%20Monitor%20Mod.md)) rather than relying on SIGTERM, since the JVM doesn't reliably save the world on a bare SIGTERM.
- Security hardening (`ProtectSystem=full`, `PrivateTmp=true`) is active on `g_discord.service`, `g_web_mcc.service` and `g_web_nxt.service`. On `g_mc.service` both are present but commented out - there's an open TODO in that unit file about restoring them once FUSE compatibility is sorted out. `g_monitor.service` sets neither.
- `OnFailure=` triggers the templated `g_service_failed@.service`, which fires a "crashed" status webhook (`scripts/webhooks.py`) - this is why individual services don't need their own failure-notification logic.
- `mysql.service` itself is provided by the MariaDB package, not this repo; `mysql.service.d/override.conf` only layers in the webhook hooks and the `Before=g_mc.service` ordering (so `g_mc.service` is fully stopped before MariaDB stops, and started only after MariaDB is up).

# Using systemctl

To start and stop a service: `systemctl start <service_name>` / `systemctl stop <service_name>`.

To enable and disable a service: `systemctl enable <service_name>` / `systemctl disable <service_name>`.
Enabled means it starts on VPS boot; started means it's running now. To run something long-term, enable then start it. To take it down for good, disable then stop it.

Some services stop auto-restarting after failing too often (see the `StartLimitIntervalSec`/`StartLimitBurst` note above). Trying to start one of these shows `Job for <service_name>.service failed because start of the service was attempted too often.`. Run `systemctl reset-failed <service_name>` to clear it, then start as normal.

After changing a unit file, run `systemctl daemon-reload`.

To view a service's status: `systemctl status <service_name>`.

To view logs, use `journalctl`. `journalctl -f` follows logs live; add `-u <service_name>` to filter to one service. `Ctrl-C` to exit.
This may need `sudo`, or membership of the `systemd-journal` group (`usermod -a -G systemd-journal <user_name>`).

To check a unit file for errors: `systemd-analyze verify <service_name>.service`.
