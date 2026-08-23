import discord

from subscriptor import subscribe_to
from libs.config import readEnviron
from libs.wrappedCalls import exit_all_on_fail

MEMBER_LOG_CHANNEL_ID = readEnviron("DISCORD_MEMBER_LOG_CHANNEL_ID", int)

log_channel = None  # Fetched in on_ready, once the client is connected
log_channel_fetched = False

@subscribe_to("ready")
async def on_ready(client):
    """
    Fetches the member log channel. A broken channel ID means member logging can never work, so
    exit_all_on_fail fails loudly and takes the whole process down instead of leaving the client
    running with logging silently going nowhere.
    """
    global log_channel, log_channel_fetched
    if not log_channel_fetched:  # on_ready can fire again on reconnect, only fetch once
        log_channel = await exit_all_on_fail(client.fetch_channel, MEMBER_LOG_CHANNEL_ID, on_error_msg="Failed to fetch member log channel:")
        log_channel_fetched = True

@subscribe_to("member_join")
async def on_member_join(client, member: discord.Member):
    await log_channel.send(f":inbox_tray: {member.mention} joined the server - `{member}`!")

@subscribe_to("raw_member_remove")
async def on_raw_member_remove(client, payload: discord.RawMemberRemoveEvent):
    await log_channel.send(f":outbox_tray: {payload.user.mention} left the server - `{payload.user}`!")

@subscribe_to("user_update")
async def on_user_update(client, before: discord.User, after: discord.User):
    """
    Logs username/display name/avatar changes.
    This does not send logs for bot accounts.
    """

    if before.bot:
        return

    changes = []
    embeds = []
    if before.name != after.name:
        changes.append(f"Username - `{before.name}` -> `{after.name}`")
    if before.global_name != after.global_name:
        changes.append(f"Display Name - `{before.global_name}` -> `{after.global_name}`")
    if before.avatar != after.avatar:
        changes.append("Avatar Changed")
        # display_avatar falls back to the default avatar for users with no custom one set
        embeds = [
            discord.Embed(title="Before").set_image(url=before.display_avatar.url),
            discord.Embed(title="After").set_image(url=after.display_avatar.url),
        ]
    if not changes:
        return
    await log_channel.send(f":pencil2: {after.mention} updated their profile:\n{',\n'.join(changes)}.", embeds=embeds)
