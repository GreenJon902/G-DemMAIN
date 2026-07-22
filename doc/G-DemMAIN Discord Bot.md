# G-DemMAIN Discord Bot - `g_discord`

A Python bot (`scripts/g_discord/g_discord.py`) bridging Minecraft chat to Discord and exposing
`/list`. It talks to `g_mc_monitor`'s chat socket and FUSE filesystem - see
[G-DemMAIN Monitor Mod.md](G-DemMAIN%20Monitor%20Mod.md) for that protocol. This doc covers setting
the bot up on Discord's side: the application, its token/intents/permissions, and inviting it to
the server.

## Discord Developer Portal setup

1. Create an application at https://discord.com/developers/applications (any name - it's shown as
   the bot's username).
2. **Bot tab**: click "Reset Token" to get the bot's token. This is `DISCORD_BOT_TOKEN` (see
   `environ/g_discord_bot`) - it's a secret, treat it like a password.
3. **Bot tab → Privileged Gateway Intents**: enable **Message Content Intent**. This is required
   for the bot to read the text of messages sent in the chat-bridge channel - without it,
   `g_discord.py` fails to start with `discord.errors.PrivilegedIntentsRequired`.
4. No other privileged intents are needed - `/list` reads the FUSE filesystem directly, not
   anything Discord-side, and slash commands don't need any intent at all.

## Permissions

The bot needs, in the Discord server (and specifically in the channel used for
`DISCORD_CHAT_CHANNEL_ID` - see Config below):
- **Send Messages** - to relay Minecraft chat/events into Discord.
- **Use Slash Commands** - to make `/list` invocable.
- **Manage Webhooks** - chat messages are relayed via a webhook (created automatically the first
  time the bot starts, named `g_discord chat bridge`) so each one can be posted under the sending
  player's own name instead of the bot's.

These are picked as part of generating the invite URL below, not set separately.

## Inviting the bot to the server

**OAuth2 tab → URL Generator**: under Scopes, check `bot` and `applications.commands`. Under Bot
Permissions (which appears once `bot` is checked), check Send Messages, Use Slash Commands and
Manage Webhooks (see [Permissions](#permissions)). Copy the generated URL, open it in a browser,
and authorize it into the server - this is the standard, portal-generated invite link, nothing
hand-built is needed.

Note that `/list` is registered as a **global** command (`tree.sync()` with no guild specified) -
Discord can take up to an hour to propagate a newly-registered global command to clients the first
time, so don't be surprised if `/list` doesn't show up immediately after inviting the bot.

## Config

- `environ/g_discord_bot`: `DISCORD_BOT_TOKEN` (see [Discord Developer Portal setup](#discord-developer-portal-setup)).
- `environ/g_mc_g_discord_minecraft`: `MINECRAFT_MONITOR_CHAT_AUTH_KEY`/`MINECRAFT_MONITOR_CHAT_PORT`,
  shared with `g_mc` - see [G-DemMAIN Monitor Mod.md](G-DemMAIN%20Monitor%20Mod.md).
- `environ/g_discord_bot`: `DISCORD_CHAT_CHANNEL_ID` - the Discord channel the bridge posts to
  and reads from. To get a channel's ID, enable Developer Mode (User Settings → Advanced), then
  right-click the channel → Copy Channel ID. Supplied per-install, not committed to the repo.
