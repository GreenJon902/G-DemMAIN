# Minecraft
This file lists the current status of software and any notes about the actual minecraft server itself.  

## Software
Minecraft Version: `26.2`.  
Fabric Loader Version: `0.19.3`.  
Download from https://fabricmc.net/use/server/.  

### Mods
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
| [BlossomHomes](https://modrinth.com/mod/blossomhomes)                     | 2.2.13+26.1               | |
| [BlossomTpa](https://modrinth.com/mod/blossomtpa)                         | 2.2.14+26.1               | | 
| [BlossomWarps](https://modrinth.com/mod/blossomwarps)                     | 2.0.17+26.1               | |
| [BlossomLib](https://modrinth.com/mod/blossomlib)                         | 2.6.0+26.2                | |
| [Mods Command](https://modrinth.com/mod/mods-command)                     | mc26.2-1.1.16             | |
| [adventure-platform-mod](https://modrinth.com/mod/adventure-platform-mod) | 7.1.1                     | |
| [Styled Chat](https://modrinth.com/mod/styled-chat)                       | 2.13.0+26.2               | |

<details>
  <summary>Possible future mods</summary>
  
  - Beacon Beam Hider - On old g-dem we had this https://github.com/GreenJon902/BeaconBeamHider.
  - Dynmaps - Waiting for 26.2, and waiting for it to be merged with main.
  - InvSee
  - G-Coin? - Or at least disable placing of G-Blocks? - https://github.com/GreenJon902/G-Coin.
  - We previously had TickLogger. We probably don't need such fine data, so probably can just save player stats once a week.
</details>


TODO: 
Configure unplugged properly

Re-implement mods list ourselves - two levels - overview and detailed?

What I've done:
Created mods/luckperms owned by g_mc - g\_mc cannot write to mods folder.


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

## Nightly drift check
`scripts/g_check_mc/main.py` runs nightly (see [Services.md](Services.md)) and recursively re-checks `config/prod/g_mc` against `/var/lib/g_mc` using the same comparison logic as `sync_static_config`. No writes occur, this is only to check that config has not driffted (e.g. use of an ingame config command making (meant to be) permanant changes that the repo doesn't know about).
