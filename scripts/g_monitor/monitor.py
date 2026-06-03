import re
import json
import traceback
import subprocess
import os

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
SYS_DISK_USAGE = ["df", "-B1", "--output=source,target,size,avail"]
RE_SYS_DISK_USAGE_HEADERS = re.compile(r"^\s*Filesystem\s+Mounted on\s+1B-blocks\s+Avail\s*$", flags=re.MULTILINE)
RE_SYS_DISK_USAGE = re.compile(r"^\s*(?P<filesystem>\S+)\s+(?P<mountpoint>\S+)\s+(?P<total>\d+)\s+(?P<available>\d+)\s*$", flags=re.MULTILINE)
CGROUP_A = "/sys/fs/cgroup"
CGROUP_B_CPU = "cpu.stat"
CGROUP_B_MEM = "memory.current"
CGROUP_B_DISK_IO = "io.stat"
CGROUP_B_PROCS = "cgroup.procs"
RE_CGROUP_CPU = re.compile(r"^\s*usage_usec\s+(\d+)\s*$", re.MULTILINE)
RE_CGROUP_DISK_IO = re.compile(r"^\s*\d+:\d+\s+rbytes=(?P<bytes_read>\d+)\s+wbytes=(?P<bytes_written>\d+)\s+rios=\d+\s+wios=\d+\s+dbytes=\d+\s+dios=\d+\s*$", re.MULTILINE)
PROC_CMD_A = "/proc"
PROC_CMD_B = "cmdline"

# Utils ---
def extractsum(data: dict[str, str], *properties: list[str]):
    """
    Sums the values - for given properties - in data. Casts all values to integers.
    """
    return sum(int(v) for (k, v) in data.items() if k in properties)

def attempt_build_dict(source: dict[str: callable], *args: list[any]):
    """
    Attempts to create a dictionary of the same format as source, but with values replaced by the return-values of the functions.
    If a function fails then it is logged to console and None is taken instead.
    The args array will be passed (with a star) to the compute function.
    """

    output = {}
    for (k, v) in source.items():
        try:
            computed_value = v(*args)
        except Exception as e:
            print(f"Failed to compute value for '{v}': ")
            print(*["\t" + line for line in traceback.format_exc().split("\n")], sep="\n")
            computed_value = None
        output[k] = computed_value
    return output

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
        ret["ind"][name] = {"read": bytes_read, "written": bytes_read}
        ret["agg"]["read"] += bytes_read
        ret["agg"]["written"] += bytes_written
    return ret

def read_sys_disk_usage():
    """
    Returns {[mountpoint: str]: {"filesystem": str, "total": int, "used": int}}.
    All integer values are in bytes.
    "total" is the total space that can be used, "used" is the space that is already used.
    """
    ret = {}
    raw = subprocess.check_output(SYS_DISK_USAGE).decode()
    assert RE_SYS_DISK_USAGE_HEADERS.match(raw), f"Header of data is incorrect: \n{raw}"
    matches = RE_SYS_DISK_USAGE.finditer(raw)
    for match in matches:
        groupdict = match.groupdict()
        filesystem = groupdict["filesystem"]
        mountpoint = groupdict["mountpoint"]
        total = int(groupdict["total"])
        available = int(groupdict["available"])
        if mountpoint in ret:
            raise Exception(f"Multiple records with mountpoint '{mountpoint}'")
        ret[mountpoint] = {"filesystem": filesystem, "total": total, "used": total - available}
    return ret

def read_cgroup_cpu(cgroup):
    """
    Returns int - microseconds of cpu used by the cgroup.
    """
    return int(RE_CGROUP_CPU.search(open(os.path.join(CGROUP_A, cgroup, CGROUP_B_CPU), "r").read()).group(1))

def read_cgroup_mem(cgroup):
    """
    Returns int - bytes of memory used by the cgroup.    
    """
    return int(open(os.path.join(CGROUP_A, cgroup, CGROUP_B_MEM), "r").read())

def read_cgroup_disk_io(cgroup):
    """
    Returns {"read": int, "written": int}.
    "written" and "read" are in bytes, and are aggregated for all drives.
    """
    matches = RE_CGROUP_DISK_IO.finditer(open(os.path.join(CGROUP_A, cgroup, CGROUP_B_DISK_IO), "r").read())
    disk_read = sum([int(match.groupdict()["bytes_read"]) for match in matches])
    disk_written = sum([int(match.groupdict()["bytes_written"]) for match in matches])
    return {"read": disk_read, "written": disk_written}

def read_cgroup_net_io(cgroup):
    """
    Returns {"sent": int, "recieved": int}
    "sent" and "recieved" are in bytes, and are aggregated for all external traffic (loopback omitted). 
    """
    raise NotImplemented

def read_cgroup_procs(cgroup):
    """
    Returns {[proc_id: int]: str}
    "procs" are the processes in this cgroup. The dictionary maps from process id to command used to start the process.
    """
    proc_ids = [id_.strip() for id_ in open(os.path.join(CGROUP_A, cgroup, CGROUP_B_PROCS), "r").read().split("\n")]
    procs = {int(id_): open(os.path.join(PROC_CMD_A, id_, PROC_CMD_B), "r").read().replace("\x00", " ").strip() for id_ in proc_ids if id_ != ""}
    return procs


cgroups = ["system.slice/dbus.service", "system.slice/bluetooth.service"]
print(json.dumps(attempt_build_dict({
    "sys_cpu": read_sys_cpu, 
    "sys_mem": read_sys_mem,
    "sys_net_io": read_sys_net_io,
    "sys_disk_io": read_sys_disk_io,
    "sys_disk_usage": read_sys_disk_usage,
    "cgroups": lambda cgroups=cgroups: {
        cgroup: attempt_build_dict({
            "cpu": read_cgroup_cpu,
            "mem": read_cgroup_mem,
            "disk_io": read_cgroup_disk_io,
            "net_io": read_cgroup_net_io,
            "procs": read_cgroup_procs
        }, cgroup)
        for cgroup in cgroups
    }
}), indent=2))
