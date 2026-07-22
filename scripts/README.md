# Scripts
This file contains the scripts that get executed in the natural running of the server. 
Most of these are triggered by systemd, and should rarely be ran by a user.

# Minecraft - `g_mc`
The minecraft server jar file should be at `/var/lib/g_mc/minecraft_server.jar`.
Stopping is handled by `service_stop.py`, run as `g_mc.service`'s `ExecStop` (see
`config/prod/systemd-services/g_mc.service`), which sends "stop" over `g_mc_monitor`'s console
socket. Plain `SIGTERM` does *not* save the world - the JVM has no shutdown hook for that - so this
is required for a clean stop; `KillSignal`/`TimeoutStopSec` are only a fallback if it fails.

## Monitor mod - `g_mc_monitor`
A Fabric mod exposing TPS/heap/player-list over a FUSE filesystem and bridging console/chat over authenticated sockets - see [G-DemMAIN Monitor Mod.md](../doc/G-DemMAIN%20Monitor%20Mod.md) for the protocols and setup prerequisites (FUSE permissions, config, ports).
Build it with `./gradlew build` in the `g_mc_monitor` directory, then drop the resulting jar from `build/libs` into `/var/lib/g_mc/mods`.

# Webhooks - `webhooks.py`
This script is used to send messages in discord (e.g. status updates).
It requires certain env-variables to be set.

# Discord bot - `g_discord`
A Python bot bridging Minecraft chat and exposing `/list`, talking to `g_mc_monitor`'s chat socket
and FUSE filesystem - see [G-DemMAIN Monitor Mod.md](../doc/G-DemMAIN%20Monitor%20Mod.md) for the
protocol. Requires `discord.py` and `requests` (see `doc/Initial Setup.md`).
Run with `python3 g_discord.py`, no arguments. `DISCORD_BOT_TOKEN` and `DISCORD_CHAT_CHANNEL_ID`
must be set in the environment (see `environ/g_discord_bot`).
