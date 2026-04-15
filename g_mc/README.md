# Setup

For this to work, you must set `enable-rcon=true` in the `/var/lib/g_mc/minecraft/server.properties` file. Then you should ensure the port - `rcon-port` - is set to the value specified in the root [README.md](../README.md), and that a suitable password - `rcon-password` - is set.

We also require the `mcrcon` binary to be built and at `/var/lib/g_mc/mcrcon`.
To do this, run `make` in the mcrcon directory and copy it over.

The minecraft server jar file should be at `/var/lib/g_mc/minecraft_server.jar`.
