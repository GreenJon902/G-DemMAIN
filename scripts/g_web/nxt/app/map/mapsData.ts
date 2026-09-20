import "server-only";
import fs from "node:fs/promises";
import { parse } from "yaml";
import * as z from "zod";
import { C } from "@g/com/lib/config";

const zMap = z.object({
    name: z.string(),  // Used in tile paths, e.g. "flat"
    title: z.string()  // Display name, e.g. "Flat"
});

const zWorld = z.object({
    name: z.string(),
    enabled: z.boolean(),
    maps: z.array(zMap).default([])
});

const zWorldsFile = z.object({
    worlds: z.array(zWorld)
});

/** A map of the world, as configured in dynmap. */
export type MapInfo = z.infer<typeof zMap>;

/**
 * Loads the maps of the world we display from dynmap's worlds.txt, in the order dynmap lists them.
 * Only the first enabled world that has maps is used - disabled worlds (e.g. the nether and end dimensions) and worlds without maps are ignored.
 */
export async function loadMaps(): Promise<Array<MapInfo>> {
    const raw = await fs.readFile(C().DYNMAP_WORLDS_FILE, "utf-8");
    const world = zWorldsFile.parse(parse(raw)).worlds.find(w => w.enabled && w.maps.length > 0);
    if (!world) throw new Error(`No enabled dynmap world with maps in ${C().DYNMAP_WORLDS_FILE}`);
    return world.maps;
}
