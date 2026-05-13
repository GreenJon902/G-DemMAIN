"use client";
import { loadPanelDataAction } from "../actions";
import { Fragment } from "react/jsx-runtime";
import PanelPageSection from "../ui/PanelPageSection";
import { GraphDataGroupGraph, MinecraftTpsHeapGraph } from "../ui/Graphs";

export default function GraphPageContent({
    data 
}: {
    data: Awaited<ReturnType<typeof loadPanelDataAction>> 
}) {
    return (
        <>
            <PanelPageSection title="System">
                <div className="grid w-full gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4">  
                    <GraphDataGroupGraph 
                        data={data.graphData.sys}
                        totMem={data.graphData.meta.totMem}
                        what="System"
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
                <div className="grid w-full gap-4 sm:grid-cols-1 md:grid-cols-3">  
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
