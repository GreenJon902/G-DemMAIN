/** Bounding box in Minecraft block coordinates (not pixels, not tiles). */
export type BlockBoundingBox = {
    left: number, top: number, right: number, bottom: number
};

/**
 * Creates a layer in the map. This is something that can be panned & zoomed.
 * This should populate the div with content at least in the given bbox - the parent will transform this to be in view.
 */
export type LayerFactory = (container: HTMLDivElement) => {
    update: (bbox: BlockBoundingBox) => void,  // The viewable bbox has changed, so ensure content that should be visible is visible
    destroy?: () => void
};
