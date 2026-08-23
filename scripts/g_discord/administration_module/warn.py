import discord

from subscriptor import tree

@tree.command(name="warn", description="Warn a user")
async def warn_command(interaction: discord.Interaction, user: discord.Member, reason: str = None):
    embed = discord.Embed(color=discord.Color.orange())
    embed.set_author(name=f"{user} has been warned", icon_url=user.display_avatar.url)
    if reason is not None:
        embed.description = f"**Reason:** {reason}"
    await interaction.response.send_message(embed=embed)
    # This intentionally takes no action - outside of sending a message. It's purely to mess with people
