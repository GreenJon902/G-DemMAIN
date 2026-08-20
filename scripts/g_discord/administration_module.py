import asyncio
import re

import discord

from subscriptor import tree
from utils import get_or_create_role

DURATION_PATTERN = re.compile(r"^(\d+)([dhms])$")
DURATION_MULTIPLIERS = {"d": 24 * 60 * 60, "h": 60 * 60, "m": 60, "s": 1}

MUTED_ROLE_NAME = "Muted"

@tree.command(name="tempmute", description="Mute a player for a finite amount of time")
async def tempmute_command(interaction: discord.Interaction, user: discord.Member, duration: str):
    # Parse duration
    match = DURATION_PATTERN.match(duration)
    if match is None:
        await interaction.response.send_message("Invalid duration!", ephemeral=True)
        return
    amount, unit = match.groups()
    duration_secs = int(amount) * DURATION_MULTIPLIERS[unit]

    # Mute
    role = await get_or_create_role(interaction.guild, MUTED_ROLE_NAME)
    await user.add_roles(role)
    print(f"Muting {user} for {duration_secs} seconds")
    await interaction.response.send_message(f"Muted {user.mention} for {duration}", ephemeral=True)

    # Unmute
    await asyncio.sleep(duration_secs)
    await user.remove_roles(role)
    print(f"Unmuted {user} after {duration_secs} seconds")

@tree.command(name="warn", description="Warn a user")
async def warn_command(interaction: discord.Interaction, user: discord.Member, reason: str = None):
    embed = discord.Embed(color=discord.Color.orange())
    embed.set_author(name=f"{user} has been warned", icon_url=user.display_avatar.url)
    if reason is not None:
        embed.description = f"**Reason:** {reason}"
    await interaction.response.send_message(embed=embed)
    # This intentionally takes no action - outside of sending a message. It's purely to mess with people
