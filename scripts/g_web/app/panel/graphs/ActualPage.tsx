"use client";

import { useState, useEffect, Fragment } from "react";
import { GraphKey, PanelData, loadPanelDataAction } from "../actions";
import PanelPageSection from "../ui/PanelPageSection";
import { LINE_CYAN, LINE_FUCHSIA, LINE_GRAY, LINE_BLUE, LINE_ROSE, LINE_VIOLET, NLineGraph, PointAndFillGraph, LINE_LIME } from "../ui/Graph";

export default function ActualPage({ initialData }: { initialData: PanelData }) {  // TODO Don't fetch whole of panel data, but only the graph data
    
    // TODO: Can this idea be generalised with the panel/ActualPage.tsx
    // Keep track of the current timestamp so we can indicate how out of data data is
    const [currentTimestamp, setCurrentTimestamp] = useState(initialData.timestamp);
    useEffect(() => {
        const interval = setInterval(async () => {
            setCurrentTimestamp(Date.now());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Keep the state of the units and system-resources up to date
    const [data, setData] = useState(initialData);
    useEffect(() => {
        // Use a timeout for this so we don't get behind if the internet is bad
        let timeout: ReturnType<typeof setTimeout>;
        let cancelled = false;  // If pullData is running when it get's cancelled, then we would clear the wrong timeout id. This handles that case

        const pullData = async () => {
            if (cancelled) return;
            try {
                setData(await loadPanelDataAction());
                setCurrentTimestamp(Date.now());  // Refresh here too as otherwise data.timestamp will be larger than currentTimestamp
            } catch (e) {
                console.error(e);
            }
            timeout = setTimeout(pullData, 6000);
        };
        timeout = setTimeout(pullData, 6000);

        return () => {
            clearTimeout(timeout);
            cancelled = true;
        };
    }, []);

    return (
        <>
            <PanelPageSection title="System">
                <div className="grid lg:grid-cols-4 md:grid-cols-2 sm:grid-cols-1 gap-4 w-full">  {/* TODO: Generalise this div? */}
                    {/* Total CPU and sysem RAM  // TODO: This is the same as renders on the main panel page, we shouldn't duplicate this?*/}
                    <PointAndFillGraph 
                        pointData={data.graphData["sys.cpu"]} pointLabel="CPU" pointColor={LINE_CYAN}
                        fillData={data.graphData["sys.mem"]} fillLabel="RAM" fillColor={LINE_GRAY}
                        xTicks={{ bottom: ["-3m", "-2m", "-1m"] }}
                        yTicks={{ left: ["25%", "50%", "75%"], right: ["2GB", "4GB", "6GB"] }}  // TODO: Don't hardcode ram
                        containerClassName="min-w-50 flex-1" graphClassName="h-50"
                    />
                    {/* Individual CPUs */}
                    <NLineGraph 
                        datas={[data.graphData["sys.cpu.1"], data.graphData["sys.cpu.2"], data.graphData["sys.cpu.3"], data.graphData["sys.cpu.4"]]}  // TODO: Can we not hardcode these, or at least make this take up less chars
                        colors={[LINE_BLUE, LINE_VIOLET, LINE_FUCHSIA, LINE_ROSE]}
                        labels={["CPU 1", "CPU 2", "CPU 3", "CPU 4"]}
                        xTicks={{ bottom: ["-3m", "-2m", "-1m"] }}
                        yTicks={{ left: ["25%", "50%", "75%"] }} 
                        containerClassName="min-w-50 flex-1" graphClassName="h-50"
                    />
                    {/* Network up and down */}
                    <NLineGraph 
                        {...normalizeData("MB/s", data.graphData["sys.network.up"], data.graphData["sys.network.down"])}
                        colors={[LINE_CYAN, LINE_FUCHSIA]}
                        labels={["Network Up", "Network Down"]}
                        underFill={true}
                        xTicks={{ bottom: ["-3m", "-2m", "-1m"] }}
                        containerClassName="min-w-50 flex-1" graphClassName="h-50"
                    />
                    {/* Disk read and write*/}
                    <NLineGraph 
                        {...normalizeData("MB/s", data.graphData["sys.disk.read"], data.graphData["sys.disk.write"])}
                        colors={[LINE_VIOLET, LINE_ROSE]}
                        labels={["Disk Reads", "Disk Writes"]}
                        underFill={true}
                        xTicks={{ bottom: ["-3m", "-2m", "-1m"] }}
                        containerClassName="min-w-50 flex-1" graphClassName="h-50"
                    />
                </div>
            </PanelPageSection>
            <PanelPageSection title="Minecraft">
                {/* TPS and heap. TODO: This is a repeated graph from the main panel, can we collapse this somehow? */}
                <PointAndFillGraph 
                    pointData={data.graphData["mc.tps"]} pointLabel="Minecraft TPS" pointColor={LINE_LIME}
                    fillData={data.graphData["mc.mem"]} fillLabel="Minecraft Heap" fillColor={LINE_GRAY}
                    xTicks={{ bottom: ["-3m", "-2m", "-1m"] }}
                    yTicks={{ left: ["5TPS", "10TPS", "15TPS"], right: ["25% - 0.75GB", "50% - 1.50GB", "75% - 2.25GB"] }} // TODO: Don't hard code these RAM quantities
                    containerClassName="min-w-50 flex-1" graphClassName="h-50"
                />
            </PanelPageSection>
            {/* Services */}
            <PanelPageSection title="Services">
                <div className="grid md:grid-cols-3 sm:grid-cols-1 gap-4 w-full">  {/* TODO: Generalise this div? */}
                    {["g_mc", "g_web", "mysql"].map(service => (
                        <Fragment key={service}>
                            {/* CPU and Memory */}
                            <PointAndFillGraph 
                                pointData={data.graphData[`${service}.cpu` as GraphKey]} pointLabel={`${service} CPU`} pointColor={LINE_CYAN}
                                fillData={data.graphData[`${service}.mem` as GraphKey]} fillLabel={`${service} RAM`} fillColor={LINE_GRAY}
                                xTicks={{ bottom: ["-3m", "-2m", "-1m"] }}
                                yTicks={{ left: ["25%", "50%", "75%"], right: ["2GB", "4GB", "6GB"] }}  /* TODO: Don't hardcode ram */
                                containerClassName="min-w-50 flex-1" graphClassName="h-50"
                            />
                            {/* Network up and down */}
                            <NLineGraph 
                                {...normalizeData("MB/s", data.graphData[`${service}.network.up` as GraphKey], data.graphData[`${service}.network.down` as GraphKey])}
                                colors={[LINE_CYAN, LINE_FUCHSIA]}
                                labels={[`${service} Network Up`, `${service} Network Down`]}
                                underFill={true}
                                xTicks={{ bottom: ["-3m", "-2m", "-1m"] }}
                                containerClassName="min-w-50 flex-1" graphClassName="h-50"
                            />
                            {/* Disk read and write*/}
                            <NLineGraph 
                                {...normalizeData("MB/s", data.graphData[`${service}.disk.read` as GraphKey], data.graphData[`${service}.disk.write` as GraphKey])}
                                colors={[LINE_VIOLET, LINE_ROSE]}
                                labels={[`${service} Disk Reads`, `${service} Disk Writes`]}
                                underFill={true}
                                xTicks={{ bottom: ["-3m", "-2m", "-1m"] }}
                                containerClassName="min-w-50 flex-1" graphClassName="h-50"
                            />
                        </Fragment>
                    ))}
                </div>
            </PanelPageSection>
        </>
    );
}


/**
 * Scales data that isn't in a fixed range to be in the interval [0,1]. This also returns labels that can be put on the y-axis.
 * This expects the data to be in the range [0,inf).
 * @param datas - The datas that should fit within the axis.
 * @param units - The units to append after the axis ticks.
 */
function normalizeData(units: string, ...datas: number[][]) {
    const max = Math.max(...datas.map(data => Math.max(...data)));
    const labels = [0.25, 0.5, 0.75].map(n => `${(n*max).toFixed(2)}` + units)
    const normalized = datas.map(data => data.map(n => n / max));
    return { datas: normalized, yTicks: { left: labels } }
}
