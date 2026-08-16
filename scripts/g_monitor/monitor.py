# This script handles the monitoring of the system. This includes tracking resource usage.
# See the documentation file for usage.
# This file has a mainloop, rather than being ran by a systemd timer, as it needs to run frequently and I feel this is more efficient?

import re
import time
import json
import os
import subprocess
import sys

from libs.config import readConfigList, readConfigRaw, readConfig, resolvePath, ROOT
from libs.wrappedCalls import safe_call

# Log run-info
print("Executing in", os.getcwd())

# Load cgroups
CGROUPS = readConfigList("g_monitor/config.json", str, "cgroups")
print("Trackin CGroups:", CGROUPS)

# Load retention rules
RETENTION_RULES = {tuple(pair) for pair in readConfigRaw("g_monitor/config.json", "retention")}
# readConfigRaw does not type-check nested list contents, so verify the shape ourselves - each rule must be
# an (interval, max-count, mode) triple, where max-count is either an int or None (keep forever), and mode
# is either "snapshot" or "aggregate" - see documentation
for rule in RETENTION_RULES:
    assert len(rule) == 3, f"Retention rule {rule!r} is not an (interval, max-count, mode) triple"
    interval, maxCount, mode = rule
    assert type(interval) is int, f"Retention rule {rule!r} has a non-int interval"
    assert maxCount is None or type(maxCount) is int, f"Retention rule {rule!r} has a max-count that is neither int nor null"
    assert mode in ("snapshot", "aggregate"), f"Retention rule {rule!r} has an unrecognised mode"
print("Retention Rules:", RETENTION_RULES)

# Find base interval (how long to wait between polls of the system)
BASE_INTERVAL = min(interval for interval, _, _ in RETENTION_RULES)
# Every interval must be a multiple of BASE_INTERVAL - for records to land on their expected times
for interval, _, _ in RETENTION_RULES:
    assert interval % BASE_INTERVAL == 0, f"Retention interval {interval} is not a multiple of the minimum interval {BASE_INTERVAL}"
print(f"Found Base Interval: {BASE_INTERVAL}. Confirmed all intervals are multiples!")

# Load the folder that records are written to
RECORD_FOLDER = resolvePath(readConfig("g_monitor/config.json", str, "recordFolder"))

# Load usage-warning thresholds and the drives to check them against
RAM_WARN_THRESHOLD = readConfig("g_monitor/config.json", float, "ramWarnThreshold")
DISK_WARN_THRESHOLD = readConfig("g_monitor/config.json", float, "diskWarnThreshold")
DISK_WARN_MOUNTS = readConfigList("g_monitor/config.json", str, "diskWarnMounts")
assert 0 <= RAM_WARN_THRESHOLD <= 1, f"ramWarnThreshold must be between 0 and 1, got {RAM_WARN_THRESHOLD!r}"
assert 0 <= DISK_WARN_THRESHOLD <= 1, f"diskWarnThreshold must be between 0 and 1, got {DISK_WARN_THRESHOLD!r}"

# Constants ---
SYS_CPU = "/proc/stat"
RE_SYS_CPU = re.compile(r"^cpu(?P<cpuno>\d*) +(?P<user>\d+) (?P<nice>\d+) (?P<system>\d+) (?P<idle>\d+) (?P<iowait>\d+) (?P<irq>\d+) (?P<softirq>\d+) (?P<steal>\d+) (?P<guest>\d+) (?P<guest_nice>\d+)$", flags=re.MULTILINE)
SYS_MEM = "/proc/meminfo"
RE_SYS_MEM_TOTAL = re.compile(r"^\s*MemTotal:\s*(\d+)\s*kB\s*$", flags=re.MULTILINE)
RE_SYS_MEM_AVAILABLE = re.compile(r"^\s*MemAvailable:\s*(\d+)\s*kB\s*$", flags=re.MULTILINE)
SYS_NET_IO = "/proc/net/dev"
RE_SYS_NET_IO = re.compile(r"^\s*(?P<interface>\S+)\s*:\s*(?P<recieved_bytes>\d+)(?:\s+\d+){7}\s+(?P<sent_bytes>\d+)(?:\s+\d+){7}\s*$", flags=re.MULTILINE)
SYS_DISK_IO_A = "/sys/block"
SYS_DISK_IO_B = "stat"
RE_SYS_DISK_IO = re.compile(r"^\s*(?:\d+\s+){2}(?P<sectors_read>\S+)\s+(?:\d+\s+){3}(?P<sectors_written>\S+)(?:\s+\d+){4}(?:(?:\s+\d+){4})?(?:(?:\s+\d+){2})?\s*$")
SYS_DISK_USAGE = ["/usr/bin/df", "-B1", "--output=source,target,size,avail"]
RE_SYS_DISK_USAGE_HEADERS = re.compile(r"^\s*Filesystem\s+Mounted on\s+1B-blocks\s+Avail\s*$", flags=re.MULTILINE)
RE_SYS_DISK_USAGE = re.compile(r"^\s*(?P<filesystem>\S+)\s+(?P<mountpoint>\S+)\s+(?P<total>\d+)\s+(?P<available>\d+)\s*$", flags=re.MULTILINE)
SYS_BOOT_ID = "/proc/sys/kernel/random/boot_id"
CGROUP_A = "/sys/fs/cgroup"
CGROUP_B_CPU = "cpu.stat"
CGROUP_B_MEM = "memory.current"
CGROUP_B_DISK_IO = "io.stat"
CGROUP_B_PROCS = "cgroup.procs"
RE_CGROUP_CPU = re.compile(r"^\s*usage_usec\s+(\d+)\s*$", re.MULTILINE)
RE_CGROUP_DISK_IO = re.compile(r"^\s*\d+:\d+\s+rbytes=(?P<bytes_read>\d+)\s+wbytes=(?P<bytes_written>\d+)\s+rios=\d+\s+wios=\d+\s+dbytes=\d+\s+dios=\d+\s*$", re.MULTILINE)
PROC_CMD_A = "/proc"
PROC_CMD_B = "cmdline"
MC_FUSE_MOUNT = resolvePath(readConfig("g_mc_monitor/config.json", str, "fuseMountPath"))
MC_TPS = "tps"
MC_HEAP_USED = "heap_used_bytes"
MC_HEAP_ALLOCATED = "heap_allocated_bytes"
RE_FILENAME = re.compile(r"^(\d+).json$")
LIVE_CGROUP_PROCS_FILENAME = "live_cgroup_procs.json"
STATE_FILENAME = "state.json"
WEBHOOKS_FILE = os.path.join(ROOT, "scripts", "webhooks.py")

# Utils ---
def extractsum(data: dict[str, str], *properties: list[str]):
    """
    Sums the values - for given properties - in data. Casts all values to integers.
    """
    return sum(int(v) for (k, v) in data.items() if k in properties)

def attempt_build_dict(source: dict[str: callable], *args: list[any]):
    """
    Attempts to create a dictionary of the same format as source, but with values replaced by the return-values of the functions.
    If a function fails then it is logged to console (via safe_call) and None is taken instead.
    The args array will be passed (with a star) to the compute function.
    """
    return {k: safe_call(v, *args, on_error_msg=f"Failed to compute value for '{v}': ") for (k, v) in source.items()}

def get_rule_key(interval: int, number: int):
    """
    Returns the name used to identify this retention rule - both as its record subfolder's name, and as its key
    in state.json's "intervals" (see documentation)
    """
    return str(interval) if number is None else f"{interval}_{number}"

def get_record_subfolder(interval: int, number: int):
    """
    Returns the path of the subfolder for the retention rule with the given argumenets
    """
    return os.path.join(RECORD_FOLDER, get_rule_key(interval, number))

def send_syswarn(resource: str, used_fraction: float, threshold_fraction: float):
    """
    Fires the SYSWARN webhook for the given resource in a background process (fire-and-forget, same as
    scripts/g_web/com/lib/webhook.ts does for its webhooks) - failures are logged rather than raised, so a
    webhook launch failure can't crash the mainloop.
    """
    safe_call(
        subprocess.Popen,
        [sys.executable, WEBHOOKS_FILE, "syswarn", resource, str(used_fraction), str(threshold_fraction)],
        on_error_msg=f"Failed to launch SYSWARN webhook for '{resource}': "
    )

def check_warn_threshold(resource: str, used_fraction: float, threshold: float, warned_resources: set[str]):
    """
    Edge-triggered threshold check: fires the SYSWARN webhook (via send_syswarn) the first time resource
    crosses above threshold, then stays silent on subsequent calls until used_fraction drops back below it.
    warned_resources is mutated in place to track which resources are currently over their threshold.
    """
    if used_fraction >= threshold:
        if resource not in warned_resources:
            print(f"Resource \"{resource}\" has crossed over the threshold - used: {used_fraction}, thresh: {threshold}")
            warned_resources.add(resource)
            send_syswarn(resource, used_fraction, threshold)
    else:
        if resource in warned_resources:
            print(f"Resource \"{resource}\" has crossed back under the threshold, discarding...")
            warned_resources.remove(resource)

# Data extraction functions ---
def read_sys_cpu():
    """
    Returns {"agg": {"total": int, "busy": int}, "ind": {[cpuno: str]: {"total": int, "busy": int}}}.
    The data is the cpu time in some arbitrary units.
    "total" is the time the cpu has been running for, and "busy" is the time spent actually doing something.
    """
    ret = {"agg": None, "ind": {}}
    matches = RE_SYS_CPU.finditer(open(SYS_CPU, "r").read())
    for match in matches:
        groupdict = match.groupdict()
        busy = extractsum(groupdict, "user", "nice", "system", "irq", "softirq", "steal")
        total = busy + extractsum(groupdict, "busy", "idle", "iowait")
        cpudata = {"total": total, "busy": busy}
        if groupdict["cpuno"] == "":  # This is the aggregate data
            if ret["agg"] is not None:
                raise Exception("Multiple records with no cpuno")
            ret["agg"] = cpudata
        else:
            cpuno = groupdict["cpuno"]
            if cpuno in ret["ind"]:
                raise Exception(f"Multiple records with cpuno {cpuno}")
            ret["ind"][cpuno] = cpudata
    return ret

def read_sys_mem():
    """
    Returns {"total": int, "used": int}.
    The data is in kB.
    "total" is the maximum amount of memory that can be used.
    """
    file = open(SYS_MEM, "r").read()
    total = int(RE_SYS_MEM_TOTAL.search(file).group(1))
    available = int(RE_SYS_MEM_AVAILABLE.search(file).group(1))
    return {
        "total": total,
        "used": total - available
    }

def read_sys_net_io():
    """
    Returns {"agg": {"sent": int, "recieved": int}, "ind": {[interface: str]: {"sent": int, "recieved": int}}}.
    All values are in bytes.
    "agg" is the total of all "ind" values excluding "lo". "lo" is 'loopback' - internal communications (e.g. between g_mc and mariadb).
    """
    ret = {"agg": {"sent": 0, "recieved": 0}, "ind": {}}
    matches = RE_SYS_NET_IO.finditer(open(SYS_NET_IO, "r").read())
    for match in matches:
        groupdict = match.groupdict()
        interface = groupdict["interface"]
        recieved_bytes = int(groupdict["recieved_bytes"])
        sent_bytes = int(groupdict["sent_bytes"])
        if interface in ret["ind"]:
            raise Exception(f"Multiple records with interface name '{interface}'")
        ret["ind"][interface] = {"sent": sent_bytes, "recieved": recieved_bytes}
        if interface != "lo":
            ret["agg"]["sent"] += sent_bytes
            ret["agg"]["recieved"] += recieved_bytes
    return ret

def read_sys_disk_io():
    """
    Returns {"agg": {"read": int, "written": int}, "ind": {[name: str]: {"read": int, "written": int}}}.
    All values are in bytes.
    "agg" is the total of all the "ind" values. "ind" contains the drive names (this does not include partitions).
    """
    ret = {"agg": {"read": 0, "written": 0}, "ind": {}}
    for name in os.listdir(SYS_DISK_IO_A):
        path = os.path.join(SYS_DISK_IO_A, name, SYS_DISK_IO_B)
        match = RE_SYS_DISK_IO.match(open(path, "r").read())
        groupdict = match.groupdict()
        bytes_read = int(groupdict["sectors_read"]) * 512  # All sectors are 512 bytes
        bytes_written = int(groupdict["sectors_written"]) * 512
        ret["ind"][name] = {"read": bytes_read, "written": bytes_written}
        ret["agg"]["read"] += bytes_read
        ret["agg"]["written"] += bytes_written
    return ret

def read_disk_usage():
    """
    Returns {[mount_point: str]: {"total": int, "used": int}} for every filesystem reported by df.
    All values are in bytes.
    """
    output = subprocess.run(SYS_DISK_USAGE, capture_output=True, text=True, check=True).stdout
    assert RE_SYS_DISK_USAGE_HEADERS.search(output), f"Header of df output is incorrect: \n{output}"
    ret = {}
    for match in RE_SYS_DISK_USAGE.finditer(output):
        groupdict = match.groupdict()
        total = int(groupdict["total"])
        available = int(groupdict["available"])
        ret[groupdict["mountpoint"]] = {"total": total, "used": total - available}
    return ret

def read_boot_id():
    """
    Returns str - the current boot id. This changes across reboots, which is used to detect resets of the
    system-wide cumulative counters (sys_cpu, sys_net_io, sys_disk_io).
    """
    return open(SYS_BOOT_ID, "r").read().strip()

def read_cgroup_cpu(cgroup):
    """
    Returns int - sum of microseconds of each core used by the cgroup.
    """
    return int(RE_CGROUP_CPU.search(open(os.path.join(CGROUP_A, cgroup, CGROUP_B_CPU), "r").read()).group(1))

def read_cgroup_mem(cgroup):
    """
    Returns {"total": int, "used": int}.
    The data is in kB.
    "total" is the maximum amount of memory that could be used (by this cgroup) when ran on its own.
    """
    return {
        "used": int(int(open(os.path.join(CGROUP_A, cgroup, CGROUP_B_MEM), "r").read()) / 1024),  # We round this for consistency with sys_mem
        "total": read_sys_mem()["total"]  # TODO: Cache this value somehow
    }

def read_cgroup_disk_io(cgroup):
    """
    Returns {"read": int, "written": int}.
    "written" and "read" are in bytes, and are aggregated for all drives.
    """
    matches = RE_CGROUP_DISK_IO.finditer(open(os.path.join(CGROUP_A, cgroup, CGROUP_B_DISK_IO), "r").read())
    disk_read = sum([int(match.groupdict()["bytes_read"]) for match in matches])
    disk_written = sum([int(match.groupdict()["bytes_written"]) for match in matches])
    return {"read": disk_read, "written": disk_written}

def read_cgroup_procs(cgroup):
    """
    Returns {[proc_id: int]: str}
    "procs" are the processes in this cgroup. The dictionary maps from process id to command used to start the process.
    """
    proc_ids = [id_.strip() for id_ in open(os.path.join(CGROUP_A, cgroup, CGROUP_B_PROCS), "r").read().split("\n")]
    procs = {int(id_): open(os.path.join(PROC_CMD_A, id_, PROC_CMD_B), "r").read().replace("\x00", " ").strip() for id_ in proc_ids if id_ != ""}
    return procs

def read_cgroup_inode(cgroup):
    """
    Returns int - the inode of the cgroup's cgroupfs directory. This changes when the cgroup is recreated (e.g.
    its service restarts), which is used to detect resets of that cgroup's cumulative counters (cpu, disk_io).
    It's very unlikely, but not impossible, for a recreated cgroup to be reassigned the same inode it had
    before - in that case the reset would go undetected.
    """
    return os.stat(os.path.join(CGROUP_A, cgroup)).st_ino

def read_mc_tps():
    """
    Returns float - rolling average TPS (ticks per second) over the last 100 ticks, capped at 20.
    """
    return float(open(os.path.join(MC_FUSE_MOUNT, MC_TPS), "r").read())

def read_mc_mem():
    """
    Returns {"total": int, "used": int}.
    The data is in kB.
    "total" is the heap's -Xmx ceiling, "used" is the heap currently in use.
    """
    return {
        "used": int(int(open(os.path.join(MC_FUSE_MOUNT, MC_HEAP_USED), "r").read()) / 1024),  # We round this for consistency with sys_mem
        "total": int(int(open(os.path.join(MC_FUSE_MOUNT, MC_HEAP_ALLOCATED), "r").read()) / 1024)
    }

def read_data():
    """
    Reads all the data from the system and CGROUPS and returns it as seriazable object that folows the format defined in the documentation.
    All values here are absolute readings - cumulative counters get turned into deltas separately, per retention rule, by compute_record.
    """
    return attempt_build_dict({
        "sys_cpu": read_sys_cpu,
        "sys_mem": read_sys_mem,
        "sys_net_io": read_sys_net_io,
        "sys_disk_io": read_sys_disk_io,
        "minecraft": lambda: attempt_build_dict({
            "tps": read_mc_tps,
            "mem": read_mc_mem
        }),
        "cgroups": lambda: {
            cgroup: attempt_build_dict({
                "cpu": read_cgroup_cpu,
                "mem": read_cgroup_mem,
                "disk_io": read_cgroup_disk_io
            }, cgroup)
            for cgroup in CGROUPS
        }
    })

def read_live_cgroup_procs():
    """
    Reads the current processes for each tracked cgroup, for the live_cgroup_procs.json file.
    Returns {[cgroup: str]: {[proc_id: int]: str} | None}, see documentation for live_cgroup_procs.json.
    """
    # Bind cgroup as a default arg so each lambda captures its own value rather than the loop variable
    return attempt_build_dict({cgroup: (lambda cg=cgroup: read_cgroup_procs(cg)) for cgroup in CGROUPS})

# Cumulative counters ---
# See "Cumulative Counters" and "State" in the documentation - monitor.py stores the delta of these counters
# since each retention rule's own previous record, rather than an absolute value, diffing against (and then
# updating) that rule's own baseline in state.json
def diff_dict(current: dict | None, baseline: dict | None, fields: tuple[str, ...]):
    """
    Diffs a single {field: int, ...} reading (e.g. one arbCpu/netIO/diskIO value) against its baseline.
    current and baseline are expected to already have exactly the keys in fields.
    Returns (delta, new_baseline) - delta is None if either value is missing (no reading this tick, or no
    baseline to diff against yet). new_baseline is what should replace baseline in state.json from now on.
    """
    if current is None:
        return None, baseline
    if baseline is None:
        return None, current
    return {field: current[field] - baseline[field] for field in fields}, current

def diff_counter(current: int | None, baseline: int | None):
    """
    Same as diff_dict, but for a single bare int counter (e.g. a cgroup's cpu usage) rather than a {field: int} dict.
    """
    if current is None:
        return None, baseline
    if baseline is None:
        return None, current
    return current - baseline, current

def diff_agg_ind(current: dict | None, baseline: dict | None, fields: tuple[str, ...]):
    """
    Diffs a {"agg": {...}, "ind": {key: {...}}} reading (sys_cpu/sys_net_io/sys_disk_io) against its baseline.
    Returns (result, new_baseline). If current or baseline is entirely missing, result is None (see diff_dict).
    Otherwise "agg" is diffed as a whole (we expect that keys are the same in current and baseline), and each 
    "ind" key is diffed individually against baseline["ind"] - current["ind"] and baseline["ind"] are NOT 
    expected to have the same keys, so a key with no baseline entry yet (e.g. a newly appeared network interface 
    or disk) gets null rather than raising or dropping the whole reading. 
    new_baseline is always set to current in full, so newly-appeared keys become
    part of the baseline immediately, and keys that disappeared from current are naturally dropped from it.
    """
    if current is None:
        return None, baseline
    if baseline is None:
        return None, current
    agg, _ = diff_dict(current["agg"], baseline["agg"], fields)
    ind = {key: diff_dict(value, baseline["ind"].get(key), fields)[0] for (key, value) in current["ind"].items()}
    return {"agg": agg, "ind": ind}, current

def diff_cgroups(cgroups: dict, baseline: dict):
    """
    Diffs the "cpu" and "disk_io" cumulative counters of every cgroup in cgroups (as read by read_data) against
    baseline (state.json's per-rule "cgroups" entry - see documentation), leaving "mem" untouched since it's
    a gauge rather than a cumulative counter. 
    cgroups and baseline are NOT expected to have the same keys - a cgroup missing from baseline (never
    recorded yet, or invalidated by an inode change) is handled the same as a missing baseline value.
    Returns (result, new_baseline), see diff_dict/diff_counter.
    """
    result = {}
    new_baseline = {}
    for (cgroup, current) in cgroups.items():
        cgroup_baseline = baseline.get(cgroup, {})
        cpu, new_cpu_baseline = diff_counter(current["cpu"], cgroup_baseline.get("cpu"))
        disk_io, new_disk_io_baseline = diff_dict(current["disk_io"], cgroup_baseline.get("disk_io"), ("read", "written"))
        result[cgroup] = {"cpu": cpu, "mem": current["mem"], "disk_io": disk_io}
        new_baseline[cgroup] = {"cpu": new_cpu_baseline, "disk_io": new_disk_io_baseline}
    return result, new_baseline

def compute_record(data: dict, interval_state: dict, current_time: float, aggregate: dict | None):
    """
    Turns data (an absolute reading from read_data) into a record for one retention rule, diffing its cumulative
    counters against interval_state (that rule's entry in state.json's "intervals" - see documentation).
    current_time is this write's precise time (time.time()), used to compute the record's "actualPeriod" - the
    real time elapsed since this rule's previous record - which is None for the first record ever written for
    this rule (interval_state["time"] is None), the same as a cumulative counter with no baseline yet.
    aggregate, for an "aggregate"-mode rule, is this write's flushed tracker (see flush_tracker) - its values
    replace data's gauge readings (sys_mem, minecraft.tps, minecraft.mem, cgroups.*.mem) in the record. Pass
    None for a "snapshot"-mode rule, to use data's own readings unchanged. Cumulative counters (sys_cpu,
    sys_net_io, sys_disk_io, cgroups.*.cpu, cgroups.*.disk_io) are unaffected either way - see documentation.
    Returns (record, new_interval_state) - new_interval_state must replace interval_state in state.json, so the
    next record for this rule diffs against this tick's values.
    """
    actual_period = None if interval_state["time"] is None else current_time - interval_state["time"]
    sys_cpu, new_sys_cpu = diff_agg_ind(data["sys_cpu"], interval_state["sys_cpu"], ("total", "busy"))
    sys_net_io, new_sys_net_io = diff_agg_ind(data["sys_net_io"], interval_state["sys_net_io"], ("sent", "recieved"))
    sys_disk_io, new_sys_disk_io = diff_agg_ind(data["sys_disk_io"], interval_state["sys_disk_io"], ("read", "written"))
    cgroups, new_cgroups = diff_cgroups(data["cgroups"], interval_state["cgroups"])
    if aggregate is None:
        sys_mem = data["sys_mem"]
        minecraft = data["minecraft"]
    else:
        sys_mem = aggregate["sys_mem"]
        minecraft = aggregate["minecraft"]
        for (cgroup, cgroup_data) in cgroups.items():
            cgroup_data["mem"] = aggregate["cgroups"].get(cgroup)
    record = {
        "actualPeriod": actual_period,
        "sys_cpu": sys_cpu,
        "sys_mem": sys_mem,
        "sys_net_io": sys_net_io,
        "sys_disk_io": sys_disk_io,
        "minecraft": minecraft,
        "cgroups": cgroups
    }
    new_interval_state = {
        "time": current_time,
        "sys_cpu": new_sys_cpu,
        "sys_net_io": new_sys_net_io,
        "sys_disk_io": new_sys_disk_io,
        "cgroups": new_cgroups
    }
    return record, new_interval_state

def load_state():
    """
    Loads state.json (see documentation), or a fresh empty one if it doesn't exist yet (e.g. first ever run).
    """
    path = os.path.join(RECORD_FOLDER, STATE_FILENAME)
    if not os.path.exists(path):
        return {"boot_id": None, "cgroup_inodes": {}, "intervals": {}}
    return json.loads(open(path, "r").read())

def save_state(state: dict):
    """
    Persists state to state.json (see documentation).
    """
    open(os.path.join(RECORD_FOLDER, STATE_FILENAME), "w").write(json.dumps(state))

def refresh_reset_detection(state: dict):
    """
    Re-reads the current boot id and each tracked cgroup's inode, and - if either has changed since state was
    last updated - invalidates (in place, within state) the affected cumulative-counter baselines across every
    retention rule's entry in state["intervals"]. This runs every mainloop tick, not just when a rule is due to
    write, so a slower rule can't miss a reset that a faster rule already saw (see "Cumulative Counters" and
    "State" in the documentation). Read failures are logged (via safe_call) and skipped for this tick, rather
    than treated as a reset.
    """
    boot_id = safe_call(read_boot_id, on_error_msg="Failed to read boot id: ")
    if boot_id is not None:
        if state["boot_id"] is not None and boot_id != state["boot_id"]:
            print("Boot id has changed - system has restarted, invalidating system-wide cumulative counters")
            for interval_state in state["intervals"].values():
                interval_state["sys_cpu"] = None
                interval_state["sys_net_io"] = None
                interval_state["sys_disk_io"] = None
        state["boot_id"] = boot_id

    for cgroup in CGROUPS:
        inode = safe_call(read_cgroup_inode, cgroup, on_error_msg=f"Failed to read inode for cgroup '{cgroup}': ")
        if inode is None:
            continue
        if cgroup in state["cgroup_inodes"] and inode != state["cgroup_inodes"][cgroup]:
            print(f"CGroup '{cgroup}' inode has changed - it has restarted, invalidating its cumulative counters")
            for interval_state in state["intervals"].values():
                interval_state["cgroups"].pop(cgroup, None)
        state["cgroup_inodes"][cgroup] = inode

# Aggregate tracking ---
# See "Snapshot vs. aggregate modes" in the documentation - for "aggregate" rules, monitor.py keeps a running,
# in-memory-only tracker per rule (never persisted to state.json, unlike the cumulative-counter baselines
# above - see documentation), folding in one more mainloop tick's worth of gauge readings every iteration, and
# flushing it into a record's sys_mem/minecraft.tps/minecraft.mem/cgroups.*.mem fields once that rule is due.
# Cumulative counters are unaffected by mode, so aren't tracked here at all.
def new_value_tracker():
    """
    Fresh tracker for a single time-weighted-mean/min/max of a bare gauge reading (e.g. tps, or one mem's "used").
    """
    return {"weighted_sum": None, "min": None, "max": None}

def track_value(tracker: dict, value: float | None, dt: float):
    """
    Folds one tick's reading (None if it failed to read this tick) into tracker, weighted by dt (this tick's
    real duration - see "Precision" in the documentation).
    """
    if value is None:
        return
    tracker["weighted_sum"] = value * dt if tracker["weighted_sum"] is None else tracker["weighted_sum"] + value * dt
    tracker["min"] = value if tracker["min"] is None else min(tracker["min"], value)
    tracker["max"] = value if tracker["max"] is None else max(tracker["max"], value)

def flush_value(tracker: dict, sum_dt: float):
    """
    Turns tracker's accumulated ticks into {"min", "mean", "max"}, or None if it never saw a valid tick.
    """
    if tracker["min"] is None:
        return None
    # sum_dt can only be 0 if the only tick(s) folded in were the mainloop's very first ever (see previous_tick_time
    # below) - fall back to the single observed value rather than dividing by zero
    mean = tracker["min"] if sum_dt == 0 else tracker["weighted_sum"] / sum_dt
    return {"min": tracker["min"], "mean": mean, "max": tracker["max"]}

def new_mem_tracker():
    """
    Fresh tracker for a {"total": int, "used": int} gauge (sys_mem, or one cgroup's/minecraft's mem) - "used" is
    tracked as a value tracker, "total" is just carried through from the latest tick (assumed to stay constant).
    """
    return {"used": new_value_tracker(), "total": None}

def track_mem(tracker: dict, value: dict | None, dt: float):
    """
    Folds one tick's {"total": int, "used": int} reading (None if it failed to read this tick) into tracker.
    """
    if value is None:
        return
    track_value(tracker["used"], value["used"], dt)
    tracker["total"] = value["total"]

def flush_mem(tracker: dict, sum_dt: float):
    """
    Turns tracker's accumulated ticks into {"min", "mean", "max", "total"}, or None if it never saw a valid tick.
    """
    used = flush_value(tracker["used"], sum_dt)
    return None if used is None else {**used, "total": tracker["total"]}

def new_tracker():
    """
    Fresh per-retention-rule aggregate tracker - see the "Aggregate tracking" comment above.
    """
    return {"sum_dt": 0.0, "sys_mem": new_mem_tracker(), "minecraft_mem": new_mem_tracker(), "minecraft_tps": new_value_tracker(), "cgroups": {}}

def track_tick(tracker: dict, data: dict, dt: float):
    """
    Folds one mainloop tick's worth of gauge readings from data (see read_data) into tracker, weighted by dt.
    """
    tracker["sum_dt"] += dt
    track_mem(tracker["sys_mem"], data["sys_mem"], dt)
    minecraft = data["minecraft"] or {}
    track_mem(tracker["minecraft_mem"], minecraft.get("mem"), dt)
    track_value(tracker["minecraft_tps"], minecraft.get("tps"), dt)
    for (cgroup, cgroup_data) in data["cgroups"].items():
        track_mem(tracker["cgroups"].setdefault(cgroup, new_mem_tracker()), cgroup_data["mem"], dt)

def flush_tracker(tracker: dict):
    """
    Turns tracker's accumulated ticks into the values compute_record splices into an "aggregate"-mode record -
    see the "Aggregate tracking" comment above. Unlike compute_record's own return, this isn't itself a record -
    it's passed straight back into compute_record as its aggregate argument.
    """
    sum_dt = tracker["sum_dt"]
    return {
        "sys_mem": flush_mem(tracker["sys_mem"], sum_dt),
        "minecraft": {"tps": flush_value(tracker["minecraft_tps"], sum_dt), "mem": flush_mem(tracker["minecraft_mem"], sum_dt)},
        "cgroups": {cgroup: flush_mem(cgroup_tracker, sum_dt) for (cgroup, cgroup_tracker) in tracker["cgroups"].items()}
    }


# Mainloop ---
warned_resources = set()  # Resources currently over their warn threshold - see check_warn_threshold
state = load_state()  # Tracks what's needed to detect resets and diff cumulative counters, persists across monitor.py restarts - see documentation
trackers = {}  # rule_key -> aggregate tracker, one per "aggregate"-mode rule - in-memory only, see "Aggregate tracking"
previous_tick_time = None  # Precise time of the previous mainloop tick, used to weight this tick's contribution to trackers
while True:
    # Create record subfolders if necessary
    assert os.path.exists(RECORD_FOLDER), f"Record folder - '{RECORD_FOLDER}' - does not exist"
    for interval, number, mode in RETENTION_RULES:
        path = get_record_subfolder(interval, number)
        if not os.path.exists(path):
            os.mkdir(path)

    # Detect system/cgroup resets before computing any deltas below, so a rule that isn't due yet this tick
    # still sees the invalidation once it is
    refresh_reset_detection(state)

    # Sample data
    data = read_data()
    current_time_exact = time.time()  # Higher precision than current_time - used for actualPeriod/state.json's "time" (see documentation)
    current_time = int(current_time_exact)
    # 0 for the very first ever tick (no previous tick to measure from) - see flush_value
    tick_dt = 0.0 if previous_tick_time is None else current_time_exact - previous_tick_time
    previous_tick_time = current_time_exact

    # Check RAM and the tracked drives against their warn thresholds, firing SYSWARN webhooks on
    # threshold crossings (check_warn_threshold is edge-triggered, so this doesn't spam every tick)
    if data["sys_mem"] is not None:
        mem = data["sys_mem"]
        check_warn_threshold("RAM", mem["used"] / mem["total"], RAM_WARN_THRESHOLD, warned_resources)
    disk_usage = safe_call(read_disk_usage, on_error_msg="Failed to read disk usage: ") or {}
    for mount in DISK_WARN_MOUNTS:
        if mount not in disk_usage:
            print(f"WARNING: diskWarnMounts entry {mount!r} not found in df output, skipping")
            continue
        usage = disk_usage[mount]
        check_warn_threshold(f"Disk ({mount})", usage["used"] / usage["total"], DISK_WARN_THRESHOLD, warned_resources)

    # Write live data - unconditionally overwritten every iteration, no history retained (see documentation)
    live_cgroup_procs = {"timestamp": current_time, "cgroups": read_live_cgroup_procs()}
    open(os.path.join(RECORD_FOLDER, LIVE_CGROUP_PROCS_FILENAME), "w").write(json.dumps(live_cgroup_procs))

    # Fold this tick into every "aggregate" rule's tracker - every tick, not just when a record is due
    for interval, number, mode in RETENTION_RULES:
        if mode == "aggregate":
            track_tick(trackers.setdefault(get_rule_key(interval, number), new_tracker()), data, tick_dt)

    # Find subfolders where a new record needs creation
    needs_new = []  # (path, rule_key, mode) of subfolders where a new record needs to be put
    for interval, number, mode in RETENTION_RULES:
        rule_key = get_rule_key(interval, number)
        path = get_record_subfolder(interval, number)
        items = os.listdir(path)
        newest_time = max([int(item.removesuffix(".json")) for item in items if RE_FILENAME.match(item)]) if len(items) > 0 else current_time - interval # The time of the most recent record. If no records exist then create one now

        # Does this subfolder need a new record
        if current_time - newest_time >= interval:
            needs_new.append((path, rule_key, mode))

    # Write each due rule's record - every rule diffs data against (and then updates) its own baseline in state
    for path, rule_key, mode in needs_new:
        interval_state = state["intervals"].setdefault(rule_key, {"time": None, "sys_cpu": None, "sys_net_io": None, "sys_disk_io": None, "cgroups": {}})
        aggregate = None
        if mode == "aggregate":
            aggregate = flush_tracker(trackers.setdefault(rule_key, new_tracker()))
            trackers[rule_key] = new_tracker()  # Reset for the next window
        record, state["intervals"][rule_key] = compute_record(data, interval_state, current_time_exact, aggregate)
        open(os.path.join(path, f"{current_time}.json"), "w").write(json.dumps(record))

    # Persist state so if g_monitor restarts then we don't have to start from a blank slate
    save_state(state)

    # Remove old records
    for interval, number, mode in RETENTION_RULES:
        if number is not None:  # If there is a maximum number of records for this interval
            path = get_record_subfolder(interval, number)
            while len(items := os.listdir(path)) > number:
                oldest = min([int(item.removesuffix(".json")) for item in items if RE_FILENAME.match(item)])
                record_path = os.path.join(path, f"{oldest}.json")
                os.remove(record_path)

    # Sleep
    time.sleep(BASE_INTERVAL)
