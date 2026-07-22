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


const generate = () => {
    const zTNe = zod.string().trim().nonempty();  // Trimmed non-empty string
    const zJsonPort = zod.number().int().min(0).max(65535);

    const gWeb = readConfigFile("g_web/config.json");
    const gMcMonitor = readConfigFile("g_mc_monitor/config.json");

    const MCCWSS_PORT = zJsonPort.parse(gWeb.mccwssPort);
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

    return {
        MCCWSS_PORT, SESSION_PASSWORD, LIST_FOLDER, MC_LOG_FOLDER, MONITOR_FOLDER, MINECRAFT_CACHE_FILE, MINECRAFT_MONITOR_CONSOLE_PORT, MINECRAFT_MONITOR_CONSOLE_HOST, MINECRAFT_MONITOR_CONSOLE_AUTH_KEY, G_WEB_DATABASE_USER, G_WEB_DATABASE_PASSWORD, G_WEB_DATABASE_HOST, G_WEB_DATABASE_PORT
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
