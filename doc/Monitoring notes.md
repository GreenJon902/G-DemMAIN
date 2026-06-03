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














Format:
```
{
    "sys_cpu": {
        "agg": {
            "total": int,                Arbitary units, Absolute
            "busy": int                  Arbitary units, Absolute
        },
        "ind": {
            [cpuno]: {
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
            [name]: {
                "read": int,             Bytes, Absolute
                "written": int           Bytes, Absolute
            }
        }
    } | null,
    "sys_disk_usage": {
        [mount_point]: {
            "filesystem": str,
            "total": int,                Bytes
            "used": int                  Bytes
        } 
    } | null,
    "cgroups": {
        [cgroup_name]: {
            "cpu": int | null,           Microseconds, Absolute
            "mem": int | null,           Bytes
            "disk_io": {
                "read": int,             Bytes, Absolute
                "written": int           Bytes, Absolute
            } | null,
            "net_io": {
                "read": int,             Bytes, Absolute
                "written": int           Bytes, Absolute
            } | null,
            "procs": {
                [process_id: int]: str          # Value is terminal command used to start the process
            } | null
        }
    }
}
```
