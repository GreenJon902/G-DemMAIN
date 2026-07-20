"use client";
import PageSection from "../../ui/PageSection";
import { CpuRamGraph, MultiCPUGraph, TpsHeapGraph, TransferGraph } from "../ui/Graphs";
import { loadGraphDataAction } from "./actions";
import RadioButtons from "@/app/ui/RadioButtons";
import { MonitorOption } from "@/lib/panelUtils";
import { BYTES, rebase } from "@/lib/unitUtils";

export default function GraphPageContent({
    data, setParam
}: {
    data: Awaited<ReturnType<typeof loadGraphDataAction>>,
    setParam: (param: MonitorOption) => void
}) {
    const gd = data.timed;
    return (
        <>
            {/* Monitor option selector: */}
            {/* 
                The value handling for this field is a bit weird.
                The refreshing-page parameters stores the current option.
                This is passed to the loadGraphDataAction, who returns it for this radio button to know what value to show.
                So when a button is clicked, it will set only the refreshing-page's parameters.
            */ }
            <div className="flex w-full flex-wrap items-center gap-2">
                <h1>
                    Select data source:
                </h1>
                <RadioButtons
                    className="flex-1"
                    choices={
                        // Sort options so buttons don't move arround
                        data.options
                            .sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
                            .sort((a, b) => a.interval - b.interval)
                    }
                    selected={data.currentOption}
                    setter={setParam}
                    nameConv={({interval, number}) => (number === undefined) ? `${interval}` : `${interval}_${number}`}
                />
            </div>
            
            {/* Actual graphs: */}
            <PageSection title="System">
                <div className="flex w-full flex-col gap-4">
                    <div className="grid w-full gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4">  
                        <CpuRamGraph
                            data={gd.map(d => ({ time: d.time, cpu: d.sys_cpu?.agg, mem: d.sys_mem?.used }))}
                            totMem={gd[0]?.sys_mem?.total ?? null}
                            noCores={gd[0]?.sys_cpu?.ind.size ?? null}
                            what="System"
                        />
                        <MultiCPUGraph
                            data={gd.map(d => ({ time: d.time, cpus: d.sys_cpu?.ind } ))}
                        />
                        <TransferGraph
                            data={gd.map(d => ({ time: d.time, in: d.sys_net_io?.agg?.recieved, out: d.sys_net_io?.agg?.sent }))}
                            inDisplayName="System Network Down" inShortName="down"
                            outDisplayName="System Network Up" outShortName="up"
                            colorScheme={1}
                            units={BYTES}
                        />
                        <TransferGraph
                            data={gd.map(d => ({ time: d.time, in: d.sys_disk_io?.agg?.read, out: d.sys_disk_io?.agg?.written }))}
                            inDisplayName="System Disk Reads" inShortName="read"
                            outDisplayName="System Disk Writes" outShortName="write"
                            colorScheme={0}
                            units={BYTES}  // In MB
                        />
                    </div>
                    <table className="w-full">
                        <tbody>
                            {
                                data.disk_usage ? 
                                    [...data.disk_usage.entries()].map(([mountpoint, metrics]) => (
                                        <tr key={mountpoint}>
                                            <td>
                                                <span className="text-nowrap">
                                                    {mountpoint}
                                                </span>
                                            </td>
                                            <td className="w-full px-2">
                                                <div className="h-2 flex-1 rounded-full bg-gray-700">
                                                    <div className="h-2 rounded-full bg-green-500" style={{width: `${metrics.used / metrics.total * 100}%`}} />
                                                </div>
                                            </td>
                                            <td>
                                                <span className="text-nowrap">
                                                    {(metrics.used / metrics.total * 100).toFixed(0)}%  
                                                </span> 
                                            </td>
                                            <td className="px-2"><span>-</span></td>
                                            <td className="text-right">
                                                <span className="text-nowrap">
                                                    {(metrics.used / 1_000_000_000).toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="px-1"><span>/</span></td>
                                            <td className="text-right">
                                                <span className="text-nowrap">
                                                    {(metrics.total / 1_000_000_000).toFixed(2)}GB 
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                    : 
                                    <span className="italic">Disk usage data not available!</span>
                            }
                        </tbody>
                    </table>
                </div>
            </PageSection>
            <PageSection title="Minecraft">
                <div className="flex w-full flex-wrap gap-4">
                    <TpsHeapGraph
                        data={gd.map(d => ({ time: d.time, tps: d.minecraft.tps, mem: d.minecraft.mem?.used }))}
                        allocatedMem={gd[0]?.minecraft.mem?.total ?? null}
                    />
                </div>
            </PageSection>
            <PageSection title="CGroups">
                {
                    Array.from(gd[0]?.cgroups.keys().map(cgname => (
                        <PageSection pretitle={"• "} title={`${cgname}`} key={cgname}>
                            <div className="flex flex-col gap-4">
                                <div className="grid w-full gap-4 sm:grid-cols-1 md:grid-cols-2">  
                                    <CpuRamGraph
                                        data={gd.map(d => ({ time: d.time, cpu: d.cgroups.get(cgname)?.cpu, mem: d.cgroups.get(cgname)?.mem?.used}))}
                                        totMem={gd[0]?.cgroups.get(cgname)?.mem?.total ?? null}
                                        noCores={gd[0]?.sys_cpu?.ind.size ?? null}
                                        what="CGroup"
                                    />
                                    <TransferGraph
                                        data={gd.map(d => ({ time: d.time, in: d.cgroups.get(cgname)?.disk_io?.read, out: d.cgroups.get(cgname)?.disk_io?.written }))}
                                        inDisplayName="CGroup Disk Reads" inShortName="read"
                                        outDisplayName="CGroup Disk Writes" outShortName="write"
                                        colorScheme={0}
                                        units={rebase(BYTES, 10**3)}  // Data is in KB 
                                    />
                                </div>
                                {
                                    data.cgroup_procs.get(cgname)
                                        ?
                                        <table>
                                            <thead>
                                                <tr className="border-b">
                                                    <th className="border-r p-1 text-left">PID</th>
                                                    <th className="w-full p-1 text-left">Command</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {
                                                    [...data.cgroup_procs.get(cgname)!.entries().map(([pid, cmd]) => (
                                                        <tr key={pid}>
                                                            <td className="border-r p-1">{pid}</td>
                                                            <td className="w-full p-1">
                                                                <pre className="rounded-lg bg-gray-950 text-wrap"> {cmd} </pre>
                                                            </td>
                                                        </tr>
                                                    ))]
                                                }
                                            </tbody>
                                        </table>
                                        :
                                        <span className="italic">Data for processes is unavailable!</span>
                                }
                            </div>
                        </PageSection>
                    )) ?? [])
                }
            </PageSection>
        </>
    );
}

