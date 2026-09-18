import "server-only";
import fs from "node:fs/promises";
import { parse } from "yaml";
import * as z from "zod";

// TODO: Load this from config once the dynmap output location is configurable
const MARKERS_YML_PATH = "/home/greenjon902/Desktop/G-DemMAIN/scripts/g_web/devData/dynmap/markers.yml";

const zColor = z.number();  // Decimal RGB, e.g. 16711680 == 0xff0000

const zCircle = z.object({
    world: z.string(),
    x: z.number(), z: z.number(),
    xr: z.number(), zr: z.number(),
    label: z.string(),
    fillColor: zColor, fillOpacity: z.number(),
    strokeColor: zColor, strokeOpacity: z.number(), strokeWeight: z.number()
});

const zArea = z.object({
    world: z.string(),
    x: z.array(z.number()), z: z.array(z.number()),
    label: z.string(),
    fillColor: zColor, fillOpacity: z.number(),
    strokeColor: zColor, strokeOpacity: z.number(), strokeWeight: z.number()
});

const zLine = z.object({
    world: z.string(),
    x: z.array(z.number()), z: z.array(z.number()),
    label: z.string(),
    strokeColor: zColor, strokeOpacity: z.number(), strokeWeight: z.number()
});

const zMarker = z.object({
    world: z.string(),
    // TODO: y (elevation) is ignored for now - the map viewer is a flat top-down projection, but this could be used for something later (e.g. filtering by height)
    x: z.number(), z: z.number(),
    icon: z.string().optional(),
    label: z.string()
});

const zMarkerSet = z.object({
    label: z.string(),
    deficon: z.string().optional(),
    circles: z.record(z.string(), zCircle).default({}),
    areas: z.record(z.string(), zArea).default({}),
    markers: z.record(z.string(), zMarker).default({}),
    lines: z.record(z.string(), zLine).default({})
});

const zMarkersFile = z.object({
    sets: z.record(z.string(), zMarkerSet)
});

export type MarkerCircle = z.infer<typeof zCircle>;
export type MarkerArea = z.infer<typeof zArea>;
export type MarkerLine = z.infer<typeof zLine>;
export type MarkerPoint = z.infer<typeof zMarker>;
export type MarkerSet = z.infer<typeof zMarkerSet>;
export type MarkersData = Record<string, MarkerSet>;

/** Loads and validates the dynmap markers file, keeping only the fields the map viewer renders. */
export async function loadMarkersData(): Promise<MarkersData> {
    const raw = await fs.readFile(MARKERS_YML_PATH, "utf-8");
    return zMarkersFile.parse(parse(raw)).sets;
}
