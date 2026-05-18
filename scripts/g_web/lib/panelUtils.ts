import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";
import * as zlib from "zlib";
import C from "@/lib/environ";
import { optimisticRequireUser } from "./auth";
import { MinecraftServer, WebSocketConnection } from "mc-server-management";

// --- Logs ---------------------------------------------------------------------------

/**
 * Lists the minecraft logs which are available to view.
 * @returns A string[] of the file names formatted. These will include file-extensions.
 */
export async function listLogs() {
    optimisticRequireUser("panel");

    return await fs.readdir(C().MINECRAFT_LOG_PATH);
}

/**
 * Loads the content of a log file and returns it to the user.
 * @param logName - The name of the log file, this will be sanitized. If the log does not exist then undefined is returned.
 * @returns The content of the file.
 */
export async function loadLogContent(logName: string): Promise<string | undefined> {
    optimisticRequireUser("panel");
    
    // Sanitize path
    if (logName.includes("..") || logName.includes("/") || logName.includes("\\")) {
        console.log("log-file-name failed sanitization:", logName);
        return undefined;
    }

    // Check file exists
    const full_path = path.join(C().MINECRAFT_LOG_PATH, logName);
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

// --- Lists ---------------------------------------------------------------------------

export type ListType = "whitelist" | "bans" | "ipbans" | "operators";

export class MCMSError extends Error { constructor() { super("Failed to connect to the minecraft management server"); } }
let _mcms_connection: MinecraftServer | null = null;
/**
 * Returns a wrapper of the minecraft server's management server.
 * This will try to reuse the same connection as previous calls.
 * If force is given, then a new connection will be created.
 * Note that this does not check if the current cached connection is still open.
 * @param force - Should a new connection be made regardless of the old one.
 */
async function getMCMS(force: boolean=false) {
    optimisticRequireUser("panel"); // TODO: This probably shouldn't be optimistic

    if (_mcms_connection === null || force) {
        const url = `ws://localhost:${C().MINECRAFT_MS_PORT}`;
        console.log(`Attempting to establish new connection to MCMS at ${url}`);
        const connection = await WebSocketConnection.connect(url, C().MINECRAFT_MS_SECRET);
        _mcms_connection = new MinecraftServer(connection);
    }

    return _mcms_connection;
}

/**
 * Runs the given function with the current connection (if it exists), and if it fails attempts it once more with a forced new connection.
 * Any errors thrown will be given to the console, and then MCMSError will be thrown instead.
 * @throws MCMSError
 */
async function mcmsRetryFunctionCallWrapper<T>(func: (server: MinecraftServer) => T) {
    try {
        return await func(await getMCMS());
    } catch (e) {
        console.log(`Got ${e} while attempting to make an mcms call. Retrying with a new connection...`);
        try {
            return await func(await getMCMS(true));  // Run with a forced new connection
        } catch(e2) {
            console.error(e2);
            throw new MCMSError();
        }
    }
}

/**
 * Returns an array of the players in the given list.
 * @throws MCMSError
 */
export async function queryList(list: ListType) {
    optimisticRequireUser("panel"); // TODO: This probably shouldn't be optimistic

    // TODO: Cache this result for an amount of time (as nextjs seems trigger happy sometimes).
    return await mcmsRetryFunctionCallWrapper(async server => {
        // Return the contents of the appropriate list
        if (list === "whitelist") {
            const allowlist = await server.allowlist().get();
            return allowlist.map(player => ({
                rendername: player.name,
                uniquename: player.id,
                meta: {}
            }));
        } else if (list === "operators") {
            const operators = await server.operatorList().get();
            return operators.map(operator => ({
                rendername: operator.player.name,
                uniquename: operator.player.id,
                meta: {}
            }));
        } else if (list === "bans") {
            const banlist = await server.banList().get();
            return banlist.map(ban => ({
                rendername: ban.player.name,
                uniquename: ban.player.id,
                meta: { "created-by": ban.source, "expires-on": ban.expires, "reason": ban.reason }
            }));
        } else if (list === "ipbans") {
            const banlist = await server.ipBanList().get();
            return banlist.map(ban => ({
                rendername: ban.ip,
                uniquename: ban.ip,
                meta: { "created-by": ban.source, "expires-on": ban.expires, "reason": ban.reason }
            }));
        } else {
            throw "Unknown list " + list;
        }
    });
}

// TODO: DOcument this
export async function addToList(list: ListType, name: string) {
    optimisticRequireUser("panel"); // TODO: This probably shouldn't be optimistic

    await mcmsRetryFunctionCallWrapper(async server => {
        if (list === "whitelist") {
            server.allowlist().add(name);
        } else if (list === "bans") {
            server.banList().add(name);
        } else if (list === "ipbans") {
            server.ipBanList().add(name);
        } else if (list === "operators") {
            server.operatorList().add(name);
        } else {
            throw "Unknown list " + list;
        }
    });
}

