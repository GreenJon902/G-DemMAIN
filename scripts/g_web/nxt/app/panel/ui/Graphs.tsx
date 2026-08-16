/**
 * This file contains different graph presets/templates that are used frequently.
 */

import { BaseUnit, BYTES, humanize, PERCENTAGE, rebase, SECONDS, TPS } from "@/lib/unitUtils";
import { latestDefined, memPoint, tpsPoint } from "@/lib/graphUtils";
import type { Mem, Tps } from "@/lib/panelUtils";
import { Graph, LINE_COLORS, LINE_CYAN, LINE_FUCHSIA, LINE_GRAY, LINE_LIME, LINE_ROSE, LINE_VIOLET } from "./Graph";

type nunumber = null | undefined | number;

// Builds the Graph line(s) for a Mem series. A plain snapshot series is a single filled line, same as before.
// An aggregate series additionally draws the min and max, each underfilled to the baseline with no stroke of
// their own (approximating a band, since they share a color and both fill to the same baseline), with the
// mean drawn as a plain line on top.
function memGraphLines(data: Array<{ time: number, mem: Mem | null | undefined }>, max: number | null | undefined, label: string) {
    const points = data.map(({ time, mem }) => ({ time, ...memPoint(mem) }));
    const hasAggregate = points.some(p => p.min !== null || p.max !== null);
    const ret = prepareData(points, max, true, rebase(BYTES, 10**3), "", "value", "min", "max");
    return {
        lines: !ret ? [] : [
            ...hasAggregate ? [
                { data: ret.props.max, color: LINE_GRAY, label: `${label} (max)`, underFill: true, stroke: false, legend: false },
                { data: ret.props.min, color: LINE_GRAY, label: `${label} (min)`, underFill: true, stroke: false, legend: false }
            ] : [],
            { data: ret.props.value, color: LINE_GRAY, label, underFill: !hasAggregate }
        ],
        yTicks: ret?.yTicks
    };
}

/**
 * @param data - The data to plot. If a value is not given, then it will be ignored.
 * @param totMem - The total memory installed on the system, if this is undefined then no memory line will be drawn.
 * @param noCores - The number of cores in the system.
 * @param what - What is the name of this, e.g. "sys" or "g_mc".
 */
export function CpuRamGraph({
    data, totMem, what, noCores
}: {
    data: Array<{ time: number, cpu: nunumber, mem: Mem | null | undefined }>,
    totMem: number | null,
    noCores: number | null,
    what: string,
}) {
    const cpuRet = prepareData(data.map(({ time, cpu }) => ({
        time,
        cpu: (cpu === null || cpu === undefined) ? null : (cpu * (noCores ?? 1) * 100)  // Scale cpu to a proper percentage (sum of percentage for each core (so can be over 100%))
    })), (noCores ?? 1) * 100, false, PERCENTAGE, "", "cpu");                           // If we don't know the number of cores then assume 1. It doesn't really matter
    const mem = memGraphLines(data, totMem, `${what} RAM`);
    return (
        <Graph
            lines={[
                ...mem.lines,
                ...(cpuRet) ? [{ data: cpuRet?.props.cpu, color: LINE_CYAN, label: `${what} CPU`, points: true}] : []
            ]}
            xTicks={{ bottom: cpuRet?.xTicks }}  // cpuRet's xTicks should be the same as mem's xTicks
            yTicks={{ left: cpuRet?.yTicks , right: mem.yTicks }}
            containerClassName="min-w-50 flex-1"
            graphClassName="h-50"
        />
    );
}

/**
 * @param data - The data to plot. If a value is not given, then it will be ignored.
 * @param allocatedMem - The heap's -Xmx ceiling, if this is undefined then no memory line will be drawn.
 */
export function TpsHeapGraph({
    data, allocatedMem
}: {
    data: Array<{ time: number, tps: Tps | null | undefined, mem: Mem | null | undefined }>,
    allocatedMem: number | null,
}) {
    const tpsPoints = data.map(({ time, tps }) => ({ time, ...tpsPoint(tps) }));
    const hasAggregateTps = tpsPoints.some(p => p.min !== null || p.max !== null);
    const tpsRet = prepareData(tpsPoints, 20, false, TPS, "", "value", "min", "max");  // TPS is capped at 20
    const mem = memGraphLines(data, allocatedMem, "MC RAM");
    return (
        <Graph
            lines={[
                ...mem.lines,
                ...(tpsRet && hasAggregateTps) ? [{ data: tpsRet.props.min, upperData: tpsRet.props.max, color: LINE_LIME, label: "MC TPS (range)", legend: false }] : [],
                ...(tpsRet) ? [{ data: tpsRet?.props.value, color: LINE_LIME, label: "MC TPS", points: true}] : []
            ]}
            xTicks={{ bottom: tpsRet?.xTicks }}  // tpsRet's xTicks should be the same as mem's xTicks
            yTicks={{ left: tpsRet?.yTicks , right: mem.yTicks }}
            containerClassName="min-w-50 flex-1"
            graphClassName="h-50"
        />
    );
}

/**
 * The cpu with the lowest number will be drawn on top.
 * @param data - The data to plot. If a value is not given, then it will be ignored. The CPU key is expected to not contain the text cpu.
 */
export function MultiCPUGraph({
    data
}: { 
    data: Array<{ time: number, cpus: Map<string, nunumber> | undefined }>,
}) {

    const flattened = data.map(d => ({
        time: d.time,
        ...((d.cpus) ? Object.fromEntries(d.cpus.entries()) : {}) as {[cpuno: string]: number}
    }));
    const keys = Array.from(latestDefined(data, d => d.cpus)?.keys() ?? []).sort().reverse();
    const prepped = prepareData(flattened, 1, true, undefined, "", ...keys);

    return (
        <Graph 
            lines={[
                ...(prepped) ? 
                    keys.map((k, i) => ({ data: prepped?.props[k], color: LINE_COLORS[i], label: `CPU ${k}` }))
                    : []
            ]}
            xTicks={{ bottom: prepped?.xTicks }}  // cpuRet's xTicks should be the same as memRet's xTicks
            yTicks={{ left: prepped?.yTicks }}
            containerClassName="min-w-50 flex-1" 
            graphClassName="h-50"
        />
    );
}

/**
 * @param data - The data to plot. 'in' is coming towards the cpu (network recieved, disk read), 'out' is away (sent, written).
 * @param inDisplayName - What is the name of incoming data (e.g. "read"). This is rendered to the user.
 * @param units - The units of the data.
 * @param colorScheme - 0 for cyan and fuchsia, 1 for violet and rose.
 * @param inShortName - A short piece of text to be put after the units to indicate these units correspond to incoming data.
 */
export function TransferGraph({
    data, inDisplayName, outDisplayName, units, colorScheme, inShortName, outShortName
}: {
    data: Array<{ time: number, in: nunumber, out: nunumber }>,
    inDisplayName: string,
    outDisplayName: string,
    units: BaseUnit,
    colorScheme: 0 | 1,
    inShortName: string,
    outShortName: string
}) {
    const inPrep = prepareData(data, undefined, false, units, `/s ${inShortName}`, "in");
    const outPrep = prepareData(data, undefined, false, units, `/s ${outShortName}`, "out");
    const in_ = inPrep?.props.in;
    const out = outPrep?.props.out;

    return (
        <Graph 
            lines={[
                ...(outPrep) ? [{ data: out!, color: colorScheme ? LINE_CYAN : LINE_VIOLET, label: outDisplayName, underFill: true}] : [],
                ...(inPrep) ? [{ data: in_!, color: colorScheme ? LINE_FUCHSIA : LINE_ROSE, label: inDisplayName, underFill: true}] : []
            ]}
            xTicks={{ bottom: inPrep?.xTicks }}   // xTicks should be the same for both of these
            yTicks={{ left: inPrep?.yTicks, right: outPrep?.yTicks }}
            containerClassName="min-w-50 flex-1" 
            graphClassName="h-50"
        />
    );

}

/**
 * The given props must exist in the data.
 * This expects the time to be in the range (-inf,0].
 * Returns {
 *     data: Array<{ 
 *          x: time - in range [0, 1],
 *          y: value - in range [0, 1]  | null
 *     >],
 *     yTicks: an array of strings from bottom to top,
 *     xTicks: an array of string from left to right
 * } or null
 *
 * @param max - Optional maximum value. If this is given then it will be used, if this is null then null will be returned, if this is undefined then we will attempt to calculate a maximum value.
 * @param props - The properties in the data object that we are preparing.
 * @param percentage - Should axis ticks contain a percentage.
 * @param units - The units of the axis ticks, or undefined to not render absolute values. Undefined will force a percentage to render.
 * @param unitSuffix - The suffix of the units (e.g. /s). Set to an empty string for none.
 */
function prepareData(data: Array<{ time: number, [ k: string]: nunumber }>, max: number | null | undefined, percentage: boolean, units: BaseUnit | undefined, unitSuffix: string, ...props: string[]) {
    // Check if return
    if (max === null) return null;  // We wanted to supply a maximum, but there is missing data in the data source
    // Calculate timespan
    const timespan = -Math.min(...data.map(d => d.time).filter(x => x !== undefined));  // Remember times are negative. Also calculate before filting data as other data on the graph may be defined at different points
    
    // If no maximum given then calculate it to be the highest value we have seen.
    if (max === undefined) {
        max = Math.max(...props.map(prop => Math.max(...data.map(d => d[prop] ?? -1))));
        if (max < 0) return null;  // Failed to calculate maximum (-Infinity is if no valid data)

        // We can't have a maximum of zero as then normalisation will return NaN. So set to one
        if (max === 0) {
            max = 1;
        }
    }
    
    return {
        props: Object.fromEntries(props.map(prop => {
            // Normalise and return
            return [
                prop, 
                data.map(d => ({
                    x: 1 + d.time / timespan,  // Normalise value
                    y: (d[prop] === undefined || d[prop] === null) ? null : d[prop] / max  // Normalise values
                }))
            ];
        })),
        yTicks: (units === undefined) ? 
            ["25%", "50%", "75%"]  // No units so we must render percentage
            :
            humanize([0.25, 0.5, 0.75].map(n => max * n), units, { unitSuffix, baseInteger: true, percentageMax: (percentage) ? max : undefined }),
        xTicks: humanize([-0.75, -0.5, -0.25].map(n => n * timespan), SECONDS)
    };
}

