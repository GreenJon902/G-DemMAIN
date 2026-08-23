from subscriptor import subscribe_to, tree
from libs.config import readConfig, resolvePath
import discord
import os
import json
from datetime import datetime, timedelta
import random
from math import sqrt, floor, ceil
import asyncio

XP_FILE = resolvePath(readConfig("g_discord/config.json", str, "leveling_module", "userXpFilePath"))
MIN_AWARDED_XP = readConfig("g_discord/config.json", int, "leveling_module", "minAwardedXp")
MAX_AWARDED_XP = readConfig("g_discord/config.json", int, "leveling_module", "maxAwardedXp")
AWARD_COOLDOWN = timedelta(seconds = readConfig("g_discord/config.json", int, "leveling_module", "awardCooldown"))
LEVEL_XP_CURVE_A = readConfig("g_discord/config.json", int, "leveling_module", "levelXpCurve", "a")
LEVEL_XP_CURVE_B = readConfig("g_discord/config.json", int, "leveling_module", "levelXpCurve", "b")

DISK_WRITE_WAIT_PERIOD = 60 # Seconds
PROGRESS_BAR_LENGTH = 25  # Specifically the number of equals and dashes

# Stores how much xp each user has
user_xp: dict[int, int] = ({int(k): int(v) for k, v in json.load(open(XP_FILE, "r")).items()}   # JSON key is string, so convert to int
     if os.path.exists(XP_FILE) else {})  # Maps account id to xp

# There is a cooldown to earning xp, so we need to know when a member/user was last awarded xp
# We don't commit this to disk as it's not mission critical that awarding is exact, and the cooldown is like a minute anyway
user_time_xp_awarded: dict[discord.Member | discord.User, datetime] = {}

@subscribe_to("message")
async def on_message(client: discord.Client, message: discord.Message):
    """
    Awards the sender a random amount of xp in [MIN_AWARDED_XP, MAX_AWARDED_XP] if they haven't been awarded in the last AWARD_COOLDOWN seconds.
    """
    
    author = message.author

    # Don't award xp for bots/webhooks, or for the "User used /command" messages Discord posts for
    # slash command invocations - message.type is only MessageType.default for organic chat
    if author.bot or message.webhook_id is not None or message.type != discord.MessageType.default:
        return

    # Check cooldown
    if author in user_time_xp_awarded and datetime.now() <= user_time_xp_awarded[author] + AWARD_COOLDOWN:
        return
    
    # Award xp
    prev_level = xp_to_level(user_xp.get(author.id, 0))
    user_xp[author.id] = user_xp.get(author.id, 0) + random.randint(MIN_AWARDED_XP, MAX_AWARDED_XP)
    post_level = xp_to_level(user_xp[author.id])
    user_time_xp_awarded[author] = datetime.now()
 
    asyncio.create_task(queue_disk_write())
    
    # Check if leveled up
    if prev_level != post_level:
        await message.reply(f"GG {author.mention}, you just bossed a new level, your now {post_level} ||yrs old||!")


@tree.command(name="level", description="Shows a member's level")
async def level_command(interaction: discord.Interaction, member: discord.Member = None):
    member = member or interaction.user
    
    xp = user_xp.get(member.id, 0)
    rank = sum(v >= xp for k, v in user_xp.items())
    level = xp_to_level(xp)
    xp_of_current_level = level_to_xp(level)
    xp_of_next_level = level_to_xp(level + 1)
    
    xp_of_level = xp_of_next_level - xp_of_current_level
    xp_into_level = (xp - xp_of_current_level)

    # Create progress bar
    progress_through_level = xp_into_level / xp_of_level
    progress_bar = "|" + "=" * floor(PROGRESS_BAR_LENGTH * progress_through_level) + ">" + "-" * ceil(PROGRESS_BAR_LENGTH * (1 - progress_through_level)) + "|"

    # Create embed
    embed = discord.Embed(description=f"**Level {level} - Rank #{rank}**\n{progress_bar} {xp_into_level}/{xp_of_level} XP", colour=discord.Colour.green())
    embed.set_author(name=f"{member.display_name}", icon_url=member.display_avatar.url)
    await interaction.response.send_message(embed=embed)


@subscribe_to("stop")
async def on_stop():
    """
    Force a write if the program is stopping, as the queued write may not have time to execute.
    """
    flush_xp_to_disk()


def level_to_xp(level: int) -> int:
    """
    Returns the total xp required for a user to be at a given level.
    """
    return LEVEL_XP_CURVE_A*level**2 + LEVEL_XP_CURVE_B*level

def xp_to_level(xp: int) -> int:
    """
    Returns the level of a user with a given amount of xp.
    """
    return max(0, floor((-LEVEL_XP_CURVE_B + sqrt(LEVEL_XP_CURVE_B ** 2 - 4 * LEVEL_XP_CURVE_A * (-xp))) / (2 * LEVEL_XP_CURVE_A)))


_write_queued = False
async def queue_disk_write():
    """
    If there is no disk write currently queued, then it will schedule one in DISK_WRITE_WAIT_PERIOD seconds.
    This is because we don't want to write to the disk for every (awarded) message.
    """
    global _write_queued

    # Handle blocking
    if _write_queued:
        return
    _write_queued = True

    await asyncio.sleep(DISK_WRITE_WAIT_PERIOD)

    # Write to file
    _write_queued = False
    flush_xp_to_disk()

def flush_xp_to_disk():
    """
    Writes user_xp to disk immediately, bypassing queue_disk_write's debounce.
    """
    with open(XP_FILE, "w") as fd:
        print("Flushing user xp data to disk...")
        json.dump(user_xp, fd)

    
