/**
 * This file provides the utilities for the panel pages.
 * All exported functions should check for authentication.
 */

import "server-only";
import fs from "fs/promises";
import * as path from "node:path";
import * as z from "zod";
import { C, type UnitType } from "@g/com/lib/config";
import { requirePermission } from "./session";
import { existsSync } from "fs";
import * as zlib from "zlib";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";


// Lists ------------------------------------------------------------------------

// Define or generic list item, this is what gets passed around and rendered
export type ListItem = {
    rendername: string,  // This is the name/identifier to be shown to the user
    uniquename: string,  // A unqiue identifier for this list item (e.g. player uuid), this can match rendername
    meta: { [key: string]: string }  // Optional metadata to be rendered along-side the list item
}

// Define our specific "list items" - the schema for items in each of the lists we want to load. Each of these validates the given input, and then transforms it into a generic ListItem
const zMinecraftDatetime = z.preprocess(val => {
    // Exit early if invalid format
    if (typeof val !== "string") return val;
    if (val.length != 25) return val;
    // Convert mc datetime into iso datetime
    let sVal: string = val;  // Explicitly mark as string so typescript gets off my bottom
    sVal = sVal.replace(" ", "T").replace(" ", "") ;
    sVal = sVal.slice(0, 22) + ":" + sVal.slice(22);
    return sVal;
}, z.iso.datetime({ offset: true }));
const zExpiresOn = (z.literal(["forever"]).transform(() => "None")).or(zMinecraftDatetime);  // Map forever to "None"
const WhitelistListItem = z.object({
    name: z.string(),
    uuid: z.uuid()
}).transform(o => ({
    rendername: o.name,
    uniquename: o.uuid,
    meta: {}
}));
const OperatorListItem = WhitelistListItem;  // These are the same
const BannedPlayerListItem = z.object({
    name: z.string(),  // Name of player who was banned
    uuid: z.uuid(),  // UUID of player who was banned
    source: z.string(),  // Name of player who added it
    created: zMinecraftDatetime,
    expires: zExpiresOn,
    reason: z.string().default("Unknown")
}).transform(o => ({
    rendername: o.name,
    uniquename: o.uuid,
    meta: { "created-by": o.source, "created-on": o.created, "expires-on": o.expires, "reason": o.reason }
}));
const BannedIpListItem = z.object({
    ip: z.ipv4(),  // IP of player who was banned
    source: z.string(),  // Name of player who added it
    created: zMinecraftDatetime,
    expires: zExpiresOn,
    reason: z.string().default("Unknown")
}).transform(o => ({
    rendername: o.ip,
    uniquename: o.ip,
    meta: { "created-by": o.source, "created-on": o.created, "expires-on": o.expires, "reason": o.reason }
}));

// Define the lists that can be loaded
export type List = {
    filename: string,  // The name of the actual file (e.g. "whitelist.json")
    itemSchema: z.ZodType<ListItem>  // The scheme for a single item (not the whole list)
}
export const WHITELIST_LIST = { filename: "whitelist.json", itemSchema: WhitelistListItem };
export const BANNEDPLAYER_LIST = { filename: "banned-players.json", itemSchema: BannedPlayerListItem };
export const BANNEDIP_LIST = { filename: "banned-ips.json", itemSchema: BannedIpListItem };
export const OPERATOR_LIST = { filename: "ops.json", itemSchema: OperatorListItem };

/**
 * Load the account list from the given filename.
 * Returns null if no file exists.
 *
 * @param filename - The name of the file to load (e.g. ops.json), this should be in the root directory of the minecraft server.
 * @param itemSchema  - The schema of a single list item.
 */
export async function loadListItems(list: List) {
    await requirePermission("panel", "viewer");

    const path_ = path.join(C().LIST_FOLDER, list.filename);

    if (!existsSync(path_)) return null;

    const file = await fs.readFile(path_, "utf-8");
    const data = z.array(list.itemSchema).parse(JSON.parse(file));  // Parse an array of accounts. This will ignore any extra properties
    return data;
}


// Minecrtaft logs ------------------------------------------------------------------------------------

/**
 * Lists the minecraft logs which are available to view.
 * @returns A string[] of the file names formatted (these will include file-extensions), or null if the log folder doesn't exist.
 */
export async function listLogs(): Promise<string[] | null> {
    await requirePermission("panel", "viewer");
    return existsSync(C().MC_LOG_FOLDER) ? await fs.readdir(C().MC_LOG_FOLDER) : null;
}

/**
 * Loads the content of a log file and returns it to the user.
 * @param logName - The name of the log file, this will be sanitized. If the log does not exist then undefined is returned.
 * @returns The content of the file.
 */
export async function loadLogContent(logName: string): Promise<string | undefined> {
    await requirePermission("panel", "viewer");

    // Sanitize path
    if (logName.includes("..") || logName.includes("/") || logName.includes("\\")) {
        console.log("log-file-name failed sanitization:", logName);
        return undefined;
    }

    // Check file exists
    const full_path = path.join(C().MC_LOG_FOLDER, logName);
    if (!existsSync(full_path)) return undefined;

    // Load the file
    let content;
    if (logName.endsWith(".gz")) {  // Decompress
        content = zlib.gunzipSync(await fs.readFile(full_path)).toString();
    } else {  // Assume it is plain-text
        content = await fs.readFile(full_path, "utf-8");
    }

    return content;
}

// Monitor data ----------------------------------------------------------------------------------
// Define schema for a record:
const zNatural = z.number().nonnegative().multipleOf(1);  // 0, 1, ...
const zArbCpu = z.strictObject({
    total: zNatural,  // Arbitrary units, delta since last record
    busy: zNatural
});
type arbCpu = z.infer<typeof zArbCpu>;
const zNetIO = z.strictObject({
    sent: zNatural,  // Bytes, delta since last record
    recieved: zNatural
});
type netIO = z.infer<typeof zNetIO>;
const zDiskIO = z.strictObject({
    read: zNatural,  // Bytes, delta since last record
    written: zNatural
});
type diskIO = z.infer<typeof zDiskIO>;
// Memory can be recorded as a snapshot ({used, total}) or, for aggregate-mode rules, {min, mean, max, total} over the
// retention window - which shape a given field/record holds is inferred purely from this structure, see "Snapshot vs. aggregate modes"
const zMemSnapshot = z.strictObject({
    used: zNatural,  // Kilobytes
    total: zNatural  // Kilobytes
});
const zMemAggregate = z.strictObject({
    min: zNatural,  // Kilobytes
    mean: z.number().nonnegative(),  // Kilobytes, time-weighted average
    max: zNatural,  // Kilobytes
    total: zNatural  // Kilobytes, most recent reading (assumed constant, not aggregated)
});
const zMem = z.union([zMemSnapshot, zMemAggregate]);
export type MemSnapshot = z.infer<typeof zMemSnapshot>;
export type MemAggregate = z.infer<typeof zMemAggregate>;
export type Mem = z.infer<typeof zMem>;
// Same snapshot/aggregate duality as zMem, but tps has no "total" and its snapshot form is a bare number
const zTpsAggregate = z.strictObject({
    min: z.number().nonnegative(),
    mean: z.number().nonnegative(),
    max: z.number().nonnegative()
});
export type TpsAggregate = z.infer<typeof zTpsAggregate>;
const zTps = z.union([z.number().nonnegative(), zTpsAggregate]);
export type Tps = z.infer<typeof zTps>;
// Same snapshot/aggregate duality as zMem, but playerCount has no "total" - min/max are whole counts, mean is time-weighted
const zPlayerCountAggregate = z.strictObject({
    min: zNatural,
    mean: z.number().nonnegative(),
    max: zNatural
});
export type PlayerCountAggregate = z.infer<typeof zPlayerCountAggregate>;
const zPlayerCount = z.union([zNatural, zPlayerCountAggregate]);
export type PlayerCount = z.infer<typeof zPlayerCount>;
const zMinecraft = z.strictObject({
    tps: zTps.nullable(),  // Ticks per second - rolling average capped at 20, or {min, mean, max} over the retention window
    mem: zMem.nullable(),  // Heap usage, in kilobytes
    playerCount: zPlayerCount.nullable().optional()  // Number of players online, or {min, mean, max} - optional since absent in records predating this field
});
const zCoercedMap = <T extends z.ZodTypeAny> (zValue: T) => z.record(z.string().nonempty(), zValue).transform(obj => new Map(Object.entries(obj)));
const zCgroup = z.strictObject({
    cpu: zNatural.nullable(),  // Microseconds, delta since last record, sum of ms on each core
    mem: zMem.nullable(),
    disk_io: zDiskIO.nullable()
});
const MonitorRecord = z.strictObject({
    actualPeriod: z.number().nonnegative().nullable(),  // Seconds, real time elapsed since this rule's previous record - null for that rule's first record ever
    migration_history: z.array(z.number().int()).optional(),  // IDs of migration scripts (see utils/migrations) applied to this record, in order - not written by monitor.py itself
    sys_cpu: z.strictObject({
        agg: zArbCpu,
        ind: zCoercedMap(zArbCpu.nullable())  // null if this key has no previous record to diff against (see documentation)
    }).nullable(),
    sys_mem: zMem.nullable(),
    sys_net_io: z.strictObject({
        agg: zNetIO,  // Does not include loopback
        ind: zCoercedMap(zNetIO.nullable())  // null if this key has no previous record to diff against (see documentation)
    }).nullable(),
    sys_disk_io: z.strictObject({
        agg: zDiskIO,
        ind: zCoercedMap(zDiskIO.nullable())  // null if this key has no previous record to diff against (see documentation)
    }).nullable(),
    minecraft: zMinecraft.nullable().default(null),  // Absent entirely in records predating this field
    cgroups: zCoercedMap(zCgroup)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
}).transform(({ migration_history, ...rest }) => rest);  // Strip migration_history from the parsed type - it's bookkeeping for utils/migrations, g_web has no use for it
export type MonitorRecord = z.infer<typeof MonitorRecord>;

export type MonitorOption = { interval: number, number?: number | undefined }
/**
 * Lists all the types of monitor records that it can find.
 */
export async function listMonitorOptions(): Promise<MonitorOption[]> {
    await requirePermission("panel", "viewer");

    return C().MONITOR_RETENTION_RULES.map(([interval, maxCount]) => ({ interval, number: maxCount ?? undefined }));
}

/**
 * Load all the records for the given monitor retainment rule.
 * Returns null if no subfolder exists yet for the given rule (e.g. monitor.py hasn't created it yet).
 * Otherwise returns a sorted array of objects with a timestamp (in seconds) and graphdata at that point. The oldest record is first and has a negative value. The newest record is last and has a positive value.
 */
export async function loadMonitorRecords(interval: number, number?: number | undefined) {
    await requirePermission("panel", "viewer");

    const monitorName = (number === undefined) ? `${interval}` : `${interval}_${number}`;

    // Load data
    const subfolder = path.join(C().MONITOR_FOLDER, monitorName);
    if (!existsSync(subfolder)) return null;
    const recordNames = (await fs.readdir(subfolder))
        .filter(name => /^\d+\.json$/.test(name));  // Only load files of the correct format
    const records = await Promise.all(recordNames.map(async record => ({
        time: parseInt(record),  // This will ignore the .json
        data: MonitorRecord.parse(JSON.parse(await fs.readFile(path.join(subfolder, record), "utf-8")), { 
            error: () => { console.error(`Parse error in ${record}`); return undefined }  // Say where the error occured, then pass back to zod's error handler
        })
    })));
    records.sort((a, b) => a.time - b.time);  // Sort based off time
    const latestTime = Math.max(...records.map(record => record.time));  // The time of the newest record, unused below when there are no records

    // Data transformation functions
    const arbCpuToUsage = (current: arbCpu | null) => nu(current) ? null : current!.busy / current!.total;
    const netIOToSpeed = (current: netIO | null, dt: number | null) => (nu(current) || nu(dt)) ? null : ({
        sent: current!.sent / dt!,  // TODO: Do we actually want this to be a rate rather than a count?
        recieved: current!.recieved / dt!
    });
    const diskIOToSpeed = (current: diskIO | null, dt: number | null) => (nu(current) || nu(dt)) ? null : ({
        written: current!.written / dt!,
        read: current!.read / dt!
    });
    // Convert a map field in the record by applying a function to each value. If current doesn't contain a given key then the value is taken as null
    function convMap<K, V, Z>(keys: Set<K>, current: Map<K, V>, conv: (c: V | null) => Z): Map<K, Z> {
        return new Map([...keys].map(k => [k, conv(current.get(k) ?? null)]));
    }
    // Convert a record field that has both aggregate and independent values. This is safe if current is null. The keys given are for the independent part.
    // ind's values are typed V | null (unlike agg's, which is always V) since an individual key can be missing its own baseline - see documentation
    type cnaiType <K, V> =  { agg: V, ind: Map<K, V | null> } | null;
    function convNullAggInd<K, V, Z>(keys: Set<K>, current: cnaiType<K, V>, conv: (c: V | null) => Z): { agg: Z, ind: Map<K, Z> } | null {
        if (current === null) return null;
        return {
            agg: conv(current.agg),
            ind: convMap<K, V | null, Z>(keys, current.ind, conv)
        };
    }

    // Returns true if x is null or undefined
    const nu = (x: unknown) => x === null || x === undefined;

    // For dictionary fields, get all used keys
    const cpunoKeys = new Set(records.flatMap(r => [...(r.data.sys_cpu?.ind.keys() ?? [])]));
    const netioKeys = new Set(records.flatMap(r => [...(r.data.sys_net_io?.ind.keys() ?? [])]));
    const diskioKeys = new Set(records.flatMap(r => [...(r.data.sys_disk_io?.ind.keys() ?? [])]));
    const cgroupKeys = new Set(records.flatMap(r => [...r.data.cgroups.keys()]));

    // Transform data
    const graphData = records.map(({ time, data: current }) => {
        const dt = current.actualPeriod;
        return {
            time: time - latestTime,  // Normalise times
            sys_cpu: convNullAggInd(cpunoKeys, current.sys_cpu, arbCpuToUsage),  // Percentage utilisation
            sys_mem: current.sys_mem,  // In Kilobytes
            minecraft: { tps: current.minecraft?.tps ?? null, mem: current.minecraft?.mem ?? null, playerCount: current.minecraft?.playerCount ?? null },  // TPS, heap usage in kilobytes, and player count
            sys_net_io: convNullAggInd(netioKeys, current.sys_net_io, (c) => netIOToSpeed(c, dt)),  // Bytes per second
            sys_disk_io: convNullAggInd(diskioKeys, current.sys_disk_io, (c) => diskIOToSpeed(c, dt)),  // Bytes per second
            cgroups: convMap(cgroupKeys, current.cgroups, (c) => ({
                cpu: (nu(c?.cpu) || nu(current.sys_cpu) || nu(dt)) ? null : c!.cpu! / dt! / 1_000_000 / current.sys_cpu!.ind.size,  // Percentage utilisation
                mem: c?.mem ?? null,  // In kilobytes
                disk_io: nu(c?.disk_io) ? null : diskIOToSpeed(c!.disk_io!, dt)
            }))!
        };
    });

    return {
        timestamp: records.length > 0 ? latestTime * 1000 : undefined,  // Timestamp is in ms. Records.length > 0 iff latestTime is finite
        timed: graphData
    };
}

// Live data ---------------------------------------------------------------------
// These aren't part of the historical records above - they always reflect the current value, see "Live Data" in the documentation
const RE_DISK_USAGE_HEADERS = /^\s*Filesystem\s+Mounted on\s+1B-blocks\s+Avail\s*$/m;
const RE_DISK_USAGE = /^\s*(?<filesystem>\S+)\s+(?<mountpoint>\S+)\s+(?<total>\d+)\s+(?<available>\d+)\s*$/gm;
export type DiskUsage = Map<string, { filesystem: string, total: number, used: number }>;
/**
 * Gets the current disk usage for every mounted filesystem, by shelling out to `df`.
 * This is queried live rather than through monitor.py, as it needs no special permissions and would otherwise show data up to a whole retention interval stale.
 */
export async function getDiskUsage(): Promise<DiskUsage> {
    await requirePermission("panel", "viewer");

    const execFileAsync = promisify(execFile);
    const { stdout } = await execFileAsync("/usr/bin/df", ["-B1", "--output=source,target,size,avail"]);
    if (!RE_DISK_USAGE_HEADERS.test(stdout)) throw new Error(`Header of df output is incorrect: \n${stdout}`);

    const usage: DiskUsage = new Map();
    for (const match of stdout.matchAll(RE_DISK_USAGE)) {
        const { filesystem, mountpoint, total, available } = match.groups!;
        usage.set(mountpoint, { filesystem, total: Number(total), used: Number(total) - Number(available) });
    }
    return usage;
}

const LiveCgroupProcs = z.strictObject({
    timestamp: zNatural,  // Unix epoch seconds, when this file was generated
    cgroups: zCoercedMap(zCoercedMap(z.string()).nullable())  // [cgroup]: {[pid]: command} | null, null entries are cgroups that failed to be read
});
/**
 * Loads the current processes for each tracked cgroup, from the live_cgroup_procs.json file monitor.py publishes.
 * This isn't queried directly by g_web, as it needs read access to cgroup and /proc files owned by other services' users.
 * Returns null if the file doesn't exist yet (e.g. monitor.py hasn't published its first live snapshot). An individual
 * cgroup entry being null (rather than the whole map) means only that cgroup's procs failed to be read.
 */
export async function loadLiveCgroupProcs(): Promise<Map<string, Map<string, string> | null> | null> {
    await requirePermission("panel", "viewer");

    const filePath = path.join(C().MONITOR_FOLDER, "live_cgroup_procs.json");
    if (!existsSync(filePath)) return null;

    const raw = await fs.readFile(filePath, "utf-8");
    return LiveCgroupProcs.parse(JSON.parse(raw)).cgroups;
}

// SystemD unit control ---------------------------------------------------------
export const UNIT_STATUS_VALUES = ["active", "inactive", "activating", "deactivating", "failed", "reloading"] as const;
export type UnitStatus = typeof UNIT_STATUS_VALUES[number];
/**
 * Gets the status of the given unit.
 * I believe this returns "inactive" for unkown units.
 * This does not sanitize inputs, so no user-supplied data should come here.
 */
export async function getUnitStatus(name: string, type: UnitType): Promise<UnitStatus> {
    await requirePermission("panel", "viewer");

    const execFileAsync = promisify(execFile);
    const { stdout } = await execFileAsync("systemctl", ["show", `${name}.${type}`, "-p", "ActiveState"]);  // If this fails then an error should be thrown
    const match = stdout.match(/^\s*ActiveState=((?:active)|(?:inactive)|(?:activating)|(?:deactivating)|(?:failed)|(?:reloading))\s*$/);
    if (!match) throw new Error("Failed to match stdout for unit status - ") + stdout;
    return match[1] as UnitStatus;
}
/**
 * This does not sanitize name or type, so data should be checked.
 */
export async function unitAction(name: string, type: UnitType, action: "start"|"stop"|"restart") {
    await requirePermission("panel", "admin", true);

    if (action !== "start" && action !== "stop" && action !== "restart") throw new Error("Invalid action");

    // We want to wait for the process to finish
    await new Promise((resolve, reject) => {
        const proc = spawn(
            "/usr/bin/sudo",
            ["-n", "/usr/bin/systemctl", action, `${name}.${type}`]  // -n means it won't ever prompt for a password. Passwordless sudo should be allowed for this command
        );

        proc.stdout.on("data", (data) => console.log(`SYSTEMCTL-STDOUT: ${data}`));
        proc.stderr.on("data", (data) => console.error(`SYSTEMCTL-STDERR: ${data}`));
        proc.on("error", reject);
        proc.on("close", (code) => {
            console.log(`Systemctl exited with code ${code}`);
            if (code === 0) {
                resolve(undefined);
            } else {
                reject(new Error(`Systemctl exited with code ${code}`));
            }
        });
    });
}
