/**
 * This file contains the components and methods to actually create/render graphs.
 */

"use_client";

import { Fragment, ReactNode } from "react";


// Since we need to specify tailwind colors in full, we will use constants
// This also means colors will be fixed and must hence be consistent
type LineColor = { stroke: string, fill: string, bg: string }
const LineColor = (stroke: string, fill: string, bg: string): LineColor => ({ stroke, fill, bg });
export const LINE_GRAY = LineColor("stroke-gray-600", "fill-gray-600", "bg-gray-600");
export const LINE_CYAN = LineColor("stroke-cyan-500", "fill-cyan-500", "bg-cyan-500");
export const LINE_LIME = LineColor("stroke-lime-500", "fill-lime-500", "bg-lime-500");
export const LINE_ROSE = LineColor("stroke-rose-500", "fill-rose-500", "bg-rose-500");
export const LINE_FUCHSIA = LineColor("stroke-fuchsia-500", "fill-fuchsia-500", "bg-fuchsia-500");
export const LINE_VIOLET = LineColor("stroke-violet-500", "fill-violet-500", "bg-violet-500");
export const LINE_BLUE = LineColor("stroke-blue-500", "fill-blue-500", "bg-blue-500");
export const LINE_YELLOW = LineColor("stroke-yellow-500", "fill-yellow-500", "bg-yellow-500");
export const LINE_COLORS = [LINE_ROSE, LINE_FUCHSIA, LINE_VIOLET, LINE_BLUE, LINE_CYAN, LINE_LIME, LINE_GRAY, LINE_YELLOW];  



type Line = {
    data: { x: number, y: number | null }[],  // The datapoints to plot. These should be in the interval [0,1], where 0 is the bottom/left edge and 1 is the maximum on the top/right edge. We expect these to be sorted with x ascending. If y is not plotted then the line will break.
    color: LineColor,
    underFill?: boolean,  // Do we fill in an opaque area under the line?
    points?: boolean,  // Do we draw circles on each vertex?
    label: string  // What to annotate the line as, this should be unique on this graph
}

/**
 * An abstract graph drawing component.
 * This draws a graph and a legend.
 * Underfills are drawn with 30% opacity.
 * The lines are drawn in the order given, so the last line is drawn on top. The legend is ordered in the opposite direction.
 * When there is a missing data point, we do NOT join the previous and next points, instead we have a physical gap there.
 *
 * @param lines - The lines to draw.
 * @param className - Optional className data to give to the returned component. E.g. "h-50"
 * @param containerClassName - Optional className to be given to the returned node.
 * @param graphClassName - Optional className to be given to each layer in the graph. This should really specify an absolute height.
 * @param xTicks - The labels to put equally spaced on the x-axis. Note that there are no ticks on the edges, so the bounds of the data have no ticks. These should be ordered from left to right.
 * @param yTicks - See {@link xTicks} but for the y-axis. These should be ordered from bottom to top.
 */
export function Graph({
    lines, containerClassName="", graphClassName="", xTicks, yTicks
}: {
    lines: Line[],
    containerClassName?: string,
    graphClassName?: string,
    xTicks: { top?: string[], bottom?: string[] },
    yTicks: { left?: string[], right?: string[] }
}) {
    // Optimize lines by determining which groups of points can be drawn in a single svg node (so adjacent non-null points)
    const optimizedLines = lines.map(line => {
        // Group adjacent non-null points
        const groups: { x: number, y: number }[][] = [];
        let current: { x: number, y: number }[] = [];
        for (let i=0; i<line.data.length; i++) {
            const {x, y} = line.data[i];
            if (y === null) {
                groups.push(current);
                current = [];
            } else {
                current.push({x, y});
            }
        }
        if (current.length > 0) groups.push(current);

        return {
            ...line,
            optimizedData: groups
        };
    });

    
    return (
        <div className={`${containerClassName} flex flex-col gap-1`}>  {/* A div to control the scaling */}
            {/* Graph --- */}
            <div className={`relative box-content rounded-md border-0 border-gray-300 bg-gray-800 ${graphClassName}`}>
                {/* Background --- */}
                <svg 
                    viewBox={"0 0 1 1"} 
                    preserveAspectRatio="none"
                    className={`absolute size-full ${graphClassName}`}
                >
                    <path 
                        vectorEffect="non-scaling-stroke"
                        className="fill-none stroke-gray-700"
                        d={[
                            ...xTicks.bottom ? xTicks.bottom.map((_, i, a) => `M${(i+1)/(a.length + 1)} 0 l0 1`) : [],
                            ...xTicks.top    ? xTicks.top   .map((_, i, a) => `M${(i+1)/(a.length + 1)} 0 l0 1`) : [],
                            ...yTicks.left   ? yTicks.left  .map((_, i, a) => `M0 ${(i+1)/(a.length + 1)} l1 0`) : [],
                            ...yTicks.right  ? yTicks.right .map((_, i, a) => `M0 ${(i+1)/(a.length + 1)} l1 0`) : []
                        ].join(" ")}
                    />
                </svg>

                {/* Axis Quantities --- */}
                <div 
                    className={`absolute size-full ${graphClassName}`}
                >
                    {xTicks.bottom && xTicks.bottom.map((label, i, a) => 
                        <AxisText side="b" loc={(i+1)/(a.length+1)} key={i}>{label}</AxisText>)}
                    {xTicks.top && xTicks.top.map((label, i, a) =>
                        <AxisText side="t" loc={(i+1)/(a.length+1)} key={i}>{label}</AxisText>)}
                    {yTicks.left && yTicks.left.reverse().map((label, i, a) =>
                        <AxisText side="l" loc={(i+1)/(a.length+1)} key={i}>{label}</AxisText>)}
                    {yTicks.right && yTicks.right.reverse().map((label, i, a) =>
                        <AxisText side="r" loc={(i+1)/(a.length+1)} key={i}>{label}</AxisText>)}
                </div>

                {/* Data --- */}
                {/* We plot each line as it's own svg(s) as this as scaling is complicated otherwise */}
                {
                    optimizedLines.map(line => (
                        (line.data.length > 0 &&
                            <Fragment key={line.label}>
                                {/* Line and fill (if applicable) */}
                                {/* Fill (if applicable) --- */}
                                {line.underFill && (
                                    <svg 
                                        className={`absolute size-full ${graphClassName} overflow-hidden rounded-md`}
                                        preserveAspectRatio="none"
                                        viewBox="0 0 1 1"
                                    >
                                        {[
                                            ...line.optimizedData.filter(ol => ol.length >= 2).map((ol, i) => (
                                                <polygon 
                                                    points={`${ol[0].x},1 ${ol.map(({x, y}) => `${x},${1-y}`).join(" ")} ${ol[ol.length - 1].x},1`} 
                                                    className={`${line.color.fill} opacity-30`}
                                                    key={i}
                                                />
                                            ))
                                        ]}
                                    </svg>
                                )}
                                {/* Line --- */}
                                <svg 
                                    className={`absolute size-full ${graphClassName} ${line.points ? "overflow-visible" : "overflow-hidden rounded-md"}`}
                                    preserveAspectRatio="none"
                                    viewBox="0 0 1 1"
                                >
                                    {[
                                        ...line.optimizedData.filter(ol => ol.length >= 2).map((ol, i) => (
                                            <path 
                                                key={i} 
                                                vectorEffect="non-scaling-stroke"
                                                className={`fill-none ${line.color.stroke} stroke-2`}
                                                d={`M${ol[0].x} ${1 - ol[0].y} ` +
                                                    ol.slice(1).map(({x, y}) => `L${x} ${1 - y}`).join(" ")} 
                                            />
                                        ))
                                    ]}
                                </svg>
                                {/* Points (if applicable) --- */}
                                {line.points && (
                                    <svg
                                        className={`absolute size-full ${graphClassName} overflow-visible`}
                                        // No viewbox, we use percentages for this so that circle sizing is correct 
                                    >
                                        {line.data.filter(({y}) => y !== null).map(({x, y}, i) => (
                                            <circle 
                                                cx={x * 100 + "%"} 
                                                cy={(1 - y!) * 100 + "%"} 
                                                r="0.2rem" 
                                                className={`${line.color.fill}`}
                                                key={i}
                                            />
                                        ))}
                                    </svg>
                                )}
                            </Fragment>
                        )
                    ))
                }
            </div>

            {/* Legend --- */}
            <div className="flex flex-row flex-wrap gap-1">
                {
                    lines.reverse().map(line => (
                        (line.data.length > 0 &&
                            <div key={line.label} className="flex h-6 flex-row items-center gap-1 rounded-md bg-gray-950 px-2 text-nowrap">
                                <div className={`size-3 rounded-full ${line.color.bg}`} />
                                <span>{line.label}</span>
                            </div>
                        )
                    ))
                }
            </div>
        </div>
    );
}

/**
 * Text that indicates the quanity an axis represents
 * @param side - The side of the graph that this should be placed against. The quanity this represents is in the perpendicular direction.
 * @param loc - The distance along the given axis this text should be, as a value in [0,1]. 0 is left and 0 is top.
 */
const AxisText = ({ side, loc, children }: { side: "b"|"t"|"l"|"r", loc: number, children: ReactNode }) => (
    <span className="absolute bg-gray-800 text-xs text-gray-600" style={{ 
        transform: `translate${{ "b": "X", "t": "X", "l": "Y", "r": "Y" }[side]}(-50%)`,
        left: { "b": `${loc * 100}%`, "t": `${loc * 100}%`, "l": "0.5rem", "r": undefined }[side],
        right: { "b": undefined, "t": undefined, "l": undefined, "r": "0.5rem" }[side],
        top: { "b": undefined, "t": "0.5rem", "l": `${loc * 100}%`, "r": `${loc * 100}%` }[side],
        bottom: { "b": "0.5rem", "t": undefined, "l": undefined, "r": undefined }[side]
    }}>
        {children}
    </span>
);
