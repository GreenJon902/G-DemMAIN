#!/usr/bin/env python3

"""
Sends the "stop" command over g_mc_monitor's console socket so the Minecraft server saves the
world and shuts down cleanly - see doc/G-DemMAIN Monitor Mod.md's "Console socket protocol"
section. Run as g_mc.service's ExecStop (see static-config/systemd-services/g_mc.service).

Plain SIGTERM does *not* do this - testing showed the JVM has no shutdown hook that saves the
world, it just dies after a delay with no save. If this script fails for any reason, systemd's
KillSignal/TimeoutStopSec still forcibly stops the process, but without saving the world first.
"""

import json
import os
import socket
import sys
import threading

HOST = "127.0.0.1"  # g_mc_monitor's console socket is loopback-only (see doc/G-DemMAIN Monitor Mod.md)


def main():
    # Load environ vars, these should KeyError if not present
    port = int(os.environ["MINECRAFT_MONITOR_CONSOLE_PORT"])
    auth_key = os.environ["MINECRAFT_MONITOR_CONSOLE_AUTH_KEY"]

    sock = socket.create_connection((HOST, port), timeout=10)
    sock_file = sock.makefile("rw", encoding="utf-8", newline="\n")
    sock_file.write(json.dumps({"authKey": auth_key}) + "\n")
    sock_file.flush()

    # Drains history/log lines so the server's console-output thread never blocks on a full send
    # buffer while we're connected
    threading.Thread(target=lambda: [None for _ in sock_file], daemon=True).start()

    sock_file.write(json.dumps({"type": "command", "command": "stop"}) + "\n")
    sock_file.flush()


if __name__ == "__main__":
    try:
        main()
    except (OSError, KeyError) as e:
        print(f"Warning, could not send stop command via g_mc_monitor's console socket: {e}", file=sys.stderr)
        sys.exit(1)
