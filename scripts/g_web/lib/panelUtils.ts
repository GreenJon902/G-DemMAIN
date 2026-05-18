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

/**
 * Returns an array of the players in the given list.
 */
export async function queryList(list: ListType) {
    // TODO: Cache the connection
    const connection = await WebSocketConnection.connect(`wss://localhost:${C().MINECRAFT_MS_PORT}`, C().MINECRAFT_MS_SECRET);
    const server = new MinecraftServer(connection);

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
}
