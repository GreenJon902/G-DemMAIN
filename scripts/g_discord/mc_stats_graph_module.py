from subscriptor import tree, subscribe_to
from libs.config import readConfig, resolvePath
import discord
from discord import app_commands
from itertools import islice
from datetime import datetime
import matplotlib
matplotlib.use("Agg")  # No display attached to the bot process
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import aiohttp
import asyncio
import json
import io
import os

# Directory of <yyyy-mm-dd-hh-mm-ss>/<uuid>.json stats are stored
STATS_DIR = resolvePath(readConfig("g_copy_mc_stats/config.json", str, "dest_path"))

# We take only stats produced by minecraft (so no mods)
STAT_NAMESPACE = "minecraft:"

# Most choices discord accepts in an autocomplete response
MAX_AUTOCOMPLETE_CHOICES = 25

# Snapshot folder name format
SNAPSHOT_FOLDER_FORMAT = "%Y-%m-%d-%H-%M-%S"

# Format of datetimes on graph's x-axis
GRAPH_DATE_FORMAT = "%y-%m-%d"

# Where a player's username is looked up by uuid - {name: str, id: uuid} on success
MOJANG_PROFILE_LOOKUP_URL = "https://api.minecraftservices.com/minecraft/profile/lookup/{}"

_strip_namespace_warned: set[str] = set()  # Keys already warned about
def _strip_namespace(key: str, source: str) -> str | None:
    """
    Removes STAT_NAMESPACE from a raw stats file key, returning None if the key isn't in that namespace.
    Sends a message if the namespace on the key differs from STAT_NAMESPACE.

    :param key: Raw key as it appears in a stats file, e.g. "minecraft:used"
    :param source: Path of the file the key came from, only used for the warning message
    """
    if key.startswith(STAT_NAMESPACE):
        return key[len(STAT_NAMESPACE):]
    else:
        # Invalid namespace: warn if not already warned
        if key not in _strip_namespace_warned:
            _strip_namespace_warned.add(key)
            print(f"Ignoring stat key {key!r} (from {source}) as it is not in the '{STAT_NAMESPACE}' namespace")
        return None


def _list_snapshots() -> list[str]:
    """ Returns the sorted (oldest first) names of snapshot folders directly under STATS_DIR. """
    if not os.path.isdir(STATS_DIR):
        return []
    return sorted(entry for entry in os.listdir(STATS_DIR) if os.path.isdir(os.path.join(STATS_DIR, entry)))


def _load_stat_options() -> dict[str, list[str]]:
    """
    Finds every stat_name/stat_type combination that exists in the newest stats snapshot.
    Returns {stat_name: [stat_type, ...]} - the inverse of how the json stores it
    
    We take the keys only from the newest folder, as we assume stats have not been removed so this
    should be the most complete dataset. Run-collapsing doesn't touch newest folder.
    """
    snapshots = _list_snapshots()
    if not snapshots:
        print(f"No stat snapshots in {STATS_DIR}, so /graph has no stats to offer")
        return {}
    newest = os.path.join(STATS_DIR, snapshots[-1])

    print(f"Loading stat options from \"{newest}\"")

    options: dict[str, set[str]] = {}
    # Take the union of all files in newest dir
    for file in sorted(os.listdir(newest)):
        if not file.endswith(".json"):
            continue

        path = os.path.join(newest, file)
        with open(path, "r") as fd:
            loaded = json.load(fd)

        # Load (and reverse) keys from that file 
        #   A player who has never done anything can have a stats file with no stats key at all
        for raw_stat_type in loaded.get("stats", {}):
            stat_type = _strip_namespace(raw_stat_type, path)
            if stat_type is None:
                continue

            for raw_stat_name in loaded["stats"][raw_stat_type]:
                stat_name = _strip_namespace(raw_stat_name, path)
                if stat_name is None:
                    continue
                options.setdefault(stat_name, set()).add(stat_type)

    return {stat_name: sorted(options[stat_name]) for stat_name in sorted(options)}


def _build_stat_history(stat_name: str, stat_type: str, uuids: set[str] | None = None) -> dict[str, dict[datetime, int]]:
    """
    Builds a per-player time series of the given stat across every stored snapshot.

    :param stat_name: Namespace-stripped stat name, e.g. "play_time"
    :param stat_type: Namespace-stripped stat type, e.g. "custom"
    :param uuids: If given, restricts the result to just these player uuids - None plots everyone.
    :returns: Maps player uuid (filename without ".json") to {snapshot datetime: stat value}, oldest
        first. Players/snapshots missing the stat entirely (e.g. never done that thing) are omitted.
    """
    # Qualifiers must be re-added, as that's the shape they're stored under in the stats files
    raw_stat_type = STAT_NAMESPACE + stat_type
    raw_stat_name = STAT_NAMESPACE + stat_name

    history: dict[str, dict[datetime, int]] = {}
    for folder in _list_snapshots():
        try:
            snapshot_time = datetime.strptime(folder, SNAPSHOT_FOLDER_FORMAT)
        except ValueError:
            print(f"Invalid folder name \"{folder}\"")
            continue  # Not one of our snapshot folders

        folder_path = os.path.join(STATS_DIR, folder)
        for file in os.listdir(folder_path):
            if not file.endswith(".json"):
                continue

            player = file.removesuffix(".json")
            if uuids is not None and player not in uuids:
                continue  # Skip loading files for players we're not plotting

            with open(os.path.join(folder_path, file), "r") as fd:
                loaded = json.load(fd)

            stats = loaded.get("stats", {})
            if raw_stat_type not in stats or raw_stat_name not in stats[raw_stat_type]:
                continue

            history.setdefault(player, {})[snapshot_time] = stats[raw_stat_type][raw_stat_name]

    return history


def _normalise_stat_part(part: str) -> str:
    """
    Converts from stat_name/stat_type display-name (e.g. "Play Time") to internal name (e.g. "play_time").    

    Lowercases, and collapses any run of whitespace (leading, trailing, or an accidental double space)
    down to a single "_" - it doesn't matter whether the user typed spaces or underscores, both fold to
    the same key.
    """
    return "_".join(part.lower().split())  # Split removed duplicate spaces


def _format_stat_choice(stat_name: str, stat_type: str) -> str:
    """
    Renders a stat_name/stat_type pair as the "<Stat Type>: <Stat Name>" string shown to the user.
    """
    return f"{stat_type.replace('_', ' ').title()}: {stat_name.replace('_', ' ').title()}"


def split_stat_choice(choice: str) -> tuple[str, str]:
    """
    Splits a "<Stat Type>: <Stat Name>" choice (as produced by _format_stat_choice) into
    (stat_name, stat_type), normalised to match internal storage.

    A missing colon (type not typed yet) leaves stat_type as "".
    """
    stat_type, _, stat_name = choice.partition(":")
    return _normalise_stat_part(stat_name), _normalise_stat_part(stat_type)


def _get_http_session() -> aiohttp.ClientSession:
    """ Lazily creates the one aiohttp session this module reuses for every Mojang lookup. """
    global _http_session
    if _http_session is None:
        _http_session = aiohttp.ClientSession()
    return _http_session


async def _fetch_player_name(uuid: str) -> str:
    """ Fetches a single player's current username from Mojang's profile lookup API. Raises on any failure (bad status, network error). """
    print(f"Fetching player-name for \"{uuid}\"")
    async with _get_http_session().get(MOJANG_PROFILE_LOOKUP_URL.format(uuid)) as response:
        response.raise_for_status()
        data = await response.json()
    return data["name"]


async def _get_player_names(full=False) -> dict[str, str]:
    """ 
    Returns {uuid: username} for resolved players.
    If full is false then returns only currently resolved players, if true then this rescans and waits for all resolutions to finish (so then all players will be resolved and all (successfull) will be returned).
    """
    if full: 
        _scan_for_players(_list_snapshots())  # Rescan will load previously-failed tasks
        await asyncio.gather(*_PLAYER_NAMES.values(), return_exceptions=True)  # Wait for all tasks to finish
    return {uuid: task.result() for uuid, task in _PLAYER_NAMES.items() if task.done() and task.exception() is None}


def _scan_for_players(snapshots: list[str]) -> None:
    """
    Scans every given snapshot folder's filenames for player uuids, making sure each un-resolved one has a name-resolution task running (this will re-run failed resolutions).
    Must be called with the event loop already running.
    """
    # Scan all uuids
    for folder in snapshots:
        folder_path = os.path.join(STATS_DIR, folder)
        for file in os.listdir(folder_path):
            if file.endswith(".json"):
                uuid = file.removesuffix(".json")
                # Check if player-name has loaded
                existing = _PLAYER_NAMES.get(uuid)
                failed = existing is not None and existing.done() and existing.exception() is not None
                if failed:
                    print(f"Retrying username resolution for {uuid} after previous failure: {existing.exception()}")    
                # (Re)load if required
                if existing is None or failed:
                    _PLAYER_NAMES[uuid] = asyncio.create_task(_fetch_player_name(uuid))


def _refresh_if_new_snapshot() -> None:
    """
    Refreshes the STAT_OPTIONS data and ensures any found (unresolved) player-names are loaded.
    This will block for STAT_OPTIONS loading, however http requests will be scheduled.
    Must be called with the event loop already running.
    """
    global STAT_OPTIONS, _stat_options_cache_folder

    snapshots = _list_snapshots()

    # Check if newest has already been loaded
    newest = snapshots[-1] if snapshots else None
    if newest == _stat_options_cache_folder:
        return

    # Load data from newest
    _stat_options_cache_folder = newest
    STAT_OPTIONS = _load_stat_options()
    print(f"Reloaded stat options ({len(STAT_OPTIONS)} stat_names) as newest snapshot is now {newest!r}")
    
    # Scan for any new players
    _scan_for_players(snapshots)


@subscribe_to("ready")
async def _on_ready(client: discord.Client):
    """ Pre-loads stats and player-name data. """
    _refresh_if_new_snapshot()
    print(f"Pre-loaded {len(STAT_OPTIONS)} stat_names")


@subscribe_to("stop")
async def _on_stop():
    """ Closes the shared HTTP session cleanly, if one was ever created. """
    if _http_session is not None:
        await _http_session.close()


# Variables for cached/preloaded data ---
_http_session: aiohttp.ClientSession | None = None  # See _get_http_session
_PLAYER_NAMES: dict[str, "asyncio.Task[str]"] = {}  # Maps player uuid to its (possibly still in-flight) name-resolution task - see _ensure_player_name_task

_stat_options_cache_folder = None  # Tracks staleness for _refresh_if_new_snapshot
STAT_OPTIONS = {}  # Maps from stat_name to list of options for stat_type. Has namespace ("minecraft:") removed
# ---


async def stat_autocomplete(interaction: discord.Interaction, current: str) -> list[app_commands.Choice[str]]:
    """
    We have a large number of stats, so instead of sending them all to discord, we send some 25 matching strings (matching based on stat_name and stat_type separately).
    The Choices returned use the result of _format_stat_choice for their name and value.
    """
    _refresh_if_new_snapshot()  # Reload stats list

    if ":" in current:
        # We know exactly what is type and what is name
        query_stat_name, query_stat_type = split_stat_choice(current)
        # Get matching statistic pairs
        matches = (
            (stat_name, stat_type)
            for stat_name in STAT_OPTIONS
            for stat_type in STAT_OPTIONS[stat_name]
            if query_stat_name in stat_name and query_stat_type in stat_type
        )
    else:
        # Current could either be the type or name
        query = _normalise_stat_part(current)
        # Get statistic pairs containing query in either name or type
        matches = (
            (stat_name, stat_type)
            for stat_name in STAT_OPTIONS
            for stat_type in STAT_OPTIONS[stat_name]
            if query in stat_name or query in stat_type
        )

    # Convert to discord Choices, crop to max that discord allows, and return
    #   The value is set the same as the name, since discord doesn't always replace it with `choice` (if you don't select the autocomplete)
    return [
        app_commands.Choice(name=(choice := _format_stat_choice(stat_name, stat_type)), value=choice)
        for stat_name, stat_type in islice(matches, MAX_AUTOCOMPLETE_CHOICES)
    ]


async def players_autocomplete(interaction: discord.Interaction, current: str) -> list[app_commands.Choice[str]]:
    """
    We can have multiple players, so we allow user to enter CSV for this field.
    We autofill this by dropping all text before-and-including the last comma, and using the remaining text as the search query for the next name.
    """
    _refresh_if_new_snapshot()  # Schedule load of new player names

    # Split confirmed names (prefix) and the query string for the new name
    prefix, _, query = current.rpartition(",")
    if prefix:
        prefix += ", "  # Normalise separator spacing regardless of what the user actually typed
    query = query.strip().lower()
    confirmed_names = {name.lower() for name in _parse_players(prefix) or []}  # Default to empty set if no confirmed names

    # Find autofill for the last - partially searched - name.
    #   Don't wait for currently-loading names to load, as that takes too long
    matches = (
        name
        for name in (await _get_player_names()).values()
        if query in name.lower() and name.lower() not in confirmed_names  # If name matches query and name not already used
    )
    # The value is set the same as the name, since discord doesn't always replace it with `choice` (if you don't select the autocomplete)
    return [
        app_commands.Choice(name=(choice := f"{prefix}{name}"), value=choice)
        for name in islice(matches, MAX_AUTOCOMPLETE_CHOICES)
    ]


def _parse_players(players: str | None) -> list[str] | None:
    """
    Splits the players CSV argument into individual, trimmed usernames.
    Returns None for "plot everyone" - when given players is None or an empty string.
    """
    if players is None or not players.strip():
        return None
    return [name.strip() for name in players.split(",") if name.strip()]


wrap_grave = lambda x: f"`{x}`"  # Wraps x with grave characters

@tree.command(name="graph", description="Plot player statistics in a graph")
@app_commands.describe(
    statistic="The statistic to plot",
    players="The players whose data should be plotted, separated by commas. None for plot all.",
)
@app_commands.autocomplete(statistic=stat_autocomplete, players=players_autocomplete)
async def graph_command(interaction: discord.Interaction, statistic: str, players: str = None):
    """
    Plots the given statistic, given as a "<Stat Type>: <Stat Name>" choice as produced by stat_autocomplete.
    """
    # Plotting reads every snapshot on disk, which can take longer than discord's 3 second
    # interaction timeout, so respond immediately with a placeholder and edit it once the graph is ready
    await interaction.response.send_message(f"Generating graph for {statistic}...")

    # Reload stats list and new player names
    _refresh_if_new_snapshot()  

    # Validate stat name is valid
    stat_name, stat_type = split_stat_choice(statistic)
    if stat_type not in STAT_OPTIONS.get(stat_name, []):
        await interaction.edit_original_response(content=f":warning: `{statistic}` is not a statistic I know about, please pick one of the suggestions.")
        return

    # Reformat statistic title for display on the graph (case and duplicate spaces)
    statistic = _format_stat_choice(stat_name, stat_type)

    # Unlike autocomplete, we're not on a tight time budget here (a placeholder was already sent). So attempt to reload any failed requests, and wait for all currently running requests to finish.
    player_names = await _get_player_names(full=True)

    # Resolve requested usernames to uuids up front, so unknown ones can be reported and so
    # _build_stat_history only has to load files for the players actually being plotted
    requested_names = _parse_players(players)
    unknown_names = []
    selected_uuids = None
    if requested_names is not None:
        name_to_uuid = {name.lower(): uuid for uuid, name in player_names.items()}
        selected_uuids = set()
        for name in requested_names:
            uuid = name_to_uuid.get(name.lower())
            if uuid is None:
                unknown_names.append(name)
            else:
                selected_uuids.add(uuid)

    warnings = [f":warning: Unknown player(s): {', '.join(map(wrap_grave, unknown_names))}."] if unknown_names else []

    # Load data to be plotted
    print(f"Generating graph for {stat_name}.{stat_type}...")
    history = _build_stat_history(stat_name, stat_type, selected_uuids)
    if not history:
        warnings.append(f":warning: No data found for {wrap_grave(statistic)} for the specified players.")
        await interaction.edit_original_response(content="\n".join(warnings))
        return

    # Create graph
    fig, ax = plt.subplots()
    unknown_uuids = []
    for player, points in history.items():
        if player in player_names:
            # We have a resolved name
            player_name = player_names[player] 
        else:
            # No resolved name: resolution failed
            unknown_uuids.append(player)
            player_name = player  # Take uuid as name
        ax.plot(points.keys(), points.values(), label=player_name)
    ax.xaxis.set_major_formatter(mdates.DateFormatter(GRAPH_DATE_FORMAT))
    fig.autofmt_xdate()
    ax.set_title(statistic)
    ax.legend()

    if len(unknown_uuids) > 0:
        warnings.append(f":warning: Failed to resolve name(s) for {', '.join(map(wrap_grave, unknown_uuids))}.")

    # Need to convert it to a buffer to be uploaded to discord
    buffer = io.BytesIO()
    fig.savefig(buffer, format="png")
    plt.close(fig)  # Otherwise pyplot keeps every figure alive for the life of the bot process
    buffer.seek(0)

    await interaction.edit_original_response(content="\n".join(warnings) or None, attachments=[discord.File(buffer, filename="graph.png")])
