# Ports

Port blocking is managed by `ufw`.

| Port | What is it for? | Blocked by the firewall? |
|---|---|---|
| 25565 | Minecraft server (`server-port` in `config/prod/g_mc/server.properties`) | No |
| 25575 | RCON, per `server.properties` - but `enable-rcon=false`, so this port is inert/unused server-side | No |
| 3000 | g_web (nxt - website + panel), prod. Hardcoded via `-p 3000` in the systemd `ExecStart`, not read from config. TODO: switch this to port 80 | No |
| 8000 | g_web (nxt), dev only (`next dev -p 8000` in `scripts/g_web/nxt/package.json`) | n/a (dev) |
| 3001 | g_web mcc (console WebSocket backing the panel's console), prod (`mccwssPort` in `config/prod/g_web/config.json`) | No |
| 8001 | g_web mcc, dev only (`mccwssPort` in `config/dev/g_web/config.json`) | n/a (dev) |
| 25585 | `g_mc_monitor` console socket, loopback-only (see [G-DemMAIN Monitor Mod.md](G-DemMAIN%20Monitor%20Mod.md)) | Yes |
| 25586 | `g_mc_monitor` chat socket, loopback-only, same as above | Yes |
| 3306 | MySQL/MariaDB, loopback-bound (`bind-address` in `config/prod/mariadb/50-server-custom.cnf`) | Yes |
| _All others_ | | Yes |
