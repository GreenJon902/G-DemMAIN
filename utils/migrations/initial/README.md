# Initial migration

This folder holds the scripts & notes for the migration to G-DemMAIN:
 - Migration of the database from ApexMC to G-DemMAIN.
 - Migration of homes and warps from EssentialsX to Blossom{Homes,Warps}.
 - Migration of discord XP from Mee6 to g_discord.
 - Migration of stats history to the new name format.

Note that the results of this migration are only valid for the current state of the project (currently 2026/08/25).

## Homes and warps
Homes and warps were previously managed by EssentialsX - `<server>/plugins/Essentials/{userdata,warps}/` - and will be managed by fabric-essentials - `<server>/fabric-essentials.json` and `<server>/world/players/mod_data/<uuid-dashed>/fabric-essentials.json` for warps and homes respectively.


### Warps
Run `homesAndWarps/warps.py <source_folder> <dest_file>`.

This expects the source folder to contain YAML files, whose names are `<warpName>.yml` and whose contents is the following.
```
world: <world-uuid?>  # Some UUID, ignored
world-name: <world-name>  # "world", "world_the_end", "world_nether"
x: <float>
y: <float>
z: <float>
yaw: <float>
pitch: <float>
name: <warpName>  # We validate this to match the file name (without extension)
lastowner: <player-uuid>
```

The destination is a single json file of the following format.
```
{
  "warps": {
    <name>: {
      "location": {
        "pos": {
          "x": <float>,
          "y": <float>,
          "z": <float>,
        },
        "yaw": <float>,
        "pitch": <float>,
        "dimension": <world-name>,  # "minecraft:overworld", "minecraft:the_nether", "minecraft:the_end"
      }
    },
    ...
  }
}
```

We map all trivial connections, and we map `world-name` to `dimension` with updated values.
Note that all uuid formats have dashes (e.g. `86f5d3d8-0d4b-4230-9852-77a40baf39bd`).


### Homes
Run `homesAndWarps/warps.py <source_folder> <dest_file>`.

This expects the source folder to contain YAML files, whose names are `<player-uuid>.yml`. These files contain many sections, we only care about the following, and we will only validate the following.
```
homes:
    <home-name>:  
/       world: <world-uuid?>  # Some UUID, ignored                              |   
\       world-name: <world-name>  # "world", "world_the_end", "world_nether"    | Either top two
=       world: <world-name>  # "world", "world_the_end", "world_nether"            | or this one
        x: <float>
        y: <float>
        z: <float>
        yaw: <float>
        pitch: <float>
    ...
```

The destination a folder containing `<player-uuid>/fabric-essentials.yml`.
```
{
  "homes": {
    <name>: {
      "location": {
        "pos": {
          "x": <float>,
          "y": <float>,
          "z": <float>,
        },
        "yaw": <float>,
        "pitch": <float>,
        "dimension": <world-name>,  # "minecraft:overworld", "minecraft:the_nether", "minecraft:the_end"
      }
    },
    ...
  }
}
```

We map all trivial connections, and we map `world-name` to `dimension` with updated values.
Note that all uuid formats have dashes (e.g. `86f5d3d8-0d4b-4230-9852-77a40baf39bd`).

## Stats history
Stats backups were previously stored as folders named `yyyy.mm.dd/<uuid>.json`, and will be stored as folders named `/var/lib/g_mc-stats/yyyy-mm-dd-hh-mm-ss/<uuid>.json`.

Run `statsBackups/rename.py <source_folder> <dest_folder>`.

This expects the source folder to contain folders whose names match `yyyy.mm.dd`. Each matching folder's contents are copied (not moved) to a same-named folder under the destination, renamed to `yyyy-mm-dd-00-00-00` (we assume taken at midnight as we don't have this data). Folders whose name doesn't match the expected format are skipped.

## Database
- HisDoc - See the following steps.
- McMMO - We're dropping this so nothing needs to be done.
- CoreProtect -> Ledger + Merge - I wanted to merge the various historic databases (from backups) so it would be complete, and then migrate it to Ledger's schema. This looks like it will not be feasable at the current time (size of databases).

HisDoc migration:
There are two scripts, a `database/hisdoc-validate.sql` and `database/hisdoc-migrate.sql`.
These scripts were briefly checked, however they were written with the intention that the user does sufficient validation of migrated data.
The schema is mostly the same, so the validation script more focuses on bugs in the old hisdoc version.

First run the validate script.
Respond to any errors.
Repeat till all FATAL problems are fixed, and the only remaning WARNINGs can be ignored.
Run the migrate script.

This will create INSERT changelogs only for events.
Running validate creates the PersonUserMap. You must fill this out for all Persons who have made a post or made a change (and so all need a user account in `g_web`).
    - This is used only for event-author and changelog-author - migrated Persons will not be linked to an account by default.


# Mee6 levels
To extract the mee6 levels (at least how it worked when this was written):
1. Open inspect element on the leaderboard page and go to network.
2. Reload.
3. Scroll from top to bottom.
4. Filter requests by leaderboard.
5. Get each "page's" json (literally has a key "page" which maps to a number).
6. Join the "players" lists.
7. `mapped = {str(player["id"]): player["xp"] for player in joined_players}`.
8. You have your json.
