# Discord bot bridging Minecraft chat and exposing /list. See doc/G-DemMAIN Monitor Mod.md for the
# protocol this talks to, and scripts/README.md for setup.

from argparse import ArgumentParser
from dotenv import load_dotenv
import os

DEFAULT_CONFIG_PATH = "/opt/infra/static-config/g_discord/config.json"

# Load .devenv for local development. This is a no-op in production, where systemd's
# EnvironmentFile= has already populated everything, since load_dotenv never overrides variables
# that are already set
load_dotenv(os.path.join(os.path.dirname(__file__), ".devenv"))

# Parse arguments
parser = ArgumentParser(description="See scripts/README.md")
parser.add_argument("config",
                    nargs   = "?",  # Declare this argument as optional
                    default = DEFAULT_CONFIG_PATH,
                    help    = f"Path to the static config JSON (default: \"{DEFAULT_CONFIG_PATH}\")")
args = parser.parse_args()

# Get the bot token
class NoTokenInEnviron(Exception): pass
if (BOT_TOKEN := os.environ.get("DISCORD_BOT_TOKEN")) is None:
    raise NoTokenInEnviron("Needs environment variable DISCORD_BOT_TOKEN=...")

print(f"Loaded bot token and config path ({args.config})")
