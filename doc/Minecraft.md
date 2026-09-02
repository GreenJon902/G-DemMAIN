# Minecraft
This file lists the current status of software and any notes about the actual minecraft server itself.  

## Software (& software-ish things)
Minecraft Version: `26.2`.  
Fabric Loader Version: `0.19.3`.  
Download from https://fabricmc.net/use/server/.  

### Mods
If a mod file's name does not contain the mod-version, then this should be manually added, otherwise leave it as it is.

| Mod                                                                       | Installed Version         | Notes |
|---------------------------------------------------------------------------|---------------------------|-------|
| [g_mc_monitor](G-DemMAIN%20Monitor%20Mod.md)                              | *Current version in repo* | |
| [Fabric API](https://www.curseforge.com/minecraft/mc-mods/fabric-api)     | 0.157.0+26.2              | |
| [Lithium](https://www.curseforge.com/minecraft/mc-mods/lithium)           | 0.25.3+mc26.2             | |
| [C2ME](https://modrinth.com/mod/c2me-fabric)                              | 0.4.1-beta.1.0 (mc26.2)   | |
| [Luckperms](https://luckperms.net/download)                               | 5.5.77                    | |
| [Ledger](https://modrinth.com/mod/ledger)                                 | 1.3.23                    | |
| [Ledger Databases](https://modrinth.com/mod/ledger-databases)             | 1.2.2                     | |
| [Fabric Language Kotlin](https://modrinth.com/mod/fabric-language-kotlin) | 1.13.13+kotlin.2.4.10     | Needed for ledger. |
| [WorldEdit](https://modrinth.com/plugin/worldedit)                        | 7.4.5                     | |
| [No Chat Reports](https://modrinth.com/mod/no-chat-reports)               | v2.20.1 (26.2)            | |
| [Convenient mobGriefing](https://modrinth.com/mod/convenient-mobgriefing) | 2.2.2                     | |
| [No Crop Trample](https://modrinth.com/mod/nocroptrample)                 | 1.5-26.2                  | |
| [Blastproof](https://modrinth.com/mod/blastproof)                         | 0.2.0+mc26.2              | |
| [Unplugged AFK](https://modrinth.com/mod/unplugged-afk)                   | v0.2.4-mc26.2             | |
| [adventure-platform-mod](https://modrinth.com/mod/adventure-platform-mod) | 7.1.1                     | |
| [Styled Chat](https://modrinth.com/mod/styled-chat)                       | 2.13.0+26.2               | |
| [Fabric Essentials](https://modrinth.com/mod/melius-essentials)           | 1.4.11+26.2               | |

<details>
  <summary>Possible future mods</summary>
  
  - Beacon Beam Hider - On old g-dem we had this https://github.com/GreenJon902/BeaconBeamHider.
  - Dynmaps - Waiting for 26.2, and waiting for it to be merged with main.
  - InvSee
  - G-Coin? - Or at least disable placing of G-Blocks? - https://github.com/GreenJon902/G-Coin.
</details>

### Datapacks
All datapack folder/zip names - excluding the repo-tracked datapacks - should be clearly named and contain the minecraft version in them.

| Datapack source | (Number): Selection | Notes |
|-----------------|---------------------|-------|
| [Vanilla Tweaks (Datapacks)](https://vanillatweaks.net/picker/datapacks/) | `(14): armor statues, custom nether portals, dragon drops, durability ping, fast leaf decay, husks drop sand, more effective tools, more mob heads, multiplayer sleep, nether portal coords, player head drops, silence mobs, unlock all recipes, wandering trades` | This must be unzipped on install, each datapack is it's own archive. |
| [Vanilla Tweaks (Crafting Tweaks)](https://vanillatweaks.net/picker/crafting-tweaks/) | `(12): unpackable ice, unpackable nether wart, unpackable wool, craftable bundles leather, powder to glass, blackstone cobblestone, dropper to dispenser, coal to black dye, charcoal to black dye, universal dyeing, back to blocks, rotten flesh to leather` | This can be left as is (but should be renamed with the mc version). |
| [Element paintings](https://modrinth.com/datapack/elemental-painting]) | *N/A* | |
| *Repo Tracked* | `(2): unpackable_quartz, warden_swift_sneak` | These are synced by the `sync_static_config` util. The marker should be ignord by minecraft. |


## Gamerules
The gamerules we overwrite from default are listed below.
| Gamerule Name | Value |
|---------------|-------|
| locatorBar    | false |


## Name-formatting

There are two tracks: `staff` and `tier`. These both have suffixes (for above-default levels), and both expect them to be shown.  
Then teams are just miscellaneaous groups, and instead use prefixes. Again it is expected these are shown.  

No other prefixes or suffixes should be set, as it will mess up the above 3. If another type should be added, the luckperms config will need to be modified.  

To set a player nickname, the display-name should be used, as that will then be spliced between the prefix and suffix.

All prefix/suffix weights should be set to 0.

## Fabric Essentials Config

I have some notes:
- The `tier{2,3}` groups must have `fabric-essentials.command.sethome.limit.tier{2,3}` set respectively.
- `teleportation.savedBackLocations` and `itemEdit.*` are set, yet the commands are blocked for normal users so this is not a problem.

## Config notes
We omit the marker on certain files who's consumers do not support, or would remove, the marker.

### Nightly drift check
`scripts/g_check_mc/main.py` runs nightly (see [Services.md](Services.md)) and recursively re-checks `config/prod/g_mc` against `/var/lib/g_mc` using the same comparison logic as `sync_static_config`. No writes occur, this is only to check that config has not driffted (e.g. use of an ingame config command making (meant to be) permanant changes that the repo doesn't know about).

## `g_copy_mc_stats` - Nightly stats snapshot
`scripts/g_copy_mc_stats/main.py` runs nightly (2am, see [Services.md](Services.md)) and copies `/var/lib/g_mc/world/players/stats/*.json` into a new timestamped folder under `/var/lib/g_mc-stats`. 

To avoid storing large amounts of unchanged data for players who rarely play, a run of snapshots where a player's file is unchanged is collapsed down to just its first and last occurrence.

It is expected that no extra files / folders are added to `/var/lib/g_mc/world/players/stats`, `/var/lib/g_mc-stats` or `/var/lib/g_mc-stats/*`.
The folder structure is `/var/lib/g_mc-stats/<yyyy-mm-dd-hh-mm-ss>/<uuid>.json`.





# TODO
Check/configure unplugged afk suffix.

Datapacks need checking.

Find OG motd from backup.

What I've done:
    Created mods/luckperms owned by g_mc - g\_mc cannot write to mods folder.

Configure fabric essentials.

Look into storing luckperms using YAML. Then we can track that from the repo.


Afk updates:
    We need to update unplugged to support a max afk duration.
    g\_mc_monitor needs to differentiate between unplugged and normal log-ings (might need to set `broadcastMessages=false`) - "User joined the game", "User has gone un-plugged AFK".
    Support for plugged-afk (people may want to have mc open on another screen so they can make sure their character is safe. We do not encourage this behavior though.):
        - Kick if afk for over 20 minutes unless /afk is ran.  
        - /afk adds [AFK] tag, and sends user a message saying "We strongly advise you use /unplug".
    Support for being crouched while unplugged.
