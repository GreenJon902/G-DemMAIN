"""
Migration 1: brings pre-2026-08-15 g_monitor records up to the 2026-08-16.2 schema. Only run this
against a record folder whose subfolders contain nothing but old-format records - see
doc/Monitoring.md "Migrations".

Schema diff (unchanged lines are context - see doc/Monitoring.md "Monitor Format"):
  {
+     "actualPeriod": float | null,        Seconds, real time elapsed since this retention rule's previous record - null for that rule's first record ever
+     "migration_history": [int, ...],     IDs of migration scripts (see utils/migrations) applied to this record, in order
      "sys_cpu": {
          "agg": {
              "total": int,                Arbitary units, Delta since last record
              "busy": int                  Arbitary units, Delta since last record
          },
          "ind": {
              [cpuno]: {                       # Keys not necessarily constant
                  "total": int,            Arbitary units, Delta since last record
                  "busy": int              Arbitary units, Delta since last record
              } | null                         # null if this key has no previous record to diff against
          }
      } | null,
      "sys_mem": {
          "total": int,                    Kilobytes
          "used": int                      Kilobytes
      } | null,
      "sys_net_io": {
          "agg": {                             # Does not include 'lo' interface
              "sent": int,                 Bytes, Delta since last record
              "recieved": int              Bytes, Delta since last record
          },
          "ind": {
              [interface_name]: {              # Keys not necessarily constant
                  "sent": int,             Bytes, Delta since last record
                  "recieved": int          Bytes, Delta since last record
              } | null                         # null if this key has no previous record to diff against
          }
      } | null,
      "sys_disk_io": {
          "agg": {
              "read": int,                 Bytes, Delta since last record
              "written": int               Bytes, Delta since last record
          },
          "ind": {
              [name]: {                        # Keys not necessarily constant
                  "read": int,             Bytes, Delta since last record
                  "written": int           Bytes, Delta since last record
              } | null                         # null if this key has no previous record to diff against
          }
      } | null,
-     "sys_disk_usage": {                  # @deprecated - dropped entirely by this migration
-         [mount_point]: {
-             "filesystem": str,
-             "total": int,                Bytes
-             "used": int                  Bytes
-         }
-     } | null,
      "minecraft": {
          "tps": float | null,             Ticks per second, rolling average over the last 100 ticks, capped at 20
          "mem": {
              "total": int,                Kilobytes                                # The heap's -Xmx ceiling
              "used": int                  Kilobytes                                # The heap currently in use
          } | null,
-         "players": [str, ...] | null     # @deprecated - dropped entirely by this migration
      } | null,
      "cgroups": {
          [cgroup_name]: {                     # Keys not necessarily constant
              "cpu": int | null,           Microseconds, Delta since last record
              "mem": {
                  "total": int,                    Kilobytes
                  "used": int                      Kilobytes
              } | null,
              "disk_io": {
                  "read": int,             Bytes, Delta since last record
                  "written": int           Bytes, Delta since last record
              } | null,
-             "procs": {                    # @deprecated - dropped entirely by this migration
-                 [process_id: int]: str
-             } | null
          }
      }
  }

Beyond the field additions/removals above, sys_cpu/sys_net_io/sys_disk_io/cgroups.*.{cpu,disk_io}
change from absolute cumulative readings to deltas against the previous record in the same
subfolder (matching monitor.py's CumulativeField) - the first record in each subfolder has no
baseline, so those fields (and actualPeriod) are null there. A negative delta can only mean an
undetected reset happened between the two ticks (service restart/reboot) - unlike monitor.py's
live reset detection, this migration has no historical boot_id/cgroup-inode to check, so it
treats a negative delta the same as no baseline: null. mem and tps are left exactly as they were
(snapshot) - there's no way to retroactively compute a min/mean/max aggregate for a past window.
"""

import os
import json
import re
from argparse import ArgumentParser

MIGRATION_ID = 1

RE_SUBFOLDER = re.compile(r"^\d+(_\d+)?$")
RE_RECORD_FILENAME = re.compile(r"^(\d+)\.json$")

CPU_FIELDS = ("total", "busy")
NET_IO_FIELDS = ("sent", "recieved")
DISK_IO_FIELDS = ("read", "written")


def diff_fields(current, baseline, fields):
    """
    current, baseline: {field: int, ...} (all of `fields` present) or None. Returns a dict of
    per-field deltas, or None if either side is missing or any field's delta is negative - see
    module docstring for why a negative delta is treated the same as no baseline.
    """
    if current is None or baseline is None:
        return None
    deltas = {field: current[field] - baseline[field] for field in fields}
    return None if any(delta < 0 for delta in deltas.values()) else deltas


def diff_single(current, baseline):
    """Single-value equivalent of diff_fields - see its docstring."""
    if current is None or baseline is None:
        return None
    delta = current - baseline
    return None if delta < 0 else delta


def diff_agg_ind(current, baseline, fields):
    """
    current, baseline: {"agg": {...}, "ind": {key: {...}}} or None, holding absolute values for
    `fields`. Returns the same shape with deltas, or None if the whole reading is unrecoverable
    (agg itself has no valid baseline) - individual "ind" entries are independently null via
    diff_fields, since one core/interface/disk resetting doesn't mean the whole reading did.
    """
    if current is None or baseline is None:
        return None
    agg = diff_fields(current["agg"], baseline["agg"], fields)
    if agg is None:
        return None
    ind = {key: diff_fields(value, baseline["ind"].get(key), fields) for key, value in current["ind"].items()}
    return {"agg": agg, "ind": ind}


def migrate_record(current, baseline, actual_period):
    """
    Migrates one old-format record (see module docstring) to the current schema. baseline is the
    previous record in the same subfolder, in its original (still old-format) form - None for the
    first record ever in that subfolder. actual_period is the real time elapsed since baseline (or
    None for the first record).
    """
    baseline_cgroups = (baseline or {}).get("cgroups", {})
    record = {
        "actualPeriod": actual_period,
        "migration_history": [*current.get("migration_history", []), MIGRATION_ID],
        "sys_cpu": diff_agg_ind(current.get("sys_cpu"), baseline.get("sys_cpu") if baseline else None, CPU_FIELDS),
        "sys_mem": current.get("sys_mem"),  # Left as a snapshot - see module docstring
        "sys_net_io": diff_agg_ind(current.get("sys_net_io"), baseline.get("sys_net_io") if baseline else None, NET_IO_FIELDS),
        "sys_disk_io": diff_agg_ind(current.get("sys_disk_io"), baseline.get("sys_disk_io") if baseline else None, DISK_IO_FIELDS),
        "cgroups": {
            name: {
                "cpu": diff_single(cgroup.get("cpu"), baseline_cgroups.get(name, {}).get("cpu")),
                "mem": cgroup.get("mem"),  # Left as a snapshot - see module docstring
                "disk_io": diff_fields(cgroup.get("disk_io"), baseline_cgroups.get(name, {}).get("disk_io"), DISK_IO_FIELDS)
            }
            for name, cgroup in current.get("cgroups", {}).items()
        }
    }
    if "minecraft" in current:  # Absent entirely in records predating that field - preserve that, rather than inventing a null
        record["minecraft"] = None if current["minecraft"] is None else {
            "tps": current["minecraft"].get("tps"),  # Left as a snapshot - see module docstring
            "mem": current["minecraft"].get("mem")   #  "
        }
    return record


def migrate_subfolder(path, dry_run):
    """Migrates every record in one retention-rule subfolder, in place, oldest first."""
    filenames = sorted(
        (f for f in os.listdir(path) if RE_RECORD_FILENAME.match(f)),
        key=lambda f: int(f.removesuffix(".json"))
    )
    times = [int(f.removesuffix(".json")) for f in filenames]
    raws = [json.loads(open(os.path.join(path, f), "r").read()) for f in filenames]

    baseline = None  # The previous record's ORIGINAL (still absolute-valued) reading, so each record diffs against the right baseline regardless of write order
    baseline_time = None
    for time_, filename, raw in zip(times, filenames, raws):
        actual_period = None if baseline_time is None else time_ - baseline_time
        record = migrate_record(raw, baseline, actual_period)
        if not dry_run:
            open(os.path.join(path, filename), "w").write(json.dumps(record))
        baseline = raw
        baseline_time = time_

    print(f"  {len(filenames)} record(s) {'would be ' if dry_run else ''}migrated")


if __name__ == "__main__":
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("record_folder", help="The g_monitor record folder to migrate in place (its retention-rule subfolders are migrated; state.json and live_cgroup_procs.json are untouched). Every record in it is assumed to already be old-format - see module docstring")
    parser.add_argument("-d", "--dry-run", action="store_true", help="Don't write anything, just report what would happen")
    args = parser.parse_args()
    for name in sorted(os.listdir(args.record_folder)):
        path = os.path.join(args.record_folder, name)
        if not os.path.isdir(path) or not RE_SUBFOLDER.match(name):
            continue
        print(f"Migrating {path}")
        migrate_subfolder(path, args.dry_run)
