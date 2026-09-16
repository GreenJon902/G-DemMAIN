import { type BlockBoundingBox, type LayerFactory } from "./mapTypes";

const PIXELS_PER_BLOCK_EDGE = 4;  // Number of pixels per block edge in a base/unzoomed tile  // TODO: Load this from config as it depends on dynmaps config
const TILE_SIZE = 128;  // Width and height of a tile in pixels

const DEBUG_PLACEHOLDER_OPACITY = "10%";  // Opacity of a debug tile before it has loaded
const DEBUG_LOADED_OPACITY = "25%";  // Opacity of a debug tile once loaded - kept below 100% so the debug border stays legible over the image

const ZOOM_SETTLE_MS = 150;  // How long a zoom level must be held before its tiles are fetched, so we can skip levels passed through mid-gesture

/**
 * Builds the request URL for a single tile image, given its tile coordinates.
 * tileX/tileY are passed straight into the filename, so they use dynmap's own naming convention - the bottom-left of the top-left unzoomed sub-tile, not the bottom-left of the tile itself (see tiles/[map]/[file]/route.ts).
 * @param map - Name of the dynmap map the tile belongs to, e.g. "flat" or "iso".
 * @param prefixZCount - The number of zs in the prefix.
 */
function tileUrl(map: string, prefixZCount: number, tileX: number, tileY: number): string {
    const prefix = "z".repeat(prefixZCount) + ((prefixZCount > 0) ? "_" : "");
    return `map/tiles/${map}/${prefix}${tileX}_${tileY}.jpg`;
}

/**
 * Gets the bounding box of tile indexes (we call this I,J, not X,Y) for the given bbox. The (I,J) can be understood as tile coordinates if the zoom was 1. These must be multiplied by the number of contained unzoomed tiles before they will relate to an actual tile file.
 * The block bbox can be in fractions of blocks, the returned bbox will be in integers. The returned numbers are inclusive (so boundary tiles should be drawn too).
 * This accounts for the fact that tile coordinates are not the bottom-left of a tile (see tiles/[file]/route.ts).
 */
function blockBBoxToTileBBox(bbox: BlockBoundingBox, prefixZCount: number): { tileLeft: number, tileTop: number, tileRight: number, tileBottom: number } {
    const tileBlockEdge = TILE_SIZE * 2**prefixZCount / PIXELS_PER_BLOCK_EDGE;  // Number of blocks covered by one tile at this zoom level

    // If we floor all of these, then the displayed tiles will cover at least the entire viewport
    return {
        tileLeft: Math.floor(bbox.left / tileBlockEdge),
        tileTop: Math.floor(bbox.top / tileBlockEdge + (1-2**-prefixZCount)),  // Shifts up by (1 - 2**-prefixZCount) tiles to correct for the naming-coordinate offset described above
        tileRight: Math.floor(bbox.right / tileBlockEdge),
        tileBottom: Math.floor(bbox.bottom / tileBlockEdge + (1-2**-prefixZCount))
    };
}

/**
 * Creates callbacks for the tile layer.
 */
export const createTileLayer: LayerFactory = (container, meta) => {
    const tiles = new Map<string, HTMLImageElement>();  // Keyed by "tileX_tileY"
    let latestWanted = new Set<string>();  // The wanted set from the most recent update() call
    let pendingLoads = 0;  // Number of newly-added tiles still waiting to load/error

    // Removes tiles that are no longer wanted, but only once every newly-requested tile has settled (loaded or failed) - avoids a flash of gaps while replacements are still loading in
    function removeStaleTiles() {
        for (const [key, img] of tiles) {
            if (latestWanted.has(key)) continue;
            if (!img.complete) {
                // Image never finished loading, so there's no animation to play
                img.onload = img.onerror = null;  // This will abort the fetch
                img.src = "";
                tiles.delete(key);
                img.remove();
                pendingLoads--;
                continue;
            }
            if (pendingLoads > 0) continue;  // If other tiles are still loading then this tile may still hold useful info
            // Fade out then remove
            img.style.opacity = "0%";
            tiles.delete(key);
            setTimeout((i=img) => i.remove(), 500);  // Remove after animation finishes
        }
    }

    // The zoom level (prefixZCount) tiles are currently loaded for, or being loaded for
    let committedPrefixZCount: number | null = null;
    // The not-yet-committed zoom level we're currently waiting to settle, and the timer/bbox for that wait
    let pendingPrefixZCount: number | null = null;
    let pendingBBox: BlockBoundingBox | null = null;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    /** Creates/loads tiles for the given (already-settled) zoom level and bbox, and prunes ones no longer wanted. */
    function commitTiles(bbox: BlockBoundingBox, prefixZCount: number) {
        committedPrefixZCount = prefixZCount;

        const { tileLeft, tileTop, tileRight, tileBottom } = blockBBoxToTileBBox(bbox, prefixZCount);

        const wanted = new Set<string>();  // "tileX_tileY". List of tiles that should be shown for this bounding box
        for (let tileI = tileLeft; tileI <= tileRight; tileI++) {
            for (let tileJ = tileBottom; tileJ <= tileTop; tileJ++) {
                // Convert back from tile(I,J) into the base/unzoomed tile(X,Y) used for naming and positioning
                const tileX = tileI * 2**prefixZCount;
                const tileY = tileJ * 2**prefixZCount;

                const key = `${prefixZCount}_${tileX}_${tileY}`;
                wanted.add(key);
                if (tiles.has(key)) continue;  // If already redered then no action

                // Render the tile to the location in the minecraft world - the parent will translate this into view
                const img = document.createElement("img");
                img.style.position = "absolute";
                img.style.left = `${tileX * TILE_SIZE / PIXELS_PER_BLOCK_EDGE}px`;
                img.style.bottom = `${tileY * TILE_SIZE / PIXELS_PER_BLOCK_EDGE - (2**prefixZCount-1) * TILE_SIZE / PIXELS_PER_BLOCK_EDGE}px`;  // tileY names the bottom of the top-left unzoomed sub-tile, not the bottom of the whole rendered tile (see tiles/[file]/route.ts) - shift down by the height of the (2**prefixZCount - 1) sub-tile rows below it to reach the tile's actual bottom
                img.style.width = `${TILE_SIZE / PIXELS_PER_BLOCK_EDGE * 2**prefixZCount}px`;
                img.style.height = `${TILE_SIZE / PIXELS_PER_BLOCK_EDGE * 2**prefixZCount}px`;

                // We have tiles fade in and out
                img.style.opacity = (meta.debug) ? DEBUG_PLACEHOLDER_OPACITY : "0%";
                img.style.transition = "opacity 0.5s";

                // Disable user interaction with tiles, otherwise drag is broken
                img.draggable = false;
                img.style.userSelect = "none";

                if (meta.debug) {
                    img.style.border = "solid red 1px";
                }

                pendingLoads++;
                const settle = () => {
                    pendingLoads--;
                    removeStaleTiles();
                };
                img.onload = () => {
                    settle();
                    img.style.opacity = meta.debug ? DEBUG_LOADED_OPACITY : "100%";  // Set tile to fade in
                };
                img.onerror = () => {
                    // Pan/zoom is unclamped, so out-of-range tiles 404 - hide rather than show a broken-image icon
                    if (!meta.debug) img.style.display = "none";
                    settle();
                };
                img.src = tileUrl(meta.map, prefixZCount, tileX, tileY);

                container.appendChild(img);
                tiles.set(key, img);
            }
        }

        // Drop tiles that are no longer in view, once any newly-requested tiles above have settled
        latestWanted = wanted;
        removeStaleTiles();
    }

    return {
        /** Compares current tiles to those in view, loads any newly-visible ones and drops those that are now hidden. */
        update(bbox, zoom) {
            // TODO: Load lower res / higher-prefix tiles first, then lazily load smaller tiles? And don't remove higher-prefix tiles until lower and loaded

            // Calculate the number of "z"s from the zoom. Each "z" level halfs the number of pixels per block edge
            let prefixZCount = Math.floor(Math.log2(PIXELS_PER_BLOCK_EDGE / zoom));
            prefixZCount = Math.min(7, Math.max(0, prefixZCount));  // TODO: Min and max prefix should not be magic numbers

            if (committedPrefixZCount === null || prefixZCount === committedPrefixZCount) {
                // Already showing this resolution (or this is the first frame) - no reason to wait
                if (settleTimer !== null) { clearTimeout(settleTimer); settleTimer = null; }
                pendingPrefixZCount = null;
                commitTiles(bbox, prefixZCount);
                return;
            }

            // Resolution changed - wait for it to settle before fetching new tiles, so a fast zoom
            // gesture doesn't fetch every resolution it passes through, only the one it lands on
            pendingBBox = bbox;
            if (prefixZCount !== pendingPrefixZCount) {
                pendingPrefixZCount = prefixZCount;
                if (settleTimer !== null) clearTimeout(settleTimer);
                settleTimer = setTimeout(() => {
                    settleTimer = null;
                    commitTiles(pendingBBox!, prefixZCount);
                }, ZOOM_SETTLE_MS);
            }
        },
        destroy() {
            if (settleTimer !== null) clearTimeout(settleTimer);
        }
    };
};
