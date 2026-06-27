"use client";

import { ActionButton, BUTTON_GREEN, BUTTON_RED, BUTTON_YELLOW } from "./../ui/Button";
import PanelPageSection from "./ui/PanelPageSection";
import { loadPanelDataAction, Unit, unitAction } from "./actions";
import { CpuRamGraph } from "./ui/Graphs";
import { UnitStatus } from "@/lib/panelUtils";
import { makeAreaSudoGuard, useSudoModal } from "@/app/ui/SudoModal";

export default function PanelPageContent(
    { data }: { data: Awaited<ReturnType<typeof loadPanelDataAction>> }
) {
    const sudoModal = useSudoModal();
    const panelGuard = makeAreaSudoGuard("panel", sudoModal);
    const gd = data.graphData.timed;
    return ( 
        <>
            { /* Resource monitors -------------------------------------------------- */ }
            <PanelPageSection title="Important Graphs">
                <div className="flex w-full flex-wrap gap-4">
                    <CpuRamGraph
                        data={gd.map(d => ({ time: d.time, cpu: d.sys_cpu?.agg, mem: d.sys_mem?.used }))}
                        totMem={gd[0]?.sys_mem?.total ?? null}
                        noCores={gd[0]?.sys_cpu?.ind.size ?? null}
                        what="System"
                    />
                    { /*  TODO: MC TPS and heap mem usage*/ }
                </div>
            </PanelPageSection>
            { /* Service status -------------------------------------------------- */ }
            <PanelPageSection title="Units">
                <table className="w-full overflow-hidden rounded-md"><tbody>
                    {
                        data.unitsStatuses.map(({ unit, status }) => (
                            <tr className="odd:bg-gray-700 even:bg-gray-800" key={`${unit.name}.${unit.type}`}>
                                <td className="w-6 p-1">
                                    <StatusIndicator unit={unit} status={status} />
                                </td>
                                <td className="p-1">
                                    {unit.name}
                                    <span className="text-xs text-gray-400">
                                            .{unit.type}
                                    </span>
                                </td>
                                <td className="flex gap-1 p-1"> {/* All changing controls go into the same <td> as the frequent changing causes firefox to get confused and not render backgrounds correctly */}
                                    <UnitControls unit={unit} status={status} className="flex-1" guard={panelGuard} />
                                    {/* TODO: A warning before restart g_web or g_mysql as these may not be easy to revert without ssh access */}
                                </td>
                            </tr>
                        ))
                    }
                </tbody></table>
            </PanelPageSection>
        </>
    );

}


/**
 * Get the color associated with this status.
 * If the status is unkown then it's logged to the console and set to transparent.
 * @param status - This should be the systemd SubState.
 */
function StatusIndicator({ unit, status }: { unit: Unit, status: UnitStatus | undefined }) {
    // Get the color
    const color = { 
        "active": "bg-green-600", 
        "inactive": unit.expectActive ? "bg-orange-600" : "bg-cyan-600", 
        "failed": "bg-red-600", 
        "activating": "bg-yellow-600",
        "deactivating": "bg-yellow-600",
        "reloading": "bg-yellow-600",
        "undefined": "bg-gray-600"
    }[String(status)];

    // If we have no color then we don't recognise this status
    if (color === undefined) {
        // Error and just display text
        console.error("Unrecognised status", status);
        return status;  
    }
    
    // Create a circle with the first letter of status, with hover being full status name
    return <div className={`${color} aspect-square w-6 rounded-full text-center`} title={status}>
        {String(status)[0].toUpperCase()}
    </div>;
}

/**
 * Create the controls for the given unit.
 * @param className - This will be given to each child.
 */
function UnitControls({ unit, status, className="", guard }: { unit: Unit, status: UnitStatus | undefined, className?: string, guard: () => Promise<boolean> }) {

    if (
        status === "activating" ||
        status === "deactivating" ||
        !unit.controllable  // This needs to be first as the other clauses don't check for controllable-ness
    ) {
        return null; // No controls

    } else if (
        status === "active" &&
        unit.type === "service" || unit.type === "target"
    ) {
        return <><_Restart unit={unit} className={className} guard={guard} /><_Stop unit={unit} className={className} guard={guard} /></>;

    } else if (
        status === "active" &&
        unit.type === "timer"
    ) {
        return <_Stop unit={unit} className={className} guard={guard} />;  // Restarting a timer doesn't make sense

    } else if (
        status === "failed" ||
        status === "inactive"
    ) {
        return <_Start unit={unit} className={className} guard={guard} />;

    } else  {
        console.error("Unrecognised status", status, "for unit of type", unit.type);
        return  <div className="text-center"> Unkown! </div> ;
    }
}
// Macro functions to create buttons
type _BtnProps = { unit: Unit, className: string, guard: () => Promise<boolean> };
const _Stop = ({ unit, className, guard }: _BtnProps) =>
    <ActionButton action={async () => await unitAction(unit, "stop")} className={className} color={BUTTON_RED} guard={guard}>Stop</ActionButton>;   
const _Restart = ({ unit, className, guard }: _BtnProps) =>
    <ActionButton action={async () => await unitAction(unit, "start")} className={className} color={BUTTON_YELLOW} guard={guard}>Restart</ActionButton>;
const _Start = ({ unit, className, guard }: _BtnProps) =>
    <ActionButton action={async () => await unitAction(unit, "restart")} className={className} color={BUTTON_GREEN} guard={guard}>Start</ActionButton>;
