# Discord bot bridging Minecraft chat and exposing /list. See doc/G-DemMAIN Monitor Mod.md for the
# protocol this talks to, and doc/G-DemMAIN Discord Bot.md for setup.

import discord
import asyncio

from libs.config import readEnviron

# Create discord client instance
BOT_TOKEN = readEnviron("DISCORD_BOT_TOKEN", str)

intents = discord.Intents.default()
intents.message_content = True  # Needed to read the text of messages sent in the chat channel
client = discord.Client(intents=intents)

# Set up events
from subscriptor import subscribe_to, register_client_instance, dispatch_event
register_client_instance(client)
from subscriptor import tree

# Load modules
import minecraft_chat_module
import administration_module.tempmute
import administration_module.warn
import leveling_module

# We need to sync the tree so commands work
@subscribe_to("ready")
async def on_ready(_):
    await tree.sync()
    print("Tree has synced!")

# Run the bot
try:
    client.run(BOT_TOKEN)
finally:
    asyncio.run(dispatch_event("stop"))
