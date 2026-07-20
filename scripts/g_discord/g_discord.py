# Discord bot bridging Minecraft chat and exposing /list. See doc/G-DemMAIN Monitor Mod.md for the
# protocol this talks to, and scripts/README.md for setup.

from argparse import ArgumentParser
from dotenv import load_dotenv
import discord
import os

DEFAULT_CONFIG_PATH = "/opt/infra/static-config/g_discord/config.json"

# g_mc_monitor's FUSE mount - matches the mod's default fuseMountPath (see
# static-config/g_mc/config/g_mc_monitor.json.template), hardcoded since it's not exposed as an
# env var and g_discord has no reason to read the mod's own config to get it
PLAYERS_DIR = "/home/greenjon902/Desktop/G-DemMAIN/.claude/worktrees/fluttering-greeting-zephyr/scripts/g_mc/g_mc_monitor/fuse/players"#"/var/lib/g_mc/monitor/players"

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
assert os.path.exists(args.config), f"Config path - '{args.config}' - does not exist"

# Get the bot token
class NoTokenInEnviron(Exception): pass
if (BOT_TOKEN := os.environ.get("DISCORD_BOT_TOKEN")) is None:
    raise NoTokenInEnviron("Needs environment variable DISCORD_BOT_TOKEN=...")

client = discord.Client(intents=discord.Intents.default())
tree = discord.app_commands.CommandTree(client)

@client.event
async def on_ready():
    """Called once the client has successfully connected to Discord."""
    await tree.sync()
    print(f"Logged in as {client.user}")

@tree.command(name="list", description="List the players currently online on Minecraft")
async def list_command(interaction: discord.Interaction):
    """Replies with the online Minecraft players, read from g_mc_monitor's FUSE filesystem."""
    if not os.path.isdir(PLAYERS_DIR):
        await interaction.response.send_message("Couldn't reach the Minecraft server - is it down?", ephemeral=True)
        return
    players = sorted(os.listdir(PLAYERS_DIR))
    if players:
        await interaction.response.send_message(f"Online players ({len(players)}): {', '.join(players)}", ephemeral=True)
    else:
        await interaction.response.send_message("No players online.", ephemeral=True)

client.run(BOT_TOKEN)
