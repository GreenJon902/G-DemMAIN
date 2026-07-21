# Discord bot bridging Minecraft chat and exposing /list. See doc/G-DemMAIN Monitor Mod.md for the
# protocol this talks to, and scripts/README.md for setup.

from argparse import ArgumentParser
from dotenv import load_dotenv
import asyncio
import discord
import json
import os

DEFAULT_CONFIG_PATH = "/opt/infra/static-config/g_discord/config.json"
RECONNECT_DELAY = 5  # seconds to wait between chat socket reconnect attempts

# g_mc_monitor's FUSE mount - matches the mod's default fuseMountPath (see
# static-config/g_mc/config/g_mc_monitor.json.template), hardcoded since it's not exposed as an
# env var and g_discord has no reason to read the mod's own config to get it
PLAYERS_DIR = "/var/lib/g_mc/monitor/players"

# Both g_mc_monitor sockets are loopback-only (see doc/G-DemMAIN Monitor Mod.md), so g_discord must
# run on the same host as g_mc
MC_MONITOR_HOST = "127.0.0.1"

# Name of the webhook g_discord creates in the chat channel, used to post chat messages under the
# sending player's own name instead of the bot's
WEBHOOK_NAME = "G-DemMAIN g_d*sc*rd"  # It blocks calling it discord

# Emoji shown for each chat-socket event type
EVENT_EMOJI = {
    "server_started": ":white_check_mark:",
    "server_stopped": ":octagonal_sign:",
    "player_joined": ":arrow_right:",
    "player_left": ":arrow_left:",
    "player_died": ":skull:",
    "player_advancement": ":trophy:",
}

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
config = json.load(open(args.config, "r"))
CHAT_CHANNEL_ID = int(config["chatChannelId"])

# Get required environment variables
class MissingEnvironVar(Exception): pass
def _require_env(name):
    # Returns the given environment variable, or raises with a clear message if it's unset
    if (value := os.environ.get(name)) is None:
        raise MissingEnvironVar(f"Needs environment variable {name}=...")
    return value
BOT_TOKEN = _require_env("DISCORD_BOT_TOKEN")
CHAT_AUTH_KEY = _require_env("MINECRAFT_MONITOR_CHAT_AUTH_KEY")
CHAT_PORT = int(_require_env("MINECRAFT_MONITOR_CHAT_PORT"))

intents = discord.Intents.default()
intents.message_content = True  # Needed to read the text of messages sent in the chat channel
client = discord.Client(intents=intents)
tree = discord.app_commands.CommandTree(client)

class ChatSocket:
    """
    Owns the connection to g_mc_monitor's chat socket - authenticates, reconnects every
    RECONNECT_DELAY seconds while disconnected, and forwards each incoming message/event to
    send_callback (an `async def(data: dict)`). The history envelope is filtered out here and
    never reaches send_callback. Knows nothing about Discord - send_callback and send_to_socket
    are its only points of contact with the rest of the bot.
    """

    def __init__(self, host, port, auth_key, send_callback):
        self._host = host
        self._port = port
        self._auth_key = auth_key
        self._send_callback = send_callback
        self._writer = None  # None while disconnected

    @property
    def connected(self):
        return self._writer is not None

    async def send_to_socket(self, name, text):
        """Sends a chat message from Discord to Minecraft. Only call this while connected."""
        outgoing = {"type": "message", "source": "Discord", "username": name, "message": text}
        print("Sending:", outgoing)
        self._writer.write((json.dumps(outgoing) + "\n").encode())
        await self._writer.drain()

    async def _handle_from_socket(self, line):
        # TODO: the chat socket protocol has no `datetime` field on message/event objects (unlike
        # the console socket's `line` objects) - once it does, history could be replayed for
        # messages after the last one we relayed here, instead of being ignored entirely
        print("Recieved:", line)
        data = json.loads(line)
        assert "type" in data, f"Chat socket line missing 'type': {data}"
        if data["type"] == "history":
            assert "lines" in data, f"Chat socket history line missing 'lines': {data}"
            return
        elif data["type"] == "message":
            assert "source" in data and "username" in data and "message" in data, f"Chat socket message line missing fields: {data}"
        elif data["type"] == "event":
            assert "event" in data and "message" in data, f"Chat socket event line missing fields: {data}"
        await self._send_callback(data)

    async def _listen_socket_loop(self, reader):
        # Reads lines until the server closes the connection
        while True:
            line = await reader.readline()
            if not line:
                break  # Connection closed by the server
            await self._handle_from_socket(line)

    async def run(self):
        """Connects and listens forever, reconnecting every RECONNECT_DELAY seconds while disconnected."""
        while True:
            try:
                print(f"Connecting to {self._host}:{self._port}")
                reader, writer = await asyncio.open_connection(self._host, self._port)
                writer.write((json.dumps({"authKey": self._auth_key}) + "\n").encode())
                await writer.drain()
                self._writer = writer
                print("Connected!")
                await self._listen_socket_loop(reader)
            except OSError as e:
                print("Failed to connect to socket:", str(e))
            self._writer = None
            await asyncio.sleep(RECONNECT_DELAY)

async def _get_or_create_webhook(channel):
    """Gets g_discord's webhook for channel, creating it if it doesn't already exist."""
    for webhook in await channel.webhooks():
        if webhook.name == WEBHOOK_NAME:
            return webhook
    return await channel.create_webhook(name=WEBHOOK_NAME)

chat_socket = None  # Created in on_ready, once the target Discord channel can be fetched
chat_bridge_started = False

@client.event
async def on_ready():
    """Called once the client has successfully connected to Discord."""
    global chat_bridge_started, chat_socket
    await tree.sync()
    if not chat_bridge_started:  # on_ready can fire again on reconnect, only start this once
        chat_bridge_started = True
        channel = await client.fetch_channel(CHAT_CHANNEL_ID)
        webhook = await _get_or_create_webhook(channel)

        # send_callback for ChatSocket - handle_chat_line with channel/webhook already supplied
        async def relay_to_discord(data):
            if data["type"] == "message":
                # Drop the "[source]" prefix for real in-game chat, keep it for other bridges
                name = data["username"] if data["source"] == "Minecraft" else f"[{data['source']}] {data['username']}"
                # TODO: set avatar_url to the player's Minecraft head (e.g. via https://mc-heads.net/avatar/{username}) instead of the default webhook avatar
                await webhook.send(content=data["message"], username=name)
            elif data["type"] == "event":
                emoji = EVENT_EMOJI.get(data["event"], ":question:")
                await channel.send(f"{emoji} {data['message']}")

        chat_socket = ChatSocket(MC_MONITOR_HOST, CHAT_PORT, CHAT_AUTH_KEY, relay_to_discord)
        client.loop.create_task(chat_socket.run())
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

@client.event
async def on_message(message: discord.Message):
    """Relays messages sent in the configured Discord chat channel to Minecraft chat."""
    # webhook_id is set for messages posted by the chat-bridge webhook itself (see
    # _get_or_create_webhook) - without this check we'd relay our own relayed messages right back
    if message.author == client.user or message.webhook_id is not None or message.channel.id != CHAT_CHANNEL_ID:
        return
    if chat_socket is None or not chat_socket.connected:
        await message.channel.send("Couldn't reach the Minecraft server - is it down?")
        return
    # clean_content resolves mentions/channels/roles to their readable form (e.g. "@Notch") instead
    # of raw IDs (e.g. "<@123456789012345678>"), which is what content would otherwise contain
    await chat_socket.send_to_socket(message.author.display_name, message.clean_content)

client.run(BOT_TOKEN)
