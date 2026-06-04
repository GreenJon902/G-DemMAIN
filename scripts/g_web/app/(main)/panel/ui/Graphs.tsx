/**
 * This file contains different graph presets/templates that are used frequently.
 */

import { Graph, LINE_COLORS, LINE_CYAN, LINE_FUCHSIA, LINE_GRAY, LINE_LIME, LINE_ROSE, LINE_VIOLET } from "./Graph";

/**
 * @param data - The data to plot. If a value is not given, then it will be ignored.
 * @param totMem - The total memory installed on the system, if this is undefined then no memory line will be drawn.
 * @param what - What is the name of this, e.g. "sys" or "g_mc".
 */
export function CpuRamGraph({
    data, totMem, what
}: { 
    data: Array<{ time: number, cpu: number | undefined, mem: number | undefined }>,
    totMem: number | null,
    what: string,
}) {
    const cpuRet = prepareData(data, 1, true, undefined, 1, "cpu");
    const memRet = prepareData(data, totMem, true, "GB", 1024**-2, "mem");
    return (
        <Graph 
            lines={[
                ...(cpuRet) ? [{ data: cpuRet?.props.cpu, color: LINE_CYAN, label: `${what} CPU`, points: true}] : [],
                ...(memRet) ? [{ data: memRet?.props.mem, color: LINE_GRAY, label: `${what} RAM`, underFill: true}] : []
            ]}
            xTicks={{ bottom: cpuRet?.xTicks }}  // cpuRet's xTicks should be the same as memRet's xTicks
            yTicks={{ left: cpuRet?.yTicks , right: memRet?.yTicks }}
            containerClassName="min-w-50 flex-1" 
            graphClassName="h-50"
        />
    );
}

/**
 * @param data - The data to plot. If a value is not given, then it will be ignored. The CPU key is expected to not contain the text cpu.
 */
export function MultiCPUGraph({
    data
}: { 
    data: Array<{ time: number, cpus: { [cpuno: string]: number } | undefined }>,
}) {

    console.log(data[0].cpus);
    const flattened = data.map(d => ({
        time: d.time,
        ...(d.cpus) ? d.cpus : {}
    }));
    const keys = (data[0].cpus) ? Object.keys(data[0].cpus) : [];
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
 * @param colorScheme - 0 for cyan and fuchsia, 1 for violet and rose
 */
export function TransferGraph({
    data, inDisplayName, outDisplayName, units, multiplier, colorScheme
}: {
    data: Array<{ time: number, in: number | undefined, out: number | undefined }>,
    inDisplayName: string,
    outDisplayName: string,
    units: string,
    multiplier: number,
    colorScheme: 0 | 1
}) {
    const prep = prepareData(data, undefined, false, units, multiplier, "in", "out");
    const in_ = prep?.props.in;
    const out = prep?.props.out;
    return (
        <Graph 
            lines={[
                ...(prep) ? [{ data: in_!, color: colorScheme ? LINE_FUCHSIA : LINE_ROSE, label: inDisplayName, underFill: true}] : [],
                ...(prep) ? [{ data: out!, color: colorScheme ? LINE_CYAN : LINE_VIOLET, label: outDisplayName, underFill: true}] : []
            ]}
            xTicks={{ bottom: prep?.xTicks }}  // TODO: These properly
            yTicks={{ left: prep?.yTicks }}
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
 *          time: in range [0, 1],
 *          value: in range [0, 1]
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
function prepareData(data: Array<{ time: number, [ k: string]: number | undefined }>, max: number | null | undefined, percentage: boolean, units: string | undefined, tickMultiplier: number, ...props: string[]) {
    // Check if return
    if (max === null) return null;  // We wanted to supply a maximum, but there is missing data in the data source
    // Calculate timespan
    const timespan = -Math.min(...data.map(d => d.time).filter(x => x !== undefined));  // Remember times are negative. Also calculate before filting data as other data on the graph may be defined at different points
    
    // If no maximum given then calculate it to be the highest value we have seen.
    if (max === undefined) {
        max = Math.max(...props.map(prop => Math.max(...data.filter(d => d[prop]).map(d => d[prop]!))));
        if (max < 0) return null;  // Failed to calculate maximum (-Infinity is if no valid data)
    }
    
    return {
        props: Object.fromEntries(props.map(prop => {
            // Remove missing datapoints
            data = data.filter(d => d[prop] !== undefined);
            // Normalise and return
            return [
                prop, 
                data.map(d => ({
                    x: 1 + d.time / timespan,  // Normalise value
                    y: d[prop]! / max  // Normalise values
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

