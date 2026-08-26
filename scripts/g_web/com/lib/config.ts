/**
 * This file loads the config values from the environment.
 * We need to load them during runtime as nextjs is stupid and messes up otherwise.
 */

// TODO: Don't load all of these all the time?

import zod from "zod";
import fs from "fs";
import path from "path";

let cached: ReturnType<typeof generate> | null = null;

// Resolves a value read out of a config file - absolute values are used as-is, relative values resolve against G_DEMMAIN_ROOT
function resolvePath(value: string): string {
    return path.isAbsolute(value) ? value : path.join(process.env.G_DEMMAIN_ROOT!, value);
}

// Reads and JSON-parses a config file located at {G_DEMMAIN_ROOT}/config/{G_DEMMAIN_MODE}/{relpath}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readConfigFile(relpath: string): any {
    const fullPath = path.join(process.env.G_DEMMAIN_ROOT!, "config", process.env.G_DEMMAIN_MODE!, relpath);
    if (!fs.existsSync(fullPath)) throw new Error(`Config file does not exist: ${fullPath}`);
    return JSON.parse(fs.readFileSync(fullPath, "utf-8"));
}

// The js representation of a systemd unit - lives here (rather than in the panel code that
// consumes it) since it doubles as the shape of g_web/config.json's trackedUnits
export const zUnitType = zod.enum(["service", "timer", "target"]);
export type UnitType = zod.infer<typeof zUnitType>;
const zUnit = zod.object({
    name: zod.string().trim().nonempty(),  // E.g. "g_mc"
    type: zUnitType,
    controllable: zod.boolean(),  // Should the user be able to start or stop this from the dashboard?
    expectActive: zod.boolean(),  // Is normal behavior that this is running? E.g. g_mc.service being stopped is abnormal, but g_nightly_restart.service we don't expect to be running all the time
    impactsPanel: zod.boolean()  // True if changes to this unit may affect the user's ability to continue using the panel, or may be irreversible without SSH access
});
export type Unit = zod.infer<typeof zUnit>;

// A single [interval, maxCount, mode] retention rule from g_monitor/config.json - see doc/Monitoring.md "Retention"
const zRetentionRule = zod.tuple([
    zod.number().int().positive(),
    zod.number().int().positive().nullable(),
    zod.enum(["snapshot", "aggregate"])
]);

const generate = () => {
    const zTNe = zod.string().trim().nonempty();  // Trimmed non-empty string
    const zJsonPort = zod.number().int().min(0).max(65535);

    const gWeb = readConfigFile("g_web/config.json");
    const gMcMonitor = readConfigFile("g_mc_monitor/config.json");
    const gMonitor = readConfigFile("g_monitor/config.json");

    const MCCWSS_PORT = zJsonPort.parse(gWeb.mccwssPort);
    // The bit the browser appends after the hostname to reach mcc - a path (prod, proxied by Caddy) or a literal ":<port>" (dev, connected to directly)
    // We do it like this as we can't use a path in dev (we don't have this proxy layer), but in prod we don't want to open any more ports. The port - if given - should match MCCWSS_PORT
    const MCCWSS_TAIL = zTNe.parse(gWeb.mccwssTail);
    const SESSION_PASSWORD = zTNe.min(32).parse(process.env.SESSION_PASSWORD);

    const LIST_FOLDER = resolvePath(zTNe.parse(gWeb.listFolder));  // This folder contains whitelist.json and ...
    const MC_LOG_FOLDER = resolvePath(zTNe.parse(gWeb.mcLogFolder));
    const MONITOR_FOLDER = resolvePath(zTNe.parse(gWeb.monitorFolder));
    const MINECRAFT_CACHE_FILE = resolvePath(zTNe.parse(gWeb.minecraftCacheFile));

    const MINECRAFT_MONITOR_CONSOLE_PORT = zJsonPort.parse(gMcMonitor.consolePort);
    const MINECRAFT_MONITOR_CONSOLE_HOST = zTNe.parse(gMcMonitor.socketBindAddress);
    const MINECRAFT_MONITOR_CONSOLE_AUTH_KEY = zTNe.parse(process.env.MINECRAFT_MONITOR_CONSOLE_AUTH_KEY);

    const G_WEB_DATABASE_USER = zTNe.parse(process.env.G_WEB_DATABASE_USER);
    const G_WEB_DATABASE_PASSWORD = zTNe.parse(process.env.G_WEB_DATABASE_PASSWORD);
    const G_WEB_DATABASE_HOST = zTNe.parse(process.env.G_WEB_DATABASE_HOST);
    const G_WEB_DATABASE_PORT = zJsonPort.parse(gWeb.gWebDatabasePort);

    const TRACKED_UNITS = zod.array(zUnit).parse(gWeb.trackedUnits);

    const MONITOR_RETENTION_RULES = zod.array(zRetentionRule).parse(gMonitor.retention);

    return {
        MCCWSS_PORT, MCCWSS_TAIL, SESSION_PASSWORD, LIST_FOLDER, MC_LOG_FOLDER, MONITOR_FOLDER, MINECRAFT_CACHE_FILE, MINECRAFT_MONITOR_CONSOLE_PORT, MINECRAFT_MONITOR_CONSOLE_HOST, MINECRAFT_MONITOR_CONSOLE_AUTH_KEY, G_WEB_DATABASE_USER, G_WEB_DATABASE_PASSWORD, G_WEB_DATABASE_HOST, G_WEB_DATABASE_PORT, TRACKED_UNITS, MONITOR_RETENTION_RULES
    };
};


/**
 * Loads/caches config values (from JSON and environ).
 * This needs to be called at use-time - not module-level - as these options may not be available at build time, and next runs module level code at build time.
 */
export function C() {
    cached = cached ?? generate();
    return cached;
}

export default C;
