#!/bin/bash

# Extract RCON settings from server.properties
rcon_enabled=$(grep "^enable-rcon=" /var/lib/g_mc/minecraft/server.properties | cut -d"=" -f2-)
rcon_port=$(grep "^rcon.port=" /var/lib/g_mc/minecraft/server.properties | cut -d"=" -f2-)
rcon_password=$(grep "^rcon.password=" /var/lib/g_mc/minecraft/server.properties | cut -d"=" -f2-)

# Check if RCON is enabled
if [[ "$rcon_enabled" != "true" ]]; then
    echo "Warning, RCON is disabled, cannot stop the Minecraft server!"
    exit 1;
elif [[ -z "$rcon_password" ]]; then  # Check if password length is equal to 0 (so was not set)
    echo "Warning, RCON is disabled (as no password was set), cannot stop the Minecraft server!"
    exit 1;
fi

# Stop the server
echo "Stopping server..."
/opt/infra/g_mc/mcrcon/mcrcon -P $rcon_port -p $rcon_password -w 5 "say Server is stopping!" stop  # Announce server is restarting, wait five seconds, then stop the server
