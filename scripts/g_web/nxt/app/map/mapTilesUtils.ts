import type { BlockBoundingBox, LayerFactory } from "./mapTypes";

const PIXELS_PER_BLOCK_EDGE = 4;  // Number of pixels per block edge in a base/unzoomed tile  // TODO: Load this from config as it depends on dynmaps config
const TILE_SIZE = 128;  // Width and height of a tile in pixels

// TODO: Support lower-res / prefixed tiles
/**
 * Builds the request URL for a single tile image, given its tile coordinates.
 */
function tileUrl(tileX: number, tileY: number): string {
    return `map/tiles/${tileX}_${tileY}.jpg`;
}

/**
 * Converts a block-coordinate bounding box into an inclusive tile-coordinate bounding box.
 * The block bbox can be in fractions of blocks, the returned bbox will be in integers.
 */
function blockBBoxToTileBBox(bbox: BlockBoundingBox): { tileLeft: number, tileTop: number, tileRight: number, tileBottom: number } {
    // If we floor all of these, then the displayed tiles will cover at least the entire viewport
    return {
        tileLeft: Math.floor(bbox.left * PIXELS_PER_BLOCK_EDGE / TILE_SIZE),
        tileTop: Math.floor(bbox.top * PIXELS_PER_BLOCK_EDGE / TILE_SIZE),
        tileRight: Math.floor(bbox.right * PIXELS_PER_BLOCK_EDGE / TILE_SIZE),
        tileBottom: Math.floor(bbox.bottom * PIXELS_PER_BLOCK_EDGE / TILE_SIZE)
    };
}

/**
 * Creates callbacks for the tile layer.
 */
export const createTileLayer: LayerFactory = (container) => {
    const tiles = new Map<string, HTMLImageElement>();  // Keyed by "tileX_tileY"

    return {
        /** Compares current tiles to those in view, loads any that need to be loaded and drops those that are now hidden. */
        update(bbox) {
            const { tileLeft, tileTop, tileRight, tileBottom } = blockBBoxToTileBBox(bbox);

            const wanted = new Set<string>();  // "tileX_tileY". List of tiles that should be shown for this bounding box
            for (let tileX = tileLeft; tileX <= tileRight; tileX++) {
                for (let tileY = tileBottom; tileY <= tileTop; tileY++) {
                    const key = `${tileX}_${tileY}`;
                    wanted.add(key);
                    if (tiles.has(key)) continue;  // If already redered then no action

                    // Render the tile to the location in the minecraft world - the parent will translate this into view
                    const img = document.createElement("img");
                    img.style.position = "absolute";
                    img.style.left = `${tileX * TILE_SIZE / PIXELS_PER_BLOCK_EDGE}px`;
                    img.style.bottom = `${tileY * TILE_SIZE / PIXELS_PER_BLOCK_EDGE}px`;
                    img.style.width = `${TILE_SIZE / PIXELS_PER_BLOCK_EDGE}px`;
                    img.style.height = `${TILE_SIZE / PIXELS_PER_BLOCK_EDGE}px`;
                    // Disable user interaction with tiles, otherwise drag is broken
                    img.draggable = false;
                    img.style.userSelect = "none";
                    // Pan/zoom is unclamped, so out-of-range tiles 404 - hide rather than show a broken-image icon
                    img.onerror = () => { img.style.display = "none"; };
                    img.src = tileUrl(tileX, tileY);

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
