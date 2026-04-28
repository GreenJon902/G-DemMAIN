"use client";

import { useState, useEffect, Fragment } from "react";
import { PanelData, loadPanelDataAction } from "../actions";
import PanelPageSection from "../ui/PanelPageSection";
import { GraphDataGroupGraph, MinecraftTpsHeapGraph } from "../ui/Graphs";

export default function ActualPage({ initialData }: { initialData: PanelData }) {  // TODO Don't fetch whole of panel data, but only the graph data
    
    // TODO: Can this idea be generalised with the panel/ActualPage.tsx
    // TODO: The polling rate can probably be derived from the timespan
    // Keep track of the current timestamp so we can indicate how out of data data is
    const [currentTimestamp, setCurrentTimestamp] = useState(initialData.timestamp);  // TODO: We don't actually use this
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
                <div className="grid w-full gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4">  {/* TODO: Generalise this div? */}
                    <GraphDataGroupGraph 
                        data={data.graphData.sys}
                        totMem={data.graphData.meta.totMem}
                        what="sys"
                        timeSpan={data.graphData.meta.timeSpan}
                    />
                </div>
            </PanelPageSection>
            <PanelPageSection title="Minecraft">
                <MinecraftTpsHeapGraph 
                    data={data.graphData.mc} 
                    allocated={data.graphData.meta.mc.totMem} 
                    timeSpan={data.graphData.meta.timeSpan}
                />
            </PanelPageSection>
            <PanelPageSection title="Services">
                <div className="grid w-full gap-4 sm:grid-cols-1 md:grid-cols-3">  {/* TODO: Generalise this div? */}
                    {Object.entries(data.graphData.services).map(([key, value]) => (
                        <Fragment key={key}>
                            <GraphDataGroupGraph 
                                data={value}
                                totMem={data.graphData.meta.totMem}
                                what={key}
                                timeSpan={data.graphData.meta.timeSpan}
                            />
                        </Fragment>
                    ))}
                </div>
            </PanelPageSection>
        </>
    );
}


