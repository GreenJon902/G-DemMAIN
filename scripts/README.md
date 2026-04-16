# Scripts
This file contains the scripts that get executed in the natural running of the server. 
Most of these are triggered by systemd, and should rarely be ran by a user.

# Minecraft - `g_mc`
For this to work, you must set `enable-rcon=true` in the `/var/lib/g_mc/minecraft/server.properties` file. Then you should ensure the port - `rcon-port` - is set to the value specified in the root [README.md](../README.md), and that a suitable password - `rcon-password` - is set.

We also require the `mcrcon` binary to be built and at `/opt/infra/scripts/g_mc/mcrcon/mcrcon`.
To do this, run `make` in the mcrcon directory.

The minecraft server jar file should be at `/var/lib/g_mc/minecraft_server.jar`.

# Webhooks - `webhooks.py`
This script is used to send messages in discord (e.g. status updates).
It requires certain env-variables to be set.
