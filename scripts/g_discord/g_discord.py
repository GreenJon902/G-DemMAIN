# Discord bot bridging Minecraft chat and exposing /list. See doc/G-DemMAIN Monitor Mod.md for the
# protocol this talks to, and doc/G-DemMAIN Discord Bot.md for setup.

import discord
import asyncio

from libs.config import readConfig, readEnviron

BOT_TOKEN = readEnviron("DISCORD_BOT_TOKEN", str)
STATUS_TEXT = readConfig("g_discord/config.json", str, "g_discord", "statusText")

# Create discord client instance
intents = discord.Intents.default()
intents.message_content = True  # Needed to read the text of messages sent in the chat channel
intents.members = True  # Needed for member_join/raw_member_remove/user_update (administration_module.log)
client = discord.Client(intents=intents)

# Set up events
from subscriptor import subscribe_to, register_client_instance, dispatch_event
register_client_instance(client)
from subscriptor import tree

# Load modules
import minecraft_chat_module
import administration_module.tempmute
import administration_module.warn
import administration_module.log
import leveling_module
import mc_stats_graph_module

@subscribe_to("ready")
async def on_ready(client_):
    # We need to sync the tree so commands work
    await tree.sync()
    print("Tree has synced!")

    # Set status
    await client_.change_presence(
            activity=discord.CustomActivity(
                name=STATUS_TEXT
            )
    )

# Run the bot
try:
    client.run(BOT_TOKEN)
finally:
    asyncio.run(dispatch_event("stop"))
