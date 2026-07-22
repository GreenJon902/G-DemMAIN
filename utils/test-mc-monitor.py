# Interactively tests g_mc_monitor's FUSE filesystem, console socket, and chat socket.
# See doc/G-DemMAIN Monitor Mod.md for the protocol this exercises.

from argparse import ArgumentParser
import json
import os
import socket
import threading

import libs.config

DEFAULT_CONFIG_PATH = os.path.join(libs.config.ROOT, "config", libs.config.MODE, "g_mc_monitor", "config.json")

# Parse arguments
parser = ArgumentParser(description="Interactively test g_mc_monitor's FUSE filesystem, console socket, or chat socket")
parser.add_argument("config",
                    nargs   = "?",  # Declare this argument as optional
                    default = DEFAULT_CONFIG_PATH,
                    help    = f"Path to the mod's config JSON (default: \"{DEFAULT_CONFIG_PATH}\")")
args = parser.parse_args()

config = json.load(open(args.config, "r"))


def test_fuse():
    """Prints whatever g_mc_monitor's FUSE filesystem currently exposes."""
    mount = config["fuseMountPath"]

    def read_file(name):
        path = os.path.join(mount, name)
        if os.path.exists(path):
            print(f"{name}: {open(path).read().strip()}")
        else:
            print(f"{name}: (missing - is the mount up? see FUSE prerequisites in the doc)")

    read_file("tps")
    read_file("heap_used_bytes")
    read_file("heap_allocated_bytes")

    players_dir = os.path.join(mount, "players")
    if os.path.isdir(players_dir):
        players = os.listdir(players_dir)
        print(f"players: {players if players else '(none online)'}")
    else:
        print("players: (missing - is the mount up? see FUSE prerequisites in the doc)")


def stream_socket(port, auth_key, build_outgoing):
    """
    Connects to the given port, authenticates with auth_key, then prints every incoming line
    while forwarding each line the user types through build_outgoing (which turns the raw text
    into the JSON object to send).
    """
    sock = socket.create_connection((config["socketBindAddress"], port))
    sock_file = sock.makefile("rw", encoding="utf-8", newline="\n")
    sock_file.write(json.dumps({"authKey": auth_key}) + "\n")
    sock_file.flush()

    # Prints incoming lines until the server closes the connection
    def receive():
        for line in sock_file:
            print(f"< {line.rstrip(chr(10))}")
        print("Connection closed by server (Ctrl-C to exit)")

    threading.Thread(target=receive, daemon=True).start()

    print("Connected. Type messages to send, Ctrl-C to quit.")
    try:
        while True:
            text = input()
            sock_file.write(json.dumps(build_outgoing(text)) + "\n")
            sock_file.flush()
    except (KeyboardInterrupt, EOFError):
        print()
    finally:
        sock.close()


def test_console():
    auth_key = input("Secret: ")
    stream_socket(config["consolePort"], auth_key, lambda text: {"type": "command", "command": text})


def test_chat():
    auth_key = input("Secret: ")
    source = input("Source: ")
    username = input("Username: ")
    stream_socket(config["chatPort"], auth_key, lambda text: {"type": "message", "source": source, "username": username, "message": text})


TESTS = {
    "1": ("FUSE filesystem", test_fuse),
    "2": ("Console socket", test_console),
    "3": ("Chat socket", test_chat),
}

print("Which part do you want to test?")
for key, (label, _) in TESTS.items():
    print(f"  {key}) {label}")
choice = input("> ").strip()
if choice not in TESTS:
    raise SystemExit(f"Unknown choice: {choice}")
TESTS[choice][1]()
