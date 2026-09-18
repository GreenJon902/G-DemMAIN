import { type LayerFactory } from "./mapTypes";

const MARKER_ICON_SIZE = 16;  // Rendered icon size in screen pixels (icons don't scale with zoom) - TODO: dynmap's real per-icon size isn't loaded yet, this is a guess
const DEFAULT_ICON = "default";  // Fallback icon name when a marker and its set both lack one

const SVG_NS = "http://www.w3.org/2000/svg";

/** Converts a decimal RGB colour (as used in markers.yml, e.g. 16711680) into a CSS hex colour. */
function cssColor(decimal: number): string {
    return `#${decimal.toString(16).padStart(6, "0")}`;
}

/** Builds the request URL for a marker icon image. */
function iconUrl(icon: string): string {
    return `map/markers/${icon}.png`;
}

/** Creates an svg element in the svg namespace with the given attributes set. */
function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    return el;
}

/** Appends an svg <title> child, so hovering the element shows the label as a native tooltip. */
function withTitle<T extends SVGElement>(el: T, label: string): T {
    const title = document.createElementNS(SVG_NS, "title");
    title.textContent = label;
    el.appendChild(title);
    return el;
}

/**
 * Creates callbacks for the marker layer, which draws circles/areas/lines/markers for each enabled marker set as svg shapes.
 */
export const createMarkerLayer: LayerFactory = (container, data) => {
    // Anchored at the container's top-left corner (the viewport's top-left) with a zero-size box
    const svg = svgEl("svg", {});
    svg.style.position = "absolute";
    svg.style.left = "0";
    svg.style.top = "0";
    svg.style.width = "0";
    svg.style.height = "0";
    svg.style.overflow = "visible";
    container.appendChild(svg);

    // Holds all the markers, this gets the zoom and pan transformations (apply to groups so non-scaling-stroke works)
    const world = svgEl("g", {});
    svg.appendChild(world);

    for (const setName of data.selectedMarkers) {
        const set = data.markersData[setName];
        if (!set) continue;  // Unknown/renamed set name - nothing to draw

        const group = withTitle(svgEl("g", {}), set.label);
        world.appendChild(group);

        // Draw circles
        for (const circle of Object.values(set.circles)) {
            const el = svgEl("ellipse", {
                cx: `${circle.x}`, cy: `${circle.z}`,
                rx: `${circle.xr}`, ry: `${circle.zr}`,
                fill: cssColor(circle.fillColor), "fill-opacity": `${circle.fillOpacity}`,
                stroke: cssColor(circle.strokeColor), "stroke-opacity": `${circle.strokeOpacity}`,
                "stroke-width": `${circle.strokeWeight}`, "vector-effect": "non-scaling-stroke"
            });
            group.appendChild(withTitle(el, circle.label));
        }

        // Draw areas (polygons)
        for (const area of Object.values(set.areas)) {
            const points = area.x.map((x, i) => `${x},${area.z[i]}`).join(" ");
            const el = svgEl("polygon", {
                points,
                fill: cssColor(area.fillColor), "fill-opacity": `${area.fillOpacity}`,
                stroke: cssColor(area.strokeColor), "stroke-opacity": `${area.strokeOpacity}`,
                "stroke-width": `${area.strokeWeight}`, "vector-effect": "non-scaling-stroke"
            });
            group.appendChild(withTitle(el, area.label));
        }

        // Draw lines
        for (const line of Object.values(set.lines)) {
            const points = line.x.map((x, i) => `${x},${line.z[i]}`).join(" ");
            const el = svgEl("polyline", {
                points, fill: "none",
                stroke: cssColor(line.strokeColor), "stroke-opacity": `${line.strokeOpacity}`,
                "stroke-width": `${line.strokeWeight}`, "vector-effect": "non-scaling-stroke"
            });
            group.appendChild(withTitle(el, line.label));
        }

        // Draw markers / icons
        for (const marker of Object.values(set.markers)) {
            const icon = marker.icon ?? set.deficon ?? DEFAULT_ICON;
            // The group moves the origin to the marker, then the image is centred on it and counter-scaled by --inv-zoom (set in update) to cancel the world's zoom
            const anchor = svgEl("g", { transform: `translate(${marker.x} ${marker.z})` });
            const el = svgEl("image", {
                href: iconUrl(icon),
                x: `${-MARKER_ICON_SIZE / 2}`, y: `${-MARKER_ICON_SIZE / 2}`,
                width: `${MARKER_ICON_SIZE}`, height: `${MARKER_ICON_SIZE}`
            });
            el.style.transform = "scale(var(--inv-zoom))";
            anchor.appendChild(withTitle(el, marker.label));
            group.appendChild(anchor);
        }
    }

    return {
        /** Places the shapes in view. Shapes use (x, z) directly as svg coordinates: svg y grows downwards, matching minecraft z growing southwards, which is block-y-negative on the map. */
        update({ x, y, zoom, vpWidth, vpHeight }) {
            // Screen position of a block is (vpWidth/2 + zoom*(bx - x), vpHeight/2 + zoom*(z + y)), where z = -by
            world.setAttribute("transform", `translate(${vpWidth / 2} ${vpHeight / 2}) scale(${zoom}) translate(${-x} ${y})`);
            svg.style.setProperty("--inv-zoom", `${1 / zoom}`);
        }
    };
};
