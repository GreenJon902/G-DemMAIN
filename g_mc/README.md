# Setup

For this to work, you must set `enable-rcon=true` in the `/var/lib/g_mc/minecraft/server.properties` file. Then you should ensure the port - `rcon-port` - is not publically accessible (it is blocked by the firewall), and that a suitable password - `rcon-password` - is set.

We also require the `mcron` binary to be built and at `/opt/infra/mcrcon/mcrcon`.
To do this, navigate to `/opt/infra/mcrcon` and run `make`.

You must also agree to the eula:
`echo "eula=true" > /var/lib/g_mc/minecraft/eula.txt`
