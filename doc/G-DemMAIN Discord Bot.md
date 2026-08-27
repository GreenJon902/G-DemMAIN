# G-DemMAIN Discord Bot - `g_discord`

A Python bot (`scripts/g_discord/g_discord.py`) bridging Minecraft chat to Discord and exposing `/list`.
It talks to `g_mc_monitor`'s chat socket and FUSE filesystem - see [G-DemMAIN Monitor Mod.md](G-DemMAIN%20Monitor%20Mod.md) for that protocol.
It also provides some other utilites - administration, leveling, etc. (see modules).
This doc covers setting the bot up on Discord's side: the application, its token/intents/permissions, and inviting it to the server.

## Discord Developer Portal setup

1. Create an application at https://discord.com/developers/applications (any name - it's shown as the bot's username).
2. **Bot tab**: click "Reset Token" to get the bot's token.
   This is `DISCORD_BOT_TOKEN` (see `environ/g_discord_bot`) - it's a secret, treat it like a password.
3. **Bot tab → Privileged Gateway Intents**: enable **Message Content Intent** and **Server Members Intent**.
   Message Content Intent is required for the bot to read the text of messages sent in the chat-bridge channel.
   Server Members Intent is required for `administration_module.log`'s member-join/leave/profile-update events.
   Without either, `g_discord.py` fails to start with `discord.errors.PrivilegedIntentsRequired`.
4. No other privileged intents are needed - `/list` reads the FUSE filesystem directly, not anything Discord-side, and slash commands don't need any intent at all.

## Permissions

The bot needs, in the Discord server:
- **Send Messages**
- **Use Slash Commands**
- **Manage Webhooks** - chat messages are relayed via a webhook (created automatically the first time the bot starts, named `g_discord chat bridge`) so each one can be posted under the sending player's own name instead of the bot's.

These are picked as part of generating the invite URL below, not set separately.

## Inviting the bot to the server

**OAuth2 tab → URL Generator**: under Scopes, check `bot` and `applications.commands`.
Under Bot Permissions (which appears once `bot` is checked), check Send Messages, Use Slash Commands and Manage Webhooks (see [Permissions](#permissions)).
Copy the generated URL, open it in a browser, and authorize it into the server - this is the standard, portal-generated invite link, nothing hand-built is needed.

Note that `/list` is registered as a **global** command (`tree.sync()` with no guild specified) - Discord can take up to an hour to propagate a newly-registered global command to clients the first time, so don't be surprised if `/list` doesn't show up immediately after inviting the bot.

## Config

- `environ/g_discord_bot`: `DISCORD_BOT_TOKEN` (see [Discord Developer Portal setup](#discord-developer-portal-setup)).
- `environ/g_mc_g_discord_minecraft`: `MINECRAFT_MONITOR_CHAT_AUTH_KEY`, shared with `g_mc` - see [G-DemMAIN Monitor Mod.md](G-DemMAIN%20Monitor%20Mod.md).
  The chat socket's host/port (`socketBindAddress`/`chatPort`) aren't env vars - they're read straight from `g_mc_monitor`'s own `config.json`, same as the mod itself uses.
- `environ/g_discord_bot`: `DISCORD_CHAT_CHANNEL_ID` - the Discord channel the bridge posts to and reads from.
  To get a channel's ID, enable Developer Mode (User Settings → Advanced), then right-click the channel → Copy Channel ID.
  Supplied per-install, not committed to the repo.
- `environ/g_discord_bot`: `DISCORD_MEMBER_LOG_CHANNEL_ID` - the Discord channel `administration_module.log` posts member-join/leave/profile-update events to.
  Checked against a real channel on startup (`client.fetch_channel`) - the bot exits immediately if it doesn't resolve.
- `g_discord/config.json`: settings for `leveling_module` -
  - `leveling_module.userXpFilePath` - where per-user XP is persisted (`/var/lib/g_discord/userXp.json` in prod).
  - `leveling_module.minAwardedXp`/`leveling_module.maxAwardedXp` - range of XP awarded per eligible message.
  - `leveling_module.awardCooldown` - seconds a user must wait between XP awards.
  - `leveling_module.levelXpCurve.a`/`leveling_module.levelXpCurve.b` - the `a*level^2 + b*level` curve mapping level to total XP required.
  - `g_discord.tatusText` - the status text of the bot. Can contain unicode-characters (so supports emojis characters, but not ":emojis_like\_this:").

## Running

`python3 g_discord.py`, no arguments - all configuration comes from the environment/config files above.
In production this runs as `g_discord.service` (see [Services.md](Services.md) and `config/prod/systemd-services/g_discord.service`).

Must be stopped with **SIGINT** - this allows `g_discord.py` to this to shut down cleanly and flush in-memory state (e.g. `leveling_module`'s XP data) to disk before exiting. 
