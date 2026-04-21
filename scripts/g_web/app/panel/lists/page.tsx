/**
 * This file provides the UI for viewing and updating the various player-lists for the minecraft server (e.g. whitelist.json).
 */

import fs from "fs/promises";
import ItemRow from "./ItemRow";
import AddItemField from "./AddItemField";
import * as z from "zod";
import PanelPageSection from "../ui/PanelPageSection";

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

// Define the lists (e.g. whitelist or banned-players) that we want to render
export type List = {
    filename: string,  // Name of the file (e.g. ops.json). This should be in the root folder of the minecraft server
    rendername: string,  // The name of this list that is displayed to the user
    renderPlayerheads: boolean,  // Should we render playerheads, aka does ListItem.uniquename correspond to a minecraft account
    lang: {
        remove: string,  // The list specific term for removing an item
        addButton: string,  // The list specific text to put on the add new item button
        addPrompt: string  // The example text to put in the text box

    }
}
type ListAndSchema = {
    list: List,
    itemSchema: z.ZodType<ListItem>,  // The schema for a single item (not the whole list)
}
const LISTS_AND_SCHEMAS: ListAndSchema[] = [
    { list: { filename: "ops.json", rendername: "Operators", renderPlayerheads: true, lang: { remove: "de-op", addButton: "Add operator", addPrompt: "GamerGirl67..." } }, itemSchema: OperatorListItem }, 
    { list: { filename: "banned-players.json", rendername: "Banned Players", renderPlayerheads: true, lang: { remove: "un-ban", addButton: "Ban player", addPrompt: "OllieBlitzz..." } }, itemSchema: BannedPlayerListItem },
    { list: { filename: "banned-ips.json", rendername: "Banned IPs", renderPlayerheads: false, lang: { remove: "un-ban", addButton: "Ban IP", addPrompt: "127.0.0.1" } }, itemSchema: BannedIpListItem },
    { list: { filename: "whitelist.json", rendername: "Whitelist", renderPlayerheads: true, lang: { remove: "un-whitelist", addButton: "Add to whitelist", addPrompt: "KingDave..." } }, itemSchema: WhitelistListItem }
];


export default function Page() {
    return (
        <>
            {
                LISTS_AND_SCHEMAS.map(async ({ list, itemSchema }) => (
                    <PanelPageSection title={list.rendername} key={list.filename} >
                        <div className="space-y-1">
                            <div> 
                                {(await loadAccounts(list.filename, itemSchema)).map(item => (
                                    <ItemRow key={item.uniquename} item={item} list={list} />
                                ))}
                            </div>
                            <AddItemField list={list} />
                        </div>
                    </PanelPageSection>
                ))
            }
        </>
    );
}


/**
 * Load the account list from the given filename.
 *
 * @param filename - The name of the file to load (e.g. ops.json), this should be in the root directory of the minecraft server.
 * @param itemSchema  - The schema of a single list item.
 */
async function loadAccounts(filename: string, itemSchema: z.ZodType<ListItem>) {
    const file = await fs.readFile(filename, "utf-8");  // TODO: Find the correct file for this
    const data = z.array(itemSchema).parse(JSON.parse(file));  // Parse an array of accounts. This will ignore any extra properties
    return data;
}
