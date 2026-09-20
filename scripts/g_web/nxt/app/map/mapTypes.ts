import type { MarkersData } from "./markersData";

/** Bounding box in Minecraft block coordinates (not pixels, not tiles). */
export type BlockBoundingBox = {
    left: number, top: number, right: number, bottom: number
};

/** Data for layer rendering. */
export type LayerData = {
    map: string,  // Name of the selected dynmap map, e.g. "flat" or "iso"
    debug: boolean,  // Useful for testing, and I've just made it a feature ig
    markersData: MarkersData,  // All loaded marker sets, keyed by set name
    selectedMarkers: Array<string>  // Names of the marker sets currently enabled
};

/**
 * The current view of the map, handed to every layer on each frame.
 *
 * (x, y) is the block coordinate at the centre of the viewport and zoom is screen pixels per block, both as in MapStack's PanZoom. y grows upwards on screen.
 */
export type MapView = {
    bbox: BlockBoundingBox,  // Blocks currently visible in the viewport
    x: number, y: number,
    zoom: number,
    vpWidth: number, vpHeight: number  // Viewport size in screen pixels
};

/**
 * Creates a layer in the map. This is something that can be panned & zoomed.
 * The container is viewport-sized and untransformed - the layer is responsible for placing its own content in view (e.g. via a transform on the container) using the MapView it is given.
 */
export type LayerFactory = (container: HTMLDivElement, data: LayerData) => {
    update: (view: MapView) => void,  // The view has changed (called at most once per frame), so reposition content and ensure content that should be visible is visible
    destroy?: () => void
};
