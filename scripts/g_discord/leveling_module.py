from subscriptor import subscribe_to, tree
from libs.config import readConfig, resolvePath
import discord
from discord import app_commands
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
PROGRESS_BAR_LENGTH = 25  # Specifically the number of equals and dashes and the singular ">"

PAGE_SIZE = 10
MAX_CROPPED_PLAYER_NAME_LENGTH =  15

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
    """ Command to show level for just the given user. """
    member = member or interaction.user
    
    # Load data for rendering
    xp = user_xp.get(member.id, 0)
    rank = sum(v >= xp for k, v in user_xp.items())
    level = xp_to_level(xp)
    xp_of_current_level = level_to_xp(level)
    xp_of_next_level = level_to_xp(level + 1)
    
    xp_of_level = xp_of_next_level - xp_of_current_level
    xp_into_level = (xp - xp_of_current_level)
    progress_through_level = xp_into_level / xp_of_level


    # Design:
    # 
    # 
    # Rank #1       Level 509 (12212323 XP)
    # |==============>------|     4/103 XP
    #                   
    #  <------------------->        PROGRESS_BAR_LENGTH - does not include pipe chars
    #        <--a-->                Pad space between rank and level so last number of level aligns with pipe
    #                        <-b->  Pad space betewen level and total-xp or pipe and level xp so XP text aligns
    #                        <-c->  `b` is between level and total-xp, `c` is between pipe and level-xp
    # Should any number of spaces be less than 1, print a complaint and set to one

    # Render components
    rank_text = f"Rank #{rank}"
    level_text = f"Level {level}"
    total_xp_text = f"({xp} XP)"  # Includes brackets
    level_xp_text = f"{xp_into_level}/{xp_of_level} XP"
    progress_bar_text = "|" + "=" * floor(PROGRESS_BAR_LENGTH * progress_through_level) + ">" + "-" * (ceil(PROGRESS_BAR_LENGTH * (1 - progress_through_level)) - 1) + "|"  # Includes pipes

    # Calculate space sizes
    space_count_a = len(progress_bar_text) - len(rank_text) - len(level_text)
    space_count_c = len(total_xp_text) - 1 - len(level_xp_text) + 1  # Plus one for that initial space
    space_count_b = len(level_xp_text) - len(total_xp_text) + 1 + 1  # Just the inverse of b

    if space_count_a < 1:
        print(f"Space count for `a` is less than 1 for \"{member.name}\"!!")
        space_count_a = 1
    space_count_b = max(space_count_b, 1)  # Either both are 0 in which case we can just add one and it stays aligned
    space_count_c = max(space_count_c, 1)  #     or one must be positive and hence at least one, so set the other to 1

    # Assemble
    embed_content = rank_text + " " * space_count_a + level_text + " " * space_count_b + total_xp_text + "\n" + \
                    progress_bar_text + " " * space_count_c + level_xp_text
    embed_content = f"```{embed_content}```"  # We need codeblock for monospace font

    # Create embed
    embed = discord.Embed(description=embed_content, colour=discord.Colour.green())
    embed.set_author(name=f"{member.display_name}", icon_url=member.display_avatar.url)
    await interaction.response.send_message(embed=embed)


@tree.command(name="leaderboard", description="Show the sorted ranks of multiple players")
@app_commands.describe(
    page="The page number to show, 1 for the first page."
)
async def leaderboard_command(interaction: discord.Interaction, page: app_commands.Range[int, 1] = 1):
    """ Command to show (paginated) leaderboard. `page=1` is the first page. """

    # Validate page param.
    # Discord rejects any non-natural numbers, so just check upper-bound
    page_count = max(1, ceil(len(user_xp) / PAGE_SIZE))
    if page > page_count:
        await interaction.response.send_message(f"There are only {page_count} page(s) on the leaderboard!", ephemeral=True)
        return

    # Resolving usernames can take some time, this tells discord to allow us more time
    await interaction.response.defer()

    # Get content to display
    start_i = PAGE_SIZE * (page - 1) + 1  # Rank of first player
    content = sorted(user_xp.items(), key=lambda mem_xp: mem_xp[1], reverse=True)[PAGE_SIZE * (page - 1) : PAGE_SIZE * page]
    content = [(start_i + j, (await resolve_cropped_member_name(interaction, item[0])), item[1])
               for j, item in enumerate(content)]  # Resolve names


    # Design:
    # 
    # n1.   name_1   - Level 123 
    # n2.   name_2   - Level 2  
    # n123. name_123 - Level 1 
    # <-a-> <---b-->   

    # Render components for each line
    lines_components = [(f"{i}.", name, f"Level {xp_to_level(xp)}") for (i, name, xp) in content]
    
    # Calculate (max) widths
    a_size = max([len(line[0]) for line in lines_components] + [0])  # When no data then will fallback to width 0
    b_size = max([len(line[1]) for line in lines_components] + [0])

    # Assemble
    lines = [f"{cs[0].ljust(a_size)} {cs[1].ljust(b_size)} - {cs[2]}"
             for cs in lines_components]
    embed_content = f"```{'\n'.join(lines)}```"  # We need codeblock for monospace font

    # Create embed
    embed = discord.Embed(title=f"{interaction.guild.name}'s Leaderboard - Page {page}", description=embed_content, colour=discord.Colour.green())
    await interaction.followup.send(embed=embed)

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

async def resolve_cropped_member_name(interaction: discord.Interaction, member_id: int) -> str:
    """
    Resolves the discord user-id to a name.
    If a user has a nickname then that is used.
    If no name can be found then "Unkown user" is returned.

    It then tries to intellegently split the name so it is not longer than MAX_CROPPED_PLAYER_NAME_LENGTH.
    """
    # Pull member name
    member = interaction.guild.get_member(member_id)
    if member is not None:
        name = member.display_name

    else:
        # Not cached, so ask discord - the member intent means this normally only happens for accounts that have left
        try:
            name =  (await interaction.guild.fetch_member(member_id)).display_name
        except discord.HTTPException:

            try:
                name =  (await interaction.client.fetch_user(member_id)).display_name
            except discord.HTTPException:
                print(f"Failed to resolve name for {member_id}")
                return "Unkown user"

    # Crop name:
    if len(name) <= MAX_CROPPED_PLAYER_NAME_LENGTH:
        return name  # name is fine as is
    
    # Attempt after trim numbers
    stripped = name.rstrip("0123456789")
    if len(stripped) <= MAX_CROPPED_PLAYER_NAME_LENGTH:
        return stripped

    # Try to cut at spaces
    parts = [part for part in name.split(" ") if part != ""]
    if len(parts[0]) > MAX_CROPPED_PLAYER_NAME_LENGTH:
        # This won't work so return a hard crop
        return name[:MAX_CROPPED_PLAYER_NAME_LENGTH]
    together = ""
    while len(parts) != 0 and len(together) + len(parts[0]) <= MAX_CROPPED_PLAYER_NAME_LENGTH:
        together += parts.pop(0) + " "
    return together.strip()


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

    
