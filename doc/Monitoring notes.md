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
This script assumes that no extra files will be present in the output folder. If there are then errors may occur.

## Monitoring Configuration
In `/opt/infra/static-config/g_monitor` (or another folder if given as an argument to the script) are the configuration files.  
### CGroups
In `cgroups` you should specify the cgroups to track (e.g. `system.slice/g_mc.service`). These should separated by newlines and contain no extra data.  
### Retention
In `retention` you should specify how old records should be retained. Each line should be formatted as `(\d+) (\d+)?`. The first number is the interval between records. The second is how many of those records should be stored, if not given then we will store them forever.  
E.g. if we have a line that is `5 20`, then we will keep 20 logs for the last 100 seconds, each of which is 5 seconds apart.  
Older logs are automatically removed.  
There should not be identical rules.

## Historical records
In `/var/lib/g_monitor` (or another folder if given as an argument to the script) are the records.   
Inside a subfolder is made for each retention rule (in the format `<interval>_<number>`). When the number of items in a subfolder goes over the maximum allowed by the rule, the oldest is removed. There is no garuntee that all records will be equally spaced (as if the program stops then the timing may change).  
The names of the records themselves are all relative to the same arbitrary point in time (they are comparable only to eachother).  


## Monitor Format
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
            "cpu": int | null,           Microseconds, Absolute  # Value is sum of cpu time on each core
            "mem": {
                "total": int,                    Kilobytes
                "used": int                      Kilobytes
            } | null,
            "disk_io": {
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




