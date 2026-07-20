# Scripts
This file contains the scripts that get executed in the natural running of the server. 
Most of these are triggered by systemd, and should rarely be ran by a user.

# Minecraft - `g_mc`
For this to work, you must set `enable-rcon=true` in the `/var/lib/g_mc/minecraft/server.properties` file. Then you should ensure the port - `rcon-port` - is set to the value specified in the root [README.md](../README.md), and that a suitable password - `rcon-password` - is set.

We also require the `mcrcon` binary to be built and at `/opt/infra/scripts/g_mc/mcrcon/mcrcon`.
To do this, run `make` in the mcrcon directory.

The minecraft server jar file should be at `/var/lib/g_mc/minecraft_server.jar`.

## Monitor mod - `g_mc_monitor`
A Fabric mod exposing TPS/heap/player-list over a FUSE filesystem and bridging console/chat over authenticated sockets - see [G-DemMAIN Monitor Mod.md](../doc/G-DemMAIN%20Monitor%20Mod.md) for the protocols and setup prerequisites (FUSE permissions, config, ports).
Build it with `./gradlew build` in the `g_mc_monitor` directory, then drop the resulting jar from `build/libs` into `/var/lib/g_mc/mods`.

# Webhooks - `webhooks.py`
This script is used to send messages in discord (e.g. status updates).
It requires certain env-variables to be set.

# Discord bot - `g_discord`
A Python bot bridging Minecraft chat and exposing `/list`, talking to `g_mc_monitor`'s chat socket
and FUSE filesystem - see [G-DemMAIN Monitor Mod.md](../doc/G-DemMAIN%20Monitor%20Mod.md) for the
protocol. Requires `discord.py`, `python-dotenv` and `requests` (see `doc/Initial Setup.md`).
Run with `python3 g_discord.py [config path]`, defaulting to
`/opt/infra/static-config/g_discord/config.json` (kept in the repo, not synced to `/var/lib` - see
`static-config/README.md`) - pass a different path to use a local static config when developing.
`DISCORD_BOT_TOKEN` must be set in the environment (it's a secret, so it isn't in `.devenv` -
export it yourself).
