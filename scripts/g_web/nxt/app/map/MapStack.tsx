"use client";

import { useEffect, useRef, useState } from "react";
import MapOverlay from "./MapOverlay";
import { createTileLayer } from "./mapTilesUtils";
import { createMarkerLayer } from "./mapMarkersUtils";
import { type LayerFactory, type MapView } from "./mapTypes";
import type { MarkersData } from "./markersData";

// Everything rendered in the map, in registration order (later factories
// paint on top of earlier ones). Layers are drawn via direct DOM mutation rather than JSX (see
// MapStack's doc comment below)
const LAYER_FACTORIES: LayerFactory[] = [createTileLayer, createMarkerLayer];

const ZOOM_SPEED = 0.001;  // Larger = more zoom change per wheel-scrolled pixel
const MIN_ZOOM = 0.03;  // Roughly where the coarsest tiles (prefix 7) are 128 screen pixels wide. Zooming out further would keep loading more of those tiles, until the browser runs out of memory
const MAX_ZOOM = 32;

/** Limits a zoom value to the supported range. */
function clampZoom(zoom: number): number {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

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

// Everything the overlay can configure
type MapViewState = {
    selectedMap: string,
    debugMode: boolean,
    selectedMarkers: Array<string>
};

/**
 * This component assembles and holds all the components of the map, and handles zooming and panning.
 * For some children, JSX ends here (and we instead do direct DOM mutation) for efficiency - so we don't need to go through REACT for every frame when panning.
 */
export default function MapStack({
    defaultEnabledMarkers, markersData, defaultSelectedMap, mapOptions
}: {
    defaultEnabledMarkers: Array<string>, markersData: MarkersData,
    defaultSelectedMap: string, mapOptions: Array<string>
}) {
    // Settings - configured by overlay
    const [viewState, setViewState] = useState<MapViewState>({
        selectedMap: defaultSelectedMap,
        debugMode: false,
        selectedMarkers: defaultEnabledMarkers
    });

    // Panning and zooming handling code
    const mapContainer = useRef<HTMLDivElement>(null);  // This is the object that gets panned and zoomed, this contains the tiles, markers, etc.
    const viewport = useRef<HTMLDivElement>(null);  // Wraps mapContainer - always fills screen so is always mouse collidable
    const panZoomRef = useRef<PanZoom>(null);  // Stores panZoom between taredown and build-up of the effect, as this occurs when the map or markers change. This should not be used directly as it is only updated on taredown

    useEffect(() => {
        const root = mapContainer.current;
        const viewportElement = viewport.current;
        if (!root || !viewportElement) return;

        const panZoom: PanZoom = panZoomRef.current ?? { x: 0, y: 0, zoom: 1 };
        let vpWidth = 0, vpHeight = 0;  // Kept up to date by the ResizeObserver below, so render() doesn't force a layout read on every wheel/pointer event

        // Create each layer's own container div
        const layers = LAYER_FACTORIES.map(createLayer => {
            const container = document.createElement("div");
            container.className = "absolute inset-0";
            root.appendChild(container);
            return { container, ...createLayer(container, { map: viewState.selectedMap, debug: viewState.debugMode, markersData, selectedMarkers: viewState.selectedMarkers }) };
        });  // Stores [(layerDiv, layerCallbacks), ...]

        let updateFrameId: number | null = null;  // rAF id of a pending layer.update() pass, if any
        let pendingView: MapView | null = null;  // Latest view to hand to layers once updateFrameId fires
        /**
         * Builds the current view from the pan/zoom and schedules a layer update with requestAnimationFrame.
         * Run these all on the same animation frame so layers move in sync.
         */
        function render() {
            const blockWidth = vpWidth / panZoom.zoom;
            const blockHeight = vpHeight / panZoom.zoom;
            // Calculate the bounding box of blocks viewable in the viewport
            const blockLeft = -blockWidth / 2 + panZoom.x;
            const blockTop = blockHeight / 2 + panZoom.y;
            pendingView = {
                bbox: {
                    left: blockLeft, top: blockTop,
                    right: blockLeft + blockWidth, bottom: blockTop - blockHeight
                },
                x: panZoom.x, y: panZoom.y, zoom: panZoom.zoom,
                vpWidth, vpHeight
            };

            if (updateFrameId !== null) return;  // An update is already scheduled - it'll pick up pendingView above
            updateFrameId = requestAnimationFrame(() => {
                updateFrameId = null;
                // Update layers (e.g. repositioning them and loading tiles that are now visible)
                for (const layer of layers) layer.update(pendingView!);
            });
        }

        // Recomputes the viewport size whenever it changes (initial layout, window resize, etc) and re-renders.
        const resizeObserver = new ResizeObserver(([entry]) => {
            vpWidth = entry.contentRect.width;  // These are unaffected by css scale
            vpHeight = entry.contentRect.height;
            render();
        });
        resizeObserver.observe(viewportElement);

        // Zoom using the scroll wheel, around the cursor
        function onWheel(event: WheelEvent) {
            event.preventDefault();
            // Offset of the cursor from the viewport centre in client pixels, and the block under it, which must stay under the cursor after zooming (y is flipped, since screen-down is block-negative-y)
            const rect = viewportElement!.getBoundingClientRect();
            const offsetX = event.clientX - (rect.left + rect.width / 2);
            const offsetY = event.clientY - (rect.top + rect.height / 2);
            const blockX = panZoom.x + offsetX / panZoom.zoom;
            const blockY = panZoom.y - offsetY / panZoom.zoom;

            panZoom.zoom = clampZoom(panZoom.zoom * Math.exp(-event.deltaY * ZOOM_SPEED));
            panZoom.x = blockX - offsetX / panZoom.zoom;
            panZoom.y = blockY + offsetY / panZoom.zoom;
            render();
        }

        // Drag-to-pan and pinch-to-zoom
        const pointers = new Map<number, { x: number, y: number }>();  // Current client position of each active pointer
        /**
         * Snapshot taken whenever the set of pointers changes. The block under the gesture's centre at this moment is kept under the centre as it moves, which gives both panning and zooming around the pinch.
         * The centre is in client pixels, the block is (blockX, blockY) in block coordinates.
         */
        let gesture: { zoom: number, dist: number, vpCentreX: number, vpCentreY: number, blockX: number, blockY: number } | null = null;

        /** Gets the centre and separation (0 for a single pointer) of the pointers driving the gesture, or null if there are none. */
        function pointerMetrics(): { centreX: number, centreY: number, dist: number } | null {
            const [a, b] = pointers.values();
            if (!a) return null;
            if (!b) return { centreX: a.x, centreY: a.y, dist: 0 };
            return { centreX: (a.x + b.x) / 2, centreY: (a.y + b.y) / 2, dist: Math.hypot(a.x - b.x, a.y - b.y) };
        }

        /** Starts a fresh gesture baseline from the current pointers and pan/zoom. Call whenever a pointer is added or removed. */
        function rebaseGesture() {
            const metrics = pointerMetrics();
            if (!metrics) { gesture = null; return; } // If no pointers then kill the gesture
            const rect = viewportElement!.getBoundingClientRect();
            // Offset of the gesture centre from the viewport centre, in client pixels. Screen pixels -> blocks: divide by zoom; y is flipped, since screen-down is block-negative-y
            const vpCentreX = rect.left + rect.width / 2;
            const vpCentreY = rect.top + rect.height / 2;
            const offsetX = metrics.centreX - vpCentreX;
            const offsetY = metrics.centreY - vpCentreY;
            gesture = {
                zoom: panZoom.zoom, dist: metrics.dist,
                vpCentreX, vpCentreY,
                blockX: panZoom.x + offsetX / panZoom.zoom,
                blockY: panZoom.y - offsetY / panZoom.zoom
            };
        }

        function onPointerDown(event: PointerEvent) {
            pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            viewportElement!.setPointerCapture(event.pointerId);
            rebaseGesture();
        }
        function onPointerMove(event: PointerEvent) {
            if (!pointers.has(event.pointerId) || !gesture) return;
            pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            const metrics = pointerMetrics()!;

            // Pinching scales the zoom by how much the fingers have spread
            if (gesture.dist > 0 && metrics.dist > 0) panZoom.zoom = clampZoom(gesture.zoom * metrics.dist / gesture.dist);

            // Place the baseline block back under the (moved) gesture centre, i.e. choose the pan so the block sits at the centre's offset from the viewport centre
            panZoom.x = gesture.blockX - (metrics.centreX - gesture.vpCentreX) / panZoom.zoom;
            panZoom.y = gesture.blockY + (metrics.centreY - gesture.vpCentreY) / panZoom.zoom;
            render();
        }
        function onPointerEnd(event: PointerEvent) {
            if (!pointers.delete(event.pointerId)) return;
            viewportElement!.releasePointerCapture(event.pointerId);
            rebaseGesture();  // e.g. lifting one finger of a pinch continues as a pan with the other, without jumping
        }

        viewportElement.addEventListener("wheel", onWheel, { passive: false });  // passive: false since we call preventDefault() to stop page scroll
        viewportElement.addEventListener("pointerdown", onPointerDown);
        viewportElement.addEventListener("pointermove", onPointerMove);
        viewportElement.addEventListener("pointerup", onPointerEnd);
        viewportElement.addEventListener("pointercancel", onPointerEnd);

        return () => {
            // Remove all our bindings on unmount
            if (updateFrameId !== null) cancelAnimationFrame(updateFrameId);
            resizeObserver.disconnect();
            viewportElement.removeEventListener("wheel", onWheel);
            viewportElement.removeEventListener("pointerdown", onPointerDown);
            viewportElement.removeEventListener("pointermove", onPointerMove);
            viewportElement.removeEventListener("pointerup", onPointerEnd);
            viewportElement.removeEventListener("pointercancel", onPointerEnd);
            for (const layer of layers) {
                layer.destroy?.();  // Call destroy if it exists
                layer.container.remove();
            }
            // Track panZoomRef so if this taredown is due to map changing, we stay in same location
            panZoomRef.current = panZoom;
        };
    }, [viewState, markersData]);


    return (
        <div className={`relative flex-1 ${viewState.debugMode ? "scale-75 border border-orange-500" : "overflow-clip"}`}>
            {/** Viewport is used for collisions as it always takes up the whole screen. */}
            <div ref={viewport} className="absolute inset-0 touch-none select-none">
                {/* Panable/zoomable content */}
                <div ref={mapContainer} className="absolute size-full">

                </div>
            </div>
            {/* Fixed overlay */}
            <MapOverlay
                className="absolute size-full"
                markerState={[viewState.selectedMarkers, (selectedMarkers) => setViewState(s => ({ ...s, selectedMarkers }))]} // TODO: Move these calls into MapOverlay
                markerOptions={Object.keys(markersData)}
                markersData={markersData}
                mapState={[viewState.selectedMap, (selectedMap) => setViewState(s => ({ ...s, selectedMap }))]}
                mapOptions={mapOptions}
                debugState={[viewState.debugMode, (debugMode) => setViewState(s => ({ ...s, debugMode }))]}
            />
        </div>
    );
}
