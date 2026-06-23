/**
 * This file contains different graph presets/templates that are used frequently.
 */

import { Graph, LINE_COLORS, LINE_CYAN, LINE_FUCHSIA, LINE_GRAY, LINE_ROSE, LINE_VIOLET } from "./Graph";

type nunumber = null | undefined | number;

/**
 * @param data - The data to plot. If a value is not given, then it will be ignored.
 * @param totMem - The total memory installed on the system, if this is undefined then no memory line will be drawn.
 * @param noCores - The number of cores in the system.
 * @param what - What is the name of this, e.g. "sys" or "g_mc".
 */
export function CpuRamGraph({
    data, totMem, what, noCores
}: { 
    data: Array<{ time: number, cpu: nunumber, mem: nunumber }>,
    totMem: number | null,
    noCores: number | null,
    what: string,
}) {
    const cpuRet = prepareData(data, 1, false, "%", (noCores ?? 1) * 100, "cpu");  // If we don't know the number of cores then assume 1. It doesn't really matter
    const memRet = prepareData(data, totMem, true, "GB", 1024**-2, "mem");
    return (
        <Graph 
            lines={[
                ...(memRet) ? [{ data: memRet?.props.mem, color: LINE_GRAY, label: `${what} RAM`, underFill: true}] : [],
                ...(cpuRet) ? [{ data: cpuRet?.props.cpu, color: LINE_CYAN, label: `${what} CPU`, points: true}] : []
            ]}
            xTicks={{ bottom: cpuRet?.xTicks }}  // cpuRet's xTicks should be the same as memRet's xTicks
            yTicks={{ left: cpuRet?.yTicks , right: memRet?.yTicks }}
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
    const keys = Array.from(data[data.length - 1]?.cpus?.keys() ?? []).sort().reverse();
    const prepped = prepareData(flattened, 1, true, undefined, 1, ...keys);

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
 * @param units - The units of the data (after scaling, see multiplier).
 * @param multiplier - How much to scale the data by before displaying it to the user.
 * @param colorScheme - 0 for cyan and fuchsia, 1 for violet and rose.
 * @param inShortName - A short piece of text to be put after the units to indicate these units correspond to incoming data.
 */
export function TransferGraph({
    data, inDisplayName, outDisplayName, units, multiplier, colorScheme, inShortName, outShortName
}: {
    data: Array<{ time: number, in: nunumber, out: nunumber }>,
    inDisplayName: string,
    outDisplayName: string,
    units: string,
    multiplier: number,
    colorScheme: 0 | 1,
    inShortName: string,
    outShortName: string
}) {
    const inPrep = prepareData(data, undefined, false, `${units} ${inShortName}`, multiplier, "in");
    const outPrep = prepareData(data, undefined, false, `${units} ${outShortName}`, multiplier, "out");
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
 * @param units - The units of the axis ticks, or undefined to not render absolute values.
 * @param tickMultiplier - The multiplier to scale values by so they fit the ticks.
 */
function prepareData(data: Array<{ time: number, [ k: string]: nunumber }>, max: number | null | undefined, percentage: boolean, units: string | undefined, tickMultiplier: number, ...props: string[]) {
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
        yTicks: [0.25, 0.5, 0.75].map(n => 
            (percentage ? `${n * 100}%` : "") +
                                     (percentage && units ? " - " : "") + 
                                     (units ? `${(max * tickMultiplier * n).toFixed(2)}${units}` : "")),
        xTicks: [-0.75, -0.5, -0.25].map(n => `${(n * timespan / 60).toFixed(2)}m`)
    };
}

