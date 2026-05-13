/**
 * This file contains different graph presets/templates that are used frequently.
 */

import { LINE_COLORS, LINE_CYAN, LINE_FUCHSIA, LINE_GRAY, LINE_LIME, LINE_ROSE, LINE_VIOLET, NLineGraph, PointAndFillGraph } from "./Graph";
import { GraphDataGroup } from "../actions";

export const MinecraftTpsHeapGraph = ({ 
    data: { tps, mem }, allocated, timeSpan
}: { 
    data: { tps: number[], mem: number[] },
    allocated: number,
    timeSpan: number
}) => {
    const scaledTps = scaleData("TPS", 20, tps, false);
    const scaledMem = scaleData("GB", allocated, mem, true);
    return (
        <PointAndFillGraph 
            pointData={scaledTps.data} pointLabel="Minecraft TPS" pointColor={LINE_LIME}
            fillData={scaledMem.data} fillLabel="Minecraft Heap" fillColor={LINE_GRAY}
            xTicks={{ bottom: makeXTicks(timeSpan) }}
            yTicks={{ left: scaledTps.ticks, right: scaledMem.ticks }}
            containerClassName="min-w-50 flex-1" graphClassName="h-50"
        />
    );
};

/**
 * @param data - The data to plot, this can optionally have multiple CPUs.
 * @param totMem - The total memory installed on the system.
 * @param what - What is the name of this, e.g. "sys" or "g_mc".
 * @param timeSpan - The time from the first to last datapoint.
 */
export const CpuRamGraph = ({
    data: { cpu, mem }, totMem, what, timeSpan
}: { 
    data: { cpu: number[], mem: number[] },
    totMem: number,
    what: string,
    timeSpan: number
}) => {
    const scaledMem = scaleData("GB", totMem, mem, true);
    return (
        <PointAndFillGraph 
            pointData={cpu} 
            pointLabel={`${what} CPU`} 
            pointColor={LINE_CYAN}
            fillData={scaledMem.data} 
            fillLabel={`${what} RAM`} 
            fillColor={LINE_GRAY}
            xTicks={{ bottom: makeXTicks(timeSpan) }}
            yTicks={{ left: ["25%", "50%", "75%"], right: scaledMem.ticks }}  
            containerClassName="min-w-50 flex-1" 
            graphClassName="h-50"
        />
    );
};

/**
 * @param data - The data to plot, this can optionally have multiple CPUs.
 * @param totMem - The total memory installed on the system.
 * @param what - What is the name of this, e.g. "sys" or "g_mc".
 * @param timeSpan - The time from the first to last datapoint.
 */
export const GraphDataGroupGraph = ({
    data, totMem, what, timeSpan
}: {
    data: GraphDataGroup & {
        cpus?: number[][]
    },
    totMem: number,
    what: string, 
    timeSpan: number
}) => {
    const normalizedNetwork = normalizeDatas("MB/s", data.network["up"], data.network["down"]);
    const normalizedDisk = normalizeDatas("MB/s", data.disk["read"], data.disk["write"]);
    return (
        <>
            {/* CPU and Memory */}
            <CpuRamGraph
                data={data}
                totMem={totMem}
                what={what}
                timeSpan={timeSpan}
            />
            {/* Extra CPU data (if given) */}
            {data.cpus && (
                <NLineGraph
                    datas={data.cpus}
                    colors={LINE_COLORS.slice(0, data.cpus.length)}
                    labels={data.cpus.map((_,i) => `CPU ${i}`)}
                    underFill={false}
                    xTicks={{ bottom: makeXTicks(timeSpan) }}yTicks={{ left: ["25%", "50%", "75%"] }}
                    containerClassName="min-w-50 flex-1" 
                    graphClassName="h-50"
                />
            )}
            {/* Network up and down */}
            <NLineGraph 
                datas={normalizedNetwork.datas}
                colors={[LINE_CYAN, LINE_FUCHSIA]}
                labels={[`${what} Network Up`, `${what} Network Down`]}
                underFill={true}
                xTicks={{ bottom: makeXTicks(timeSpan) }}yTicks={{ left: normalizedNetwork.ticks }}
                containerClassName="min-w-50 flex-1" 
                graphClassName="h-50"
            />
            {/* Disk read and write*/}
            <NLineGraph 
                datas={normalizedDisk.datas}
                colors={[LINE_VIOLET, LINE_ROSE]}
                labels={[`${what} Disk Reads`, `${what} Disk Writes`]}
                underFill={true}
                xTicks={{ bottom: makeXTicks(timeSpan) }}yTicks={{ left: normalizedDisk.ticks }}
                containerClassName="min-w-50 flex-1" 
                graphClassName="h-50"
            />
        </>
    );
};


/**
 * Scales data to be in the interval [0,1]. This also returns labels that can be put on the y-axis. This is as the actual Graph component requires data in this range.
 * This expects the data to be in the range [0,inf).
 * If every data-piece is 0 then the we set the upper edge of the graph to 1.
 * @param datas - The datas that should fit within the axis.
 * @param units - The units to append after the axis ticks.
 */
function normalizeDatas(units: string, ...datas: number[][]) {
    const max = Math.max(1, ...datas.map(data => Math.max(...data)));
    const labels = [0.25, 0.5, 0.75].map(n => `${(n*max).toFixed(2)}` + units);
    const normalized = datas.map(data => data.map(n => n / max));
    return { datas: normalized, ticks: labels };
}

/**
 * Scale the given data [0,max] to be in the range [0,1].
 * This also returns labels which can be put on the y-axis.
 * @param data - The data to be scaled.
 * @param max - The maximum value the given data can reach, and hence the value that becomes 1 when scaled.
 * @param units - The units to append after the axis ticks.
 * @param percentage - Do we include a percentage in the label.
 */
function scaleData(units: string, max: number, data: number[], percentage: boolean) {
    return {
        data: data.map(n => n / max),
        ticks: [0.25, 0.5, 0.75].map(n => (percentage ? `${n * 100}% - ` : "") + `${(max * n).toFixed(2)}${units}`)
    };
}

/**
 * Make the x-tick labels given that the data on the graph spans from [-timeSpan, 0].
 */
function makeXTicks(timeSpan: number) {
    return [-0.75, -0.5, -0.25].map(n => `${n * timeSpan / 60}m`);
}
