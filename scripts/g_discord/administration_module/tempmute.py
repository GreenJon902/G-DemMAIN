import asyncio
import re

import discord
from discord import app_commands

from subscriptor import tree, subscribe_to
from utils import get_or_create_role

DURATION_PATTERN = re.compile(r"^(\d+)([dhms])$")
DURATION_MULTIPLIERS = {"d": 24 * 60 * 60, "h": 60 * 60, "m": 60, "s": 1}

MUTED_ROLE_NAME = "Muted"

# Discord caps plain message content at this many characters
MAX_MESSAGE_LENGTH = 2000

async def get_muted_role(guild):
    """Gets guild's Muted role, creating it (coloured grey) if it doesn't already exist."""
    return await get_or_create_role(guild, MUTED_ROLE_NAME, colour=discord.Colour.light_grey())

def _overwrite_is_empty(overwrite: discord.PermissionOverwrite) -> bool:
    """True if overwrite sets nothing at all (every permission left at its inherited default)."""
    return all(value is None for _, value in overwrite)

def _overwrite_matches_target(overwrite: discord.PermissionOverwrite) -> bool:
    """True if overwrite denies only send_messages and leaves every other permission at default."""
    for name, value in overwrite:
        expected = False if name == "send_messages" else None
        if value != expected:
            return False
    return True

async def _fix_channel_muted_perm(channel):
    """
    Resets channel's Muted-role overwrite to exactly send_messages=False, regardless of its
    current state. Passing keyword permissions to set_permissions replaces any existing overwrite
    outright rather than merging with it, so a single call is equivalent to removing then
    re-adding the role's overwrite from scratch.
    """
    role = await get_muted_role(channel.guild)
    await channel.set_permissions(role, send_messages=False)
    return role

async def _get_channel_creator(channel):
    """Looks up who created channel via the audit log, or returns None if that can't be determined."""
    async for entry in channel.guild.audit_logs(action=discord.AuditLogAction.channel_create, limit=10):
        if entry.target.id == channel.id:
            return entry.user
    return None

async def _send_chunked(interaction, lines):
    """Sends lines as one or more ephemeral followups, splitting whenever adding the next line
    would push the current chunk over Discord's message content limit."""
    chunk = ""
    for line in lines:
        candidate = f"{chunk}\n{line}" if chunk else line
        if len(candidate) > MAX_MESSAGE_LENGTH:
            await interaction.followup.send(chunk, ephemeral=True)
            chunk = line
        else:
            chunk = candidate
    if chunk:
        await interaction.followup.send(chunk, ephemeral=True)

@tree.command(name="tempmute", description="Mute a player for a finite amount of time")
@app_commands.default_permissions(moderate_members=True)
async def tempmute_command(interaction: discord.Interaction, user: discord.Member, duration: str):
    # Parse duration
    match = DURATION_PATTERN.match(duration)
    if match is None:
        await interaction.response.send_message("Invalid duration!", ephemeral=True)
        return
    amount, unit = match.groups()
    duration_secs = int(amount) * DURATION_MULTIPLIERS[unit]

    # Mute
    role = await get_muted_role(interaction.guild)
    await user.add_roles(role)
    print(f"Muting {user} for {duration_secs} seconds")
    await interaction.response.send_message(f"Muted {user.mention} for {duration}", ephemeral=True)

    # Unmute
    await asyncio.sleep(duration_secs)
    await user.remove_roles(role)
    print(f"Unmuted {user} after {duration_secs} seconds")

@subscribe_to("guild_channel_create")
async def on_guild_channel_create(client, channel):
    """Auto-applies the mute-block permission overwrite to newly created channels and DMs the
    creator a heads-up, if they can be identified from the audit log."""
    if not hasattr(channel, "set_permissions"):
        return

    await _fix_channel_muted_perm(channel)
    print(f"Auto-applied mute-block permission to new channel #{channel}")

    creator = await _get_channel_creator(channel)
    if creator is None:
        print(f"Couldn't determine who created #{channel}, skipping notification")
        return
    try:
        await creator.send(f"Added muted role permissions to {channel.mention}.")
    except discord.Forbidden:
        print(f"Couldn't DM {creator} about #{channel} (DMs closed)")

@tree.command(name="check-muted-perms", description="Report the mute-block permission status of every channel")
@app_commands.default_permissions(manage_channels=True)
async def check_muted_perms_command(interaction: discord.Interaction):
    await interaction.response.defer(ephemeral=True)
    role = await get_muted_role(interaction.guild)

    lines = []
    for channel in interaction.guild.channels:
        if not hasattr(channel, "set_permissions"):
            continue
        overwrite = channel.overwrites_for(role)
        if _overwrite_matches_target(overwrite):
            lines.append(f":white_check_mark: {channel.mention} is correctly configured.")
        elif _overwrite_is_empty(overwrite):
            lines.append(f":x: {channel.mention} has no muted role.")
        else:
            lines.append(f":question: {channel.mention} has muted role but incorrectly configured.")

    await _send_chunked(interaction, lines)

@tree.command(name="fix-muted-perm", description="Fix the mute-block permission on a channel")
@app_commands.default_permissions(manage_channels=True)
async def fix_muted_perm_command(interaction: discord.Interaction, channel: discord.abc.GuildChannel):
    if not hasattr(channel, "set_permissions"):
        await interaction.response.send_message(f"{channel.mention} doesn't support permission overwrites.", ephemeral=True)
        return
    await _fix_channel_muted_perm(channel)
    print(f"Fixed mute-block permission on #{channel}")
    await interaction.response.send_message(f"Fixed the mute-block permission on {channel.mention}.", ephemeral=True)
