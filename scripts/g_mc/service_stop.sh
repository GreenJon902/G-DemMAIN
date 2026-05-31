#!/bin/bash

# Extract RCON settings from server.properties
rcon_enabled=$(grep "^enable-rcon=" /var/lib/g_mc/server.properties | cut -d"=" -f2-)
rcon_port=$RCON_PORT
rcon_password=$RCON_PASSWORD

# Check if RCON is enabled
if [[ "$rcon_enabled" != "true" ]]; then
    echo "Warning, RCON is disabled, cannot stop the Minecraft server!"
    exit 1;
elif [[ -z "$rcon_password" ]]; then  # Check if password length is equal to 0 (so was not set)
    echo "Warning, could not find RCON_PASSWORD in environ!"
    exit 1;
elif [[ -z "$rcon_port" ]]; then  # Check if password length is equal to 0 (so was not set)
    echo "Warning, could not find RCON_PORT in environ!"
    exit 1;
fi

# Check if server is actually on (as if the jar ends gracefully (e.g. /stop) then systemd runs ExecStop)
if [[ -z "$(ss -tuln | grep :$rcon_port)" ]]; then
    echo "Server appears to not be up, doing nothing..."
    exit 0;
fi

# Stop the server
echo "Stopping server..."
/opt/infra/scripts/g_mc/mcrcon/mcrcon -P $rcon_port -p $rcon_password -w 5 "say Server is stopping!" stop  # Announce server is restarting, wait five seconds, then stop the server
