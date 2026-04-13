#!/bin/bash

# Check if RCON is enabled
rcon_enabled = $(grep "^enable-rcon=" server.properties | cut -d"=" -f2-)
if [[ "$rcon_enabled" != "true" ]]; then
    echo "Warning, RCON is disabled, cannot stop the Minecraft server!"
    exit 1;
fi

# Get RCON port and password
rcon_port = $(grep "^rcon-port=" server.properties | cut -d"=" -f2-)
rcon_password = $(grep "^rcon-password=" server.properties | cut -d"=" -f2-)

# Stop the server
echo "Stopping server..."
/opt/infra/g_mc/mcrcon/mcrcon -P $rcon_port -p $rcon_password -w 5 "say Server is stopping!" stop  # Accounce server is restarting, wait five seconds, then stop the server
