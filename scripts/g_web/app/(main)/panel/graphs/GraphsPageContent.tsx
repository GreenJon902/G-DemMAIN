"use client";
import PanelPageSection from "../ui/PanelPageSection";
import { CpuRamGraph, MultiCPUGraph, TransferGraph } from "../ui/Graphs";
import { loadGraphDataAction } from "./actions";

export default function GraphPageContent({
    data 
}: {
    data: Awaited<ReturnType<typeof loadGraphDataAction>> 
}) {
    const gd = data.data;
    return (
        <>
            <PanelPageSection title="System">
                <div className="grid w-full gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4">  
                    <CpuRamGraph
                        data={gd.map(d => ({ time: d.time, cpu: d.sys_cpu?.agg, mem: d.sys_mem?.used }))}
                        totMem={gd[0]?.sys_mem?.total ?? null}
                        what="System"
                    />
                    <MultiCPUGraph
                        data={gd.map(d => ({ time: d.time, cpus: d.sys_cpu?.ind as unknown as { [ cpuno: string ]: number } }))}
                    />
                    <TransferGraph
                        data={gd.map(d => ({ time: d.time, in: d.sys_net_io?.agg.recieved, out: d.sys_net_io?.agg.sent }))}
                        inDisplayName="System Network Down"
                        outDisplayName="System Network Up"
                        colorScheme={1}
                        units="MB/s"
                        multiplier={1024**-2}
                    />
                    <TransferGraph
                        data={gd.map(d => ({ time: d.time, in: d.sys_disk_io?.agg.read, out: d.sys_disk_io?.agg.written }))}
                        inDisplayName="System Disk Reads"
                        outDisplayName="System Disk Writes"
                        colorScheme={0}
                        units="MB/s"
                        multiplier={1024**-2}
                    />
                </div>
            </PanelPageSection>
            {/**
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
            */}
        </>
    );
}
