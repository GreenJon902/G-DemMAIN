# Monitoring

The `g_monitor` service (`scripts/g_monitor/monitor.py`) 
    - tracks resource usage (for datapoints that change with time) for the system as a whole - and for each configured cgroup (our services) - to be displayed on the panel.
    - tracks resource usage so it can send warnings when required.
It runs as a long-lived mainloop process, started directly by `g_monitor.service` rather than spawned periodically by a systemd timer.

This script assumes no extra files are present in the output folder other than the live data files it manages itself (see [Live Data](#live-data) below). If there are, errors may occur.

## Monitoring Configuration
In `config/{mode}/g_monitor/config.json` is the configuration, read via `libs.config` - the file is located strictly via the `G_DEMMAIN_ROOT`/`G_DEMMAIN_MODE` environment variables, there is no CLI override.

### CGroups
The `cgroups` key is a JSON array of the cgroups to track (e.g. `"system.slice/g_mc.service"`).
In prod (`config/prod/g_monitor/config.json`) this is `system.slice/{g_mc,g_web_nxt,g_web_mcc,g_monitor,g_discord,mariadb}.service`.

### Retention
The `retention` key is a JSON array of `[interval, maxCount]` pairs specifying how old records should be retained. The first number is the interval between records, in seconds. The second is how many of those records should be stored, given as `null` if they should be stored forever.
E.g. a pair of `[5, 20]` keeps 20 records spanning the last 100 seconds, each 5 seconds apart.
Older records are automatically removed.
There should not be identical rules.
Every interval must be a multiple of the smallest interval among the rules - this is asserted at startup.

### Usage Warning Thresholds
The `ramWarnThreshold` and `diskWarnThreshold` keys are floats in `[0, 1]` - the fraction of RAM/drive usage that triggers a `SYSWARN` webhook (see [Usage Warnings](#usage-warnings) below).

### Disk Warn Mounts
The `diskWarnMounts` key is a JSON array of mount points (e.g. `"/"`) checked against `diskWarnThreshold`.

## Data Sources
Each mainloop iteration samples:
- System-wide stats: `/proc/stat` (CPU), `/proc/meminfo` (RAM), `/proc/net/dev` (network), `/sys/block/*/stat` (disk I/O), and `df -B1 --output=source,target,size,avail` (disk usage).
- Per-cgroup stats, for each cgroup listed in `cgroups`: `/sys/fs/cgroup/<cgroup>/cpu.stat`, `memory.current`, `io.stat`, and `cgroup.procs`.
- Minecraft TPS and heap usage, read from the `g_mc_monitor` FUSE mount's `tps`, `heap_used_bytes` and `heap_allocated_bytes` files - see [G-DemMAIN Monitor Mod.md](G-DemMAIN%20Monitor%20Mod.md) for the mount itself.

If a value fails to read, it's recorded as `null` rather than crashing the mainloop.

## Usage Warnings
If system RAM usage, or the usage of any mount point listed in `diskWarnMounts`, goes over its configured threshold (`ramWarnThreshold`/`diskWarnThreshold`), the `SYSWARN` webhook is fired by spawning `scripts/webhooks.py syswarn ...` as a subprocess. See [Environment Variables.md](Environment%20Variables.md) for the webhook URL variables.
This is edge-triggered - the alert fires once when usage crosses above the threshold, then stays silent while it remains over, and re-arms once usage drops back below the threshold. This means a resource stuck over threshold doesn't get a repeat warning every mainloop tick.
Disk usage is queried directly via `df` (`read_disk_usage` in `monitor.py`) rather than through the historical record - it is not written to the `sys_disk_usage` field, which stays deprecated (see [Schema Changelog](#schema-changelog)).

## Historical records
In whatever folder the config's `recordFolder` resolves to (prod `/var/lib/g_monitor`, dev `scripts/g_monitor` relative to the repo root) are the records.
A subfolder is made for each retention rule, named `<interval>_<maxCount>` (or just `<interval>` if `maxCount` is `null`, i.e. unlimited). When the number of items in a subfolder goes over the rule's `maxCount`, the oldest is removed. There is no guarantee that all records will be equally spaced (e.g. if the program stops, the timing may shift).
The name of each record file is its timestamp in seconds since the Unix epoch, e.g. `1234567890.json`.

## Monitor Format
```
{
    "sys_cpu": {
        "agg": {
            "total": int,                Arbitary units, Absolute
            "busy": int                  Arbitary units, Absolute
        },
        "ind": {
            [cpuno]: {                       # Keys not necessarily constant
                "total": int,            Arbitary units, Absolute
                "busy": int              Arbitary units, Absolute
            }
        }
    } | null,
    "sys_mem": {
        "total": int,                    Kilobytes
        "used": int                      Kilobytes
    } | null,
    "sys_net_io": {
        "agg": {                             # Does not include 'lo' interface
            "sent": int,                 Bytes, Absolute
            "recieved": int              Bytes, Absolute
        },
        "ind": {
            [interface_name]: {              # The 'lo' interface is 'loopback' - data sent internally from one process to another
                                             # Keys not necessarily constant
                "sent": int,             Bytes, Absolute
                "recieved": int          Bytes, Absolute
            }
        }
    } | null,
    "sys_disk_io": {
        "agg": {
            "read": int,                 Bytes, Absolute
            "written": int               Bytes, Absolute
        },
        "ind": {
            [name]: {                        # Keys not necessarily constant
                "read": int,             Bytes, Absolute
                "written": int           Bytes, Absolute
            }
        }
    } | null,
    "sys_disk_usage": {                  # @deprecated - see Schema Changelog. Current value only, now queried live (getDiskUsage in panelUtils.ts) instead
        [mount_point]: {
            "filesystem": str,
            "total": int,                Bytes
            "used": int                  Bytes
        } 
    } | null,
    "minecraft": {
        "tps": float | null,             Ticks per second, rolling average over the last 100 ticks, capped at 20
        "mem": {
            "total": int,                Kilobytes                                # The heap's -Xmx ceiling
            "used": int                  Kilobytes                                # The heap currently in use
        } | null,
        "players": [str, ...] | null     @deprecated - see Schema Changelog. Usernames of currently online players, unused and no longer written
    } | null,                            # Absent entirely in records predating this field
    "cgroups": {
        [cgroup_name]: {                     # Keys not necessarily constant
            "cpu": int | null,           Microseconds, Absolute  # Value is sum of cpu time on each core
            "mem": {
                "total": int,                    Kilobytes
                "used": int                      Kilobytes
            } | null,
            "disk_io": {
                "read": int,             Bytes, Absolute
                "written": int           Bytes, Absolute
            } | null,
            "procs": {                    # @deprecated - see Schema Changelog. Current value only, now published live (see live_cgroup_procs.json below) instead
                [process_id: int]: str       # Value is terminal command used to start the process
                                             # Keys not necessarily constant
            } | null
        }
    }
}
```

## Schema Changelog
Changes to the `Monitor Format` JSON schema above. Deprecated fields are still accepted when parsing old records, but are no longer written and shouldn't be relied on.

- **2026-07-22** - Deprecated `sys_disk_usage`, `minecraft.players` and `cgroups.*.procs`. Fields are still parsed if present in old records, but are no longer written.
- **2026-07-20** - Added `minecraft` field: `tps`, `mem` (`total`, `used`), `players`. Both `minecraft` and direct children are optional (parent: null or not-present, children: null).

## Live Data
Some data should always reflect its current value rather than a historical sample, but is either too expensive to compute on every panel page load, or requires filesystem access `g_web` doesn't have (e.g. reading `cgroup.procs` and `/proc/<pid>/cmdline` for cgroups owned by other services). For this, `monitor.py` publishes small "live" files directly in the record folder root (a sibling of the retention subfolders), overwriting them in place every mainloop iteration. Unlike the historical records, only the latest value is kept - there is no history and no retention rule.

### `live_cgroup_procs.json`
```
{
    "timestamp": int,                    Unix epoch seconds, when this file was generated
    "cgroups": {
        [cgroup_name]: {                     # Keys not necessarily constant, one entry per tracked cgroup
            [process_id: int]: str           # Value is terminal command used to start the process
        } | null                             # null if this cgroup's procs failed to be read
    }
}
```
