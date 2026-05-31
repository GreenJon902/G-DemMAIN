/**
 * This file provides the utilities for the panel pages.
 * All exported functions should check for authentication.
 */

import fs from "fs/promises";
import * as path from "node:path";
import * as z from "zod";
import { C } from "./environ";
import { optimisticRequireUser } from "./auth";
import { existsSync } from "fs";
import * as zlib from "zlib";

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
 *
 * @param filename - The name of the file to load (e.g. ops.json), this should be in the root directory of the minecraft server.
 * @param itemSchema  - The schema of a single list item.
 */
export async function loadListItems(list: List) {
    optimisticRequireUser("panel");

    const file = await fs.readFile(path.join(C().LIST_FOLDER, list.filename), "utf-8");  
    const data = z.array(list.itemSchema).parse(JSON.parse(file));  // Parse an array of accounts. This will ignore any extra properties
    return data;
}


// Minecrtaft logs ------------------------------------------------------------------------------------

/**
 * Lists the minecraft logs which are available to view.
 * @returns A string[] of the file names formatted. These will include file-extensions.
 */
export async function listLogs() {
    optimisticRequireUser("panel");
    return await fs.readdir(C().MC_LOG_FOLDER);
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

