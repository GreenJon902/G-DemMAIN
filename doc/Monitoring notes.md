Monitor based off cgroups.
    - We can then derive the cgroup name system.slice/<name>.service.
    - THen we can read from cpu.stat, memory.current, io.stat - /sys/fs/cgroup/system.slice/
        - for some (cpu, possible disk) we may need to compare last and current.

    - We pass an optional main process name (e.g. java) to be monitored for network io


For each cgroup we can show each pid and it's command to be ran. (inside a dropdown)
Then display graphs, for netowrk (if given) we indicate which pid is being monitored.


We also monitor systemcpu (total and each individual cpu) , system ram, system network io, system disk io, free space left on disk.
---
CPU
cat /proc/stat
busy = user + nice + system + irq + softirq + steal
total = busy + idle + iowait
cpu% = Δbusy / Δtotal * 100

RAM
cat /proc/meminfo
used = MemTotal - MemAvailable

NET
cat /proc/net/dev
rx_bytes_per_sec = Δrx_bytes / Δtime
tx_bytes_per_sec = Δtx_bytes / Δtime
Run this for each interface (render at bottom). Put a note that lo is loopback and is internal. We can combine numbers for all interfaces (except loopback) and redner at top. 

DISK
cat /proc/diskstats
bytes = sectors * 512
or actually /sys/block/*/stat

DISK USAGE
df -B1 / --output=source,size,avail
Then show for each filesystem indiviudally
used_bytes = 1B-blocks - Available
---

    - 
We also monitor mc tps and mc heap
TODO: Figure this out

while read -r pid; do
    printf "%s " "$pid"
    tr '\0' ' ' < "/proc/$pid/cmdline"
    echo
done < "$CG/cgroup.procs"







# Monitoring
The monitoring script tracks the resource usage by the system, and indiviudal cgroups (our services).  
This script assumes that no extra files will be present in the output folder, other than the live data files it manages itself (see [Live Data](#live-data) below). If there are then errors may occur.

## Monitoring Configuration
In `config/{mode}/g_monitor/config.json` are the configuration files, read via `libs.config` - the file is located strictly via the `G_DEMMAIN_ROOT`/`G_DEMMAIN_MODE` environment variables, there is no CLI override.  
### CGroups
The `cgroups` key is a JSON array of the cgroups to track (e.g. `"system.slice/g_mc.service"`).  
### Retention
The `retention` key is a JSON array of `[interval, maxCount]` pairs specifying how old records should be retained. The first number is the interval between records. The second is how many of those records should be stored, given as `null` if they should be stored forever.  
E.g. if we have a pair that is `[5, 20]`, then we will keep 20 logs for the last 100 seconds, each of which is 5 seconds apart.  
Older logs are automatically removed.  
There should not be identical rules.
### Usage Warning Thresholds
The `ramWarnThreshold` and `diskWarnThreshold` keys are floats in `[0, 1]` - the fraction of RAM/drive usage that triggers a `SYSWARN` webhook (see [Usage Warnings](#usage-warnings) below).
### Disk Warn Mounts
The `diskWarnMounts` key is a JSON array of mount points (e.g. `"/"`) checked against `diskWarnThreshold`.

## Usage Warnings
If system RAM usage, or the usage of any mount point listed in `diskWarnMounts`, goes over its configured threshold (`ramWarnThreshold`/`diskWarnThreshold`), the `SYSWARN` webhook (see `scripts/webhooks.py`) is fired.  
This is edge-triggered - the alert fires once when usage crosses above the threshold, then stays silent while it remains over, and re-arms once usage drops back below the threshold. This means a resource stuck over threshold doesn't get a repeat warning every mainloop tick.  
Disk usage is queried directly via `df` (see `read_disk_usage` in `monitor.py`) rather than through the historical record - it is not written to the `sys_disk_usage` field, which stays deprecated (see Schema Changelog).

## Historical records
In whatever folder the config's `recordFolder` resolves to (prod `/var/lib/g_monitor`, dev `scripts/g_monitor` relative to the repo root) are the records.   
Inside a subfolder is made for each retention rule (in the format `<interval>_<number>`). When the number of items in a subfolder goes over the maximum allowed by the rule, the oldest is removed. There is no garuntee that all records will be equally spaced (as if the program stops then the timing may change).  
The names of the records themselves are in seconds since the unix-epoch.  


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




