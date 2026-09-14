import type { BlockBoundingBox, LayerFactory } from "./mapTypes";

const PIXELS_PER_BLOCK_EDGE = 4;  // Number of pixels per block edge in a base/unzoomed tile  // TODO: Load this from config as it depends on dynmaps config
const TILE_SIZE = 128;  // Width and height of a tile in pixels

// TODO: Support lower-res / prefixed tiles
/**
 * Builds the request URL for a single tile image, given its tile coordinates.
 * @param prefixZCount - The number of zs in the prefix.
 */
function tileUrl(prefixZCount: number, tileX: number, tileY: number): string {
    const prefix = "z".repeat(prefixZCount) + ((prefixZCount > 0) ? "_" : "");
    return `map/tiles/${prefix}${tileX}_${tileY}.jpg`;
}

/**
 * Converts a block-coordinate bounding box into an inclusive tile(I,J)-coordinate bounding box.
 * Tile(I,J) is the coordinate system of the tile grid for the given prefixZCount, i.e. it treats that zoom level's tiles as if they were the base/unzoomed tiles - each I,J step covers 2**prefixZCount base tiles.
 * The block bbox can be in fractions of blocks, the returned bbox will be in integers.
 */
function blockBBoxToTileBBox(bbox: BlockBoundingBox, prefixZCount: number): { tileLeft: number, tileTop: number, tileRight: number, tileBottom: number } {
    const tileBlockEdge = TILE_SIZE * 2**prefixZCount / PIXELS_PER_BLOCK_EDGE;  // Number of blocks covered by one tile at this zoom level

    // If we floor all of these, then the displayed tiles will cover at least the entire viewport
    return {
        tileLeft: Math.floor(bbox.left / tileBlockEdge),
        tileTop: Math.floor(bbox.top / tileBlockEdge),
        tileRight: Math.floor(bbox.right / tileBlockEdge),
        tileBottom: Math.floor(bbox.bottom / tileBlockEdge)
    };
}

/**
 * Creates callbacks for the tile layer.
 */
export const createTileLayer: LayerFactory = (container) => {
    const tiles = new Map<string, HTMLImageElement>();  // Keyed by "tileX_tileY"

    return {
        /** Compares current tiles to those in view, loads any that need to be loaded and drops those that are now hidden. */
        update(bbox, zoom) {
            // TODO: Load lower res / higher-prefix tiles first, then lazily load smaller tiles? And don't remove higher-prefix tiles until lower and loaded

            // Calculate the number of "z"s from the zoom. Each "z" level halfs the number of pixels per block edge
            let prefixZCount = Math.floor(Math.log2(PIXELS_PER_BLOCK_EDGE / zoom));
            prefixZCount = Math.min(7, Math.max(0, prefixZCount));  // TODO: Min and max prefix should not be magic numbers

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
                    img.style.bottom = `${tileY * TILE_SIZE / PIXELS_PER_BLOCK_EDGE}px`;
                    img.style.width = `${TILE_SIZE / PIXELS_PER_BLOCK_EDGE * 2**prefixZCount}px`;
                    img.style.height = `${TILE_SIZE / PIXELS_PER_BLOCK_EDGE * 2**prefixZCount}px`;
                    // Disable user interaction with tiles, otherwise drag is broken
                    img.draggable = false;
                    img.style.userSelect = "none";
                    // Pan/zoom is unclamped, so out-of-range tiles 404 - hide rather than show a broken-image icon
                    img.onerror = () => { img.style.display = "none"; };
                    img.src = tileUrl(prefixZCount, tileX, tileY);

                    container.appendChild(img);
                    tiles.set(key, img);
                }
            }

            // Drop tiles that are no longer in view
            for (const [key, img] of tiles) {
                if (wanted.has(key)) continue;
                img.remove();
                tiles.delete(key);
            }
        }
    };
};
