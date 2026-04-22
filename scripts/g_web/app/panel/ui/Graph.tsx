"use_client";

import { ReactNode } from "react";
import { GraphData, GraphKey } from "../actions";

const _makeCol = (stroke: string, bg: string) => ({ stroke, bg });  // We need full names so the Tailwind compiler will work
const COLOR_MAP: Record<GraphKey, { stroke: string, bg: string }> = {
    "mc.tps": _makeCol("stroke-green-600", "bg-green-600"),
    "g_mc.cpu": _makeCol("stroke-yellow-600", "bg-yellow-600"),
    "g_mc.mem": _makeCol("stroke-red-600", "bg-red-600"),
    "sys.cpu1": _makeCol("stroke-gray-100", "bg-gray-100"),
    "sys.cpu2": _makeCol("stroke-gray-300", "bg-gray-300"),
    "sys.cpu3": _makeCol("stroke-gray-500", "bg-gray-500"),
    "sys.cpu4": _makeCol("stroke-gray-700", "bg-gray-700"),
    "sys.mem": _makeCol("stroke-orange-600", "bg-orange-600")
};

/**
 * A component that visualises the data for the given keys.
 * Data could contain more data and it would be ignored.
 *
 * @param data - The data that could be plotted.
 * @param keys - The specific datas that should be plotted.
 * @param keys - Optional className data to give to the returned component. E.g. "h-50"
 */
export default function Graph({ data, keys, className="" } : { data: GraphData, keys: GraphKey[], className?: string }) {
    return (
        <div className={`${className} flex flex-col gap-1`}>  {/* A div to control the scaling */}
            {/* Graph --- */}
            <div className="relative flex-1 border-3 border-gray-300">
                {/* Background --- */}
                <svg 
                    viewBox={"0 0 1 1"} 
                    preserveAspectRatio="none"
                    className="absolute size-full bg-gray-800"
                >
                    <path 
                        vectorEffect="non-scaling-stroke"
                        className="fill-none stroke-gray-600"
                        d="M0.25 0 L0.25 1 M0.5 0 L0.5 1 M0.75 0 L0.75 1 M0 0.25 L1 0.25 M0 0.5 L1 0.5 M0 0.75 L1 0.75"
                    />
                </svg>

                {/* Axis Quantities --- */}
                <div 
                    className="absolute size-full"
                >
                    <AxisText axis="x" perc={75}>-15s</AxisText>
                    <AxisText axis="x" perc={50}>-30s</AxisText>
                    <AxisText axis="x" perc={25}>-45s</AxisText>
                    <AxisText axis="y" perc={25}>25%</AxisText>
                    <AxisText axis="y" perc={50}>50%</AxisText>
                    <AxisText axis="y" perc={75}>75%</AxisText>
                </div>

                {/* Data --- */}
                <svg 
                    className="absolute size-full" 
                    viewBox="0 0 1 1"
                    preserveAspectRatio="none"
                >
                    {
                        keys.map(key => (
                            <path 
                                key={key} 
                                vectorEffect="non-scaling-stroke"
                                className={`fill-none ${COLOR_MAP[key].stroke} stroke-2`}
                                d={`M0 ${data[key][0]} ` +
                                    data[key].slice(1).map((n, i, a) => `L${(i + 1)/a.length} ${n}`).join(" ")} 
                            />
                        ))
                    }
                </svg>
            </div>

            {/* Legend --- */}
            <div className="flex flex-row flex-wrap gap-1">
                {
                    keys.map(key => (
                        <div key={key} className="flex h-6 flex-row items-center gap-1 rounded-md bg-gray-950 px-2 text-nowrap">
                            <div className={`size-3 rounded-full ${COLOR_MAP[key].bg}`} />
                            <span>{key}</span>
                        </div>
                    ))
                }
            </div>
        </div>
    );
}

/**
 * Text to be put on an axis. 
 * This is centred in the direction of the given axis, and placed against the edge on the other axis.
 * @param axis - The axis this is information the value of.
 * @param perc - The percentage along the given axis this text should be.
 */
const AxisText = ({ axis, perc, children }: { axis: "x"|"y", perc: number, children: ReactNode }) => (
    <span className="absolute bg-gray-800 text-xs text-gray-600" style={{ 
        transform: `translate${axis.toUpperCase()}(${axis === "x" ? "-" : ""}50%)`,
        left: axis === "x" ? `${perc}%` : "0.5rem",
        bottom: axis === "y" ? `${perc}%` : "0.5rem"
    }}>
        {children}
    </span>
);
