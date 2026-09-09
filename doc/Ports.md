# Ports

Port blocking is managed by `ufw`.

| Port | What is it for? | Blocked by the firewall? |
|---|---|---|
| 25565 | Minecraft server (`server-port` in `config/prod/g_mc/server.properties`) | No |
| 80 | Caddy, prod - HTTP, redirects to 443 and answers ACME HTTP-01 challenges (see [Caddy.md](Caddy.md)) | No |
| 443 (TCP) | Caddy, prod - HTTPS, reverse-proxies to g_web nxt/mcc (see [Caddy.md](Caddy.md)) | No |
| 443 (UDP) | Caddy, prod - HTTP/3 (QUIC) | No |
| 3000 | g_web (nxt - website + panel), prod. Hardcoded via `-p 3000 -H 127.0.0.1` in the systemd `ExecStart`, not read from config. Loopback-only, reached via Caddy | Yes |
| 8000 | g_web (nxt), dev only (`next dev -p 8000` in `scripts/g_web/nxt/package.json`) | n/a (dev) |
| 3001 | g_web mcc (console WebSocket backing the panel's console), prod (`mccwssPort` in `config/prod/g_web/config.json`). Loopback-only (bound in `scripts/g_web/mcc/server.ts`), reached via Caddy | Yes |
| 8001 | g_web mcc, dev only (`mccwssPort` in `config/dev/g_web/config.json`) | n/a (dev) |
| 2019 | Caddy admin API, loopback-only, left at its default (not exposed, not disabled - see [Caddy.md](Caddy.md)) | Yes |
| 25585 | `g_mc_monitor` console socket, loopback-only (see [G-DemMAIN Monitor Mod.md](G-DemMAIN%20Monitor%20Mod.md)) | Yes |
| 25586 | `g_mc_monitor` chat socket, loopback-only, same as above | Yes |
| 3306 | MySQL/MariaDB, loopback-bound (`bind-address` in `config/prod/mariadb/50-server-custom.cnf`) | Yes |
| _All others_ | | Yes |
TODO: domain.name/dynmaps currently sends to 5391 via caddy. 5391 is blocked by the firewall. 

