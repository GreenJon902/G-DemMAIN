/**
 * This file provides the utilities for the panel pages.
 * All exported functions should check for authentication.
 */

import "server-only";
import fs from "fs/promises";
import * as path from "node:path";
import * as z from "zod";
import { C } from "@g/com/lib/environ";
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
 * @returns A string[] of the file names formatted. These will include file-extensions.
 */
export async function listLogs() {
    await requirePermission("panel", "viewer");
    return await fs.readdir(C().MC_LOG_FOLDER);
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

/**
 * Gets the last n lines from latest.log.
 * If latest.log has less lines then extra lines will be padded at the top.
 * If latest.log does not exist then an array of empty strings will be returned.
 */
export async function tailLatest(n: number) {
    await requirePermission("panel", "viewer");

    // Check file exists
    const full_path = path.join(C().MC_LOG_FOLDER, "latest.log");
    if (!existsSync(full_path)) return { contents: Array(n).fill(""), timestamp: Date.now() };

    // The file may be quite large, so scan from the back to find all the newlines
    // We will first load the file in 1024 byte chunks from the end until we have at least n newlines
    const stats = await fs.stat(full_path);  // Data about the file we're reading
    const file = await fs.open(full_path);  // The file we're reading
    const buffer = Buffer.alloc(1024);  // The buffer we will read from the file into
    const contents = [];  // The loaded strings
    let newlinesFound = 0;  // The count of newlines found so far

    let start = stats.size;  // Index of first byte to read

    while (start > 0 && newlinesFound < n) {
        start -= 1024;
        const length = 1024 + Math.min(0, start);  // If start < 0 then read less bytes
        // Load data
        const { bytesRead } = await file.read(buffer, 0, length, Math.max(0, start));
        const str = buffer.subarray(0, bytesRead).toString("utf-8");
        // Save loaded and count new newlines
        contents.unshift(str);  // Insert str at start of array
        newlinesFound += [0, ...Array.from(str).filter(x => x === "\n").map(() => 1)].reduce((a, b) => a + b);
    }

    file.close();

    // Join strings then split into lines
    const lines = contents.join("").split("\n");
    const cropped_lines = lines.slice(-n);  // Get last n lines
    if (cropped_lines.length > 0 && cropped_lines[cropped_lines.length - 1] === "") cropped_lines.pop();  // Remove trailing newline
    const padded_lines = [...Array(n - cropped_lines.length).fill(""), ...cropped_lines];

    // Return joined content
    return { contents: padded_lines };
}

// Monitor data ----------------------------------------------------------------------------------
// Define schema for a record:
const zNatural = z.number().nonnegative().multipleOf(1);  // 0, 1, ...
const zArbCpu = z.strictObject({
    total: zNatural,  // Arbitrary units, absolute
    busy: zNatural
});
type arbCpu = z.infer<typeof zArbCpu>;
const zNetIO = z.strictObject({
    sent: zNatural,  // Bytes, absolute
    recieved: zNatural
});
type netIO = z.infer<typeof zNetIO>;
const zDiskIO = z.strictObject({
    read: zNatural,  // Bytes, absolute
    written: zNatural
});
type diskIO = z.infer<typeof zDiskIO>;
const zMem = z.strictObject({
    used: zNatural,  // Kilobytes
    total: zNatural
});
const zCoercedMap = <T extends z.ZodTypeAny> (zValue: T) => z.record(z.string().nonempty(), zValue).transform(obj => new Map(Object.entries(obj)));
const MonitorRecord = z.strictObject({
    sys_cpu: z.strictObject({
        agg: zArbCpu,
        ind: zCoercedMap(zArbCpu)
    }).nullable(),
    sys_mem: zMem.nullable(),
    sys_net_io: z.strictObject({
        agg: zNetIO,  // Does not include loopback
        ind: zCoercedMap(zNetIO)
    }).nullable(),
    sys_disk_io: z.strictObject({
        agg: zDiskIO,
        ind: zCoercedMap(zDiskIO)
    }).nullable(),
    sys_disk_usage: zCoercedMap(z.strictObject({
        filesystem: z.string().nonempty(),
        total: zNatural,  // Bytes
        used: zNatural
    })).nullable(),
    cgroups: zCoercedMap(z.strictObject({
        cpu: zNatural.nullable(),  // Microseconds, absolute, sum of ms on each core
        mem: zMem.nullable(),
        disk_io: zDiskIO.nullable(),
        procs: zCoercedMap(z.string()).nullable()  // PID maps to terminal command that started it
    }))
});
export type MonitorRecord = z.infer<typeof MonitorRecord>;

const MONITOR_FOLDER = (process.env.NODE_ENV === "development" && process.env.G_MONITOR_FOLDER) || "/var/lib/g_monitor";

export type MonitorOption = { interval: number, number?: number | undefined }
/**
 * Lists all the types of monitor records that it can find.
 */
export async function listMonitorOptions(): Promise<MonitorOption[]> {
    await requirePermission("panel", "viewer");

    return (await fs.readdir(MONITOR_FOLDER))
        .map(name => name.match(/^(\d+)(?:_(\d+))?$/))  // Parse name
        .filter(match => match !== null)  // Remove non-matches
        .map(match => ({ interval: parseInt(match[1]), number: (match[2] !== undefined) ? parseInt(match[2]) : undefined }));  // Convert to a usable object
}

/**
 * Load all the records for the given monitor retainment rule.
 * This expects a subfolder to exist for the given rule.
 * Returns a sorted array of objects with a timestamp (in seconds) and graphdata at that point. The oldest record is first and has a negative value. The newest record is last and has a positive value.
 */
export async function loadMonitorRecords(interval: number, number?: number | undefined) {
    await requirePermission("panel", "viewer");

    const monitorName = (number === undefined) ? `${interval}` : `${interval}_${number}`;

    // Load data
    const subfolder = path.join(MONITOR_FOLDER, monitorName);
    const recordNames = (await fs.readdir(subfolder))
        .filter(name => /^\d+\.json$/.test(name));  // Only load files of the correct format
    const records = await Promise.all(recordNames.map(async record => ({
        time: parseInt(record),  // This will ignore the .json
        data: MonitorRecord.parse(JSON.parse(await fs.readFile(path.join(subfolder, record), "utf-8")))
    })));
    records.sort((a, b) => a.time - b.time);  // Sort based off time
    const latestTime = Math.max(...records.map(record => record.time));  // The time of the newest record

    // Data transformation functions
    //     We calculate the differences between records to get the actual rates. Hence we will have one less record after this
    const arbCpuToUsage = (last: arbCpu | null, current: arbCpu | null) => (nu(last) || nu(current)) ? null : (current!.busy - last!.busy) / (current!.total - last!.total);
    const netIOToSpeed = (last: netIO | null, current: netIO | null, dt: number) => (nu(last) || nu(current)) ? null : ({
        sent: (current!.sent - last!.sent) / dt,
        recieved: (current!.recieved - last!.recieved) / dt
    });
    const diskIOToSpeed = (last: diskIO | null, current: diskIO | null, dt: number) => (nu(last) || nu(current)) ? null : ({
        written: (current!.written - last!.written) / dt,
        read: (current!.read - last!.read) / dt
    });
    // Convert a map field in the records (using last and current) by applying a function to the pairs of values. If last or current doesn't contain a given key then the value is taken as null
    const convMap: <K, V, Z> (keys: Set<K>, last: Map<K, V>, current: Map<K, V>, conv: (l: V | null, c: V | null) => Z) => Map<K, Z> =
        (keys, last, current, conv) => new Map([...keys].map(k => [k, conv(last.get(k) ?? null, current.get(k) ?? null)]));
    // Convert a record field that has both aggregate and independent values. This is safe if last or current are null. The keys given are for the independent part
    type cnaiType <K, V> =  { agg: V, ind: Map<K, V> } | null;
    const convNullAggInd: <K, V, Z> (keys: Set<K>, last: cnaiType<K, V>, current: cnaiType<K, V>, conv: (l: V | null, c: V | null) => Z) => cnaiType<K, Z>  =
        (keys, last, current, conv) => (last === null || current === null) ? null :
            {
                agg: conv(last.agg, current.agg),
                ind: convMap(keys, last.ind, current.ind, conv)
            };

    // Returns true if x is null or undefined
    const nu = (x: unknown) => x === null || x === undefined;

    // For dictionary fields, get all used keys
    const cpunoKeys = new Set(records.flatMap(r => [...(r.data.sys_cpu?.ind.keys() ?? [])]));
    const netioKeys = new Set(records.flatMap(r => [...(r.data.sys_net_io?.ind.keys() ?? [])]));
    const diskioKeys = new Set(records.flatMap(r => [...(r.data.sys_disk_io?.ind.keys() ?? [])]));
    const cgroupKeys = new Set(records.flatMap(r => [...r.data.cgroups.keys()]));

    // Transform data
    const graphData = records.slice(1).map((_, j) => {
        const i = j+1;
        const last = records[i-1].data;
        const current = records[i].data;
        const dt = records[i].time - records[i-1].time;
        return {
            time: records[i].time - latestTime,  // Normalise times
            sys_cpu: convNullAggInd(cpunoKeys, last.sys_cpu, current.sys_cpu, arbCpuToUsage),  // Percentage utilisation
            sys_mem: current.sys_mem,  // In Kilobytes
            sys_net_io: convNullAggInd(netioKeys, last.sys_net_io, current.sys_net_io, (l, c) => netIOToSpeed(l, c, dt)),  // Bytes per second
            sys_disk_io: convNullAggInd(diskioKeys, last.sys_disk_io, current.sys_disk_io, (l, c) => diskIOToSpeed(l, c, dt)),  // Bytes per second
            cgroups: convMap(cgroupKeys, last.cgroups, current.cgroups, (l, c) => ({
                cpu: (nu(l?.cpu) || nu(c?.cpu) || nu(current.sys_cpu)) ? null : (c!.cpu! - l!.cpu!) / dt / 1_000_000 / current.sys_cpu!.ind.size,  // Percentage utilisation
                mem: c?.mem ?? null,  // In kilobytes
                disk_io: (nu(l?.disk_io) || nu(c?.disk_io)) ? null : diskIOToSpeed(l!.disk_io!, c!.disk_io!, dt)
            }))!
        };
    });

    // Extract data
    //     Some data isn't really time dependent
    // Disk usage:
    const diskUsage = records.at(-1)?.data.sys_disk_usage ?? null;  // Take newest found value
    // CGroup procs:
    const cgroupsProcs = (records.length > 0) ? new Map([...records.at(-1)!.data.cgroups.keys()].map(k => [k,
        records.at(-1)!.data.cgroups.get(k)?.procs ?? null
    ])) : (new Map() as Map<string, Map<string, string> | null>); // Default to empty map if no data

    return {
        timestamp: latestTime * 1000,  // Timestamp is in ms
        timed: graphData,
        disk_usage: diskUsage,
        cgroup_procs: cgroupsProcs
    };
}

// SystemD unit control ---------------------------------------------------------
export type UnitType = "service" | "timer" | "target" ;
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
            "sudo",
            ["-n", "systemctl", action, `${name}.${type}`]  // -n means it won't ever prompt for a password. Passwordless sudo should be allowed for this command
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
