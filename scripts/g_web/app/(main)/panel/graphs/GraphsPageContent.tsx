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
    const disk_usage = gd[gd.length - 1]?.sys_disk_usage;  // We only want one value as we don't plot this against time
    return (
        <>
            <PanelPageSection title="System">
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
                    <table className="w-full">
                        <tbody>
                            {
                                disk_usage &&
                                [...disk_usage.entries()].map(([mountpoint, metrics]) => (
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
                            }
                        </tbody>
                    </table>
                </div>
            </PanelPageSection>
            { /*  TODO: MC TPS, and java heap memory usage */ }
            <PanelPageSection title="CGroups">
                {
                    Array.from(gd[0].cgroups.keys().map(cgname => (
                        <PanelPageSection pretitle={"• "} title={`${cgname}`} key={cgname}>
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
                                        inDisplayName="CGroup Disk Reads"
                                        outDisplayName="CGroup Disk Writes"
                                        colorScheme={0}
                                        units="MB/s"
                                        multiplier={1024**-2}
                                    />
                                </div>
                                <table>
                                    <thead>
                                        <tr className="border-b">
                                            <th className="border-r p-1 text-left">PID</th>
                                            <th className="w-full p-1 text-left">Command</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {
                                            [...gd[gd.length - 1]?.cgroups.get(cgname)?.procs?.entries() ?? []].map(([pid, cmd]) => (
                                                <tr key={pid}>
                                                    <td className="border-r p-1">{pid}</td>
                                                    <td className="w-full p-1">
                                                        <pre className="rounded-lg bg-gray-950 text-wrap"> {cmd} </pre>
                                                    </td>
                                                </tr>
                                            ))
                                        }
                                    </tbody>
                                </table>
                            </div>
                        </PanelPageSection>
                    )))
                }
            </PanelPageSection>
        </>
    );
}

