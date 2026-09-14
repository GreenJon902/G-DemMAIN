"use client";

import { useEffect, useRef, useState } from "react";
import MapOverlay from "./MapOverlay";
import { createTileLayer } from "./mapTilesUtils";
import type { BlockBoundingBox, LayerFactory } from "./mapTypes";

// Everything rendered inside the panned/zoomed container, in registration order. Layers are drawn
// via direct DOM mutation rather than JSX (see MapStack's doc comment below), so adding a future
// marker layer is just appending another factory here
const LAYER_FACTORIES: LayerFactory[] = [createTileLayer];

const ZOOM_SPEED = 0.001;  // Larger = more zoom change per wheel-scrolled pixel

/**
 * Stores the pan and zoom information for the map viewer for the client.
 *
 * (x, y) is the minecraft block coordinate that should render in the middle of the viewer div.
 * Zoom is how many screen pixels (in one cardinal direction) per in-game block. So zoom == 1 means each block has one screen pixel (when using the flat map), whereas zoom == 2 means each block has four (2x2) screen pixels, and 0.5 means each screen pixel shares four (2x2) blocks.
 */
type PanZoom = {
    x: number, y: number,
    zoom: number
}

/**
 * This component assembles and holds all the components of the map, and handles zooming and panning.
 * For some children, JSX ends here (and we instead do direct DOM mutation) for efficiency - so we don't need to go through REACT for every frame when panning.
 */
export default function MapStack({
    defaultEnabledMarkers, markerOptions, defaultSelectedMap, mapOptions
}: {
    defaultEnabledMarkers: Array<string>, markerOptions: Array<string>,
    defaultSelectedMap: string, mapOptions: Array<string>
}) {
    // Settings - configured by overlay
    const [enabledMarkers, setEnabledMarkers] = useState(defaultEnabledMarkers);
    const [selectedMap, setSelectedMap] = useState(defaultSelectedMap);

    // Panning and zooming handling code
    const mapContainer = useRef<HTMLDivElement>(null);  // This is the object that gets panned and zoomed, this contains the tiles, markers, etc.

    useEffect(() => {
        const root = mapContainer.current;
        if (!root) return;

        const panZoom: PanZoom = { x: 0, y: 0, zoom: 4 };
        let vpWidth = 0, vpHeight = 0;  // Kept up to date by the ResizeObserver below, so render() doesn't force a layout read on every wheel/pointer event

        // Create each layer's own container div
        const layers = LAYER_FACTORIES.map(createLayer => {
            const container = document.createElement("div");
            container.className = "absolute inset-0";
            root.appendChild(container);
            return { container, ...createLayer(container) };
        });  // Stores [(layerDiv, layerCallbacks), ...]

        /** Applies the current pan/zoom to the container's transform and updates each layer. */
        function render() {
            const blockWidth = vpWidth / panZoom.zoom;
            const blockHeight = vpHeight / panZoom.zoom;
            // Calculate the bounding box of blocks viewable in the viewport
            const blockLeft = -blockWidth / 2 + panZoom.x;
            const blockTop = blockHeight / 2 + panZoom.y;
            const bbox: BlockBoundingBox = {
                left: blockLeft, top: blockTop,
                right: blockLeft + blockWidth, bottom: blockTop - blockHeight
            };

            // Transform root div so viewport is looking at correct location in world space
            root!.style.transform = `scale(${panZoom.zoom}) translate(${vpWidth / 2 - panZoom.x}px, ${-vpHeight / 2 + panZoom.y}px)`;
            // Update layers (e.g. loading tiles that are now visible)
            for (const layer of layers) layer.update(bbox);
        }

        // Recomputes the viewport size whenever it changes (initial layout, window resize, etc) and re-renders
        const resizeObserver = new ResizeObserver(() => {
            ({ width: vpWidth, height: vpHeight } = root.getBoundingClientRect());
            render();
        });
        resizeObserver.observe(root);

        // Zoom using the scroll wheel. Just zoom around the centre
        function onWheel(event: WheelEvent) {
            event.preventDefault();
            panZoom.zoom = panZoom.zoom * Math.exp(-event.deltaY * ZOOM_SPEED);  
            render();
        }

        // Drag-to-pan, using pointer capture so the drag continues even if the cursor leaves the container mid-drag
        let dragStart: { pointerId: number, clientX: number, clientY: number, panX: number, panY: number } | null = null;

        function onPointerDown(event: PointerEvent) {
            dragStart = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, panX: panZoom.x, panY: panZoom.y };
            root!.setPointerCapture(event.pointerId);
        }
        function onPointerMove(event: PointerEvent) {
            if (!dragStart || event.pointerId !== dragStart.pointerId) return;
            // Screen pixels -> blocks: divide by zoom; y is flipped, since screen-down is block-negative-y
            panZoom.x = dragStart.panX - (event.clientX - dragStart.clientX) / panZoom.zoom;
            panZoom.y = dragStart.panY + (event.clientY - dragStart.clientY) / panZoom.zoom;
            render();
        }
        function onPointerUp(event: PointerEvent) {
            if (!dragStart || event.pointerId !== dragStart.pointerId) return;
            root!.releasePointerCapture(event.pointerId);
            dragStart = null;
        }

        root.addEventListener("wheel", onWheel, { passive: false });  // passive: false since we call preventDefault() to stop page scroll
        root.addEventListener("pointerdown", onPointerDown);
        root.addEventListener("pointermove", onPointerMove);
        root.addEventListener("pointerup", onPointerUp);

        return () => {
            // Remove all our bindings on unmount
            resizeObserver.disconnect();
            root.removeEventListener("wheel", onWheel);
            root.removeEventListener("pointerdown", onPointerDown);
            root.removeEventListener("pointermove", onPointerMove);
            root.removeEventListener("pointerup", onPointerUp);
            for (const layer of layers) {
                layer.destroy?.();  // Call destroy if it exists
                layer.container.remove();
            }
        };
    }, []);


    return (
        <div className="relative flex-1 overflow-clip">
            {/* Panable/zoomable content. select-none as otherwise drag is broken */}
            <div ref={mapContainer} className="absolute size-full select-none">

            </div>
            {/* Fixed overlay */}
            <MapOverlay
                className="absolute size-full"
                markerState={[enabledMarkers, setEnabledMarkers]}
                markerOptions={markerOptions}
                mapState={[selectedMap, setSelectedMap]}
                mapOptions={mapOptions}
            />
        </div>
    );
}
