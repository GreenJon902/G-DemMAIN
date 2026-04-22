"use client";

import { useEffect, useState } from "react";
import { ActionButton, BUTTON_CYAN, BUTTON_GREEN, BUTTON_RED, BUTTON_YELLOW, LinkButton } from "./ui/Button";
import PanelPageSection from "./ui/PanelPageSection";
import { loadPanelDataAction, PanelData, Status, Unit, unitAction } from "./actions";
import Graph from "./ui/Graph";

/**
 * This component has the content of the main dash page.
 * We need to separate this from the main page as we want to send the client an already populated page, however we can't load that data while in "use_client";
 */
export default function ActualPage({ initialData }: { initialData: PanelData }) {

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
            timeout = setTimeout(pullData, 5000);
        };
        timeout = setTimeout(pullData, 5000);

        return () => {
            clearTimeout(timeout);
            cancelled = true;
        };
    }, []);


    return ( 
        <>
            { /* Quick links -------------------------------------------------- */ }
            <PanelPageSection title="Quick Links">
                <div className="flex w-full flex-wrap gap-4"> 
                    <LinkButton href="panel/lists" className="flex-1" color={BUTTON_GREEN}>Lists</LinkButton>  
                    <LinkButton href="panel/mcLogs" className="flex-1" color={BUTTON_YELLOW}>Minecraft Logs</LinkButton>  
                    <LinkButton href="panel/mcConsole" className="flex-1" color={BUTTON_RED}>Console</LinkButton>  
                </div>
            </PanelPageSection>
            { /* Resource monitors -------------------------------------------------- */ }
            <PanelPageSection title="Resources">
                <div className="flex w-full flex-wrap gap-4">
                    <Graph data={data.graphData} keys={["sys.cpu1", "sys.cpu2", "sys.cpu3", "sys.cpu4", "sys.mem"]} className="h-50 min-w-50 flex-1" />
                    <Graph data={data.graphData} keys={["mc.tps", "g_mc.cpu", "g_mc.mem"]} className="h-50 min-w-50 flex-1" />
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
                                    <UnitControls unit={unit} status={status} className="flex-1" /> 
                                </td>
                                <td className="w-0 p-1">  {/* w-0 makes it fit the width of the child */}
                                    <LinkButton href={{ pathname: "panel/log", query: { name: unit.name } }} className="w-full" color={BUTTON_CYAN} newTab>View Log</LinkButton>  
                                </td>
                            </tr>
                        ))
                    }
                </tbody></table>
            </PanelPageSection>

            <span className="text-gray-600">Last updated {Math.floor((currentTimestamp - data.timestamp) / 1000)} seconds ago</span>
        </>
    );

}


/**
 * Get the color associated with this status.
 * If the status is unkown then it's logged to the console and set to transparent.
 * @param status - This should be the systemd SubState.
 */
function StatusIndicator({ unit, status }: { unit: Unit, status: Status }) {
    // Get the color
    const color = { 
        "active": "bg-green-600", 
        "inactive": unit.expectActive ? "bg-orange-600" : "bg-cyan-600", 
        "failed": "bg-red-600", 
        "activating": "bg-yellow-600",
        "deactivating": "bg-yellow-600" 
    }[status];

    // If we have no color then we don't recognise this status
    if (color === undefined) {
        // Error and just display text
        console.error("Unrecognised status", status);
        return status;  
    }
    
    // Create a circle with the first letter of status, with hover being full status name
    return <div className={`${color} aspect-square w-6 rounded-full text-center`} title={status}>
        {status[0].toUpperCase()}
    </div>;
}

/**
 * Create the controls for the given unit.
 * @param className - This will be given to each child.
 */
function UnitControls({ unit, status, className="" }: { unit: Unit, status: Status, className?: string }) {

    if (
        status === "activating" ||
        status === "deactivating" ||
        !unit.controllable  // This needs to be first as the other clauses don't check for controllable-ness
    ) {
        return null; // No controls

    } else if (
        status === "active" &&
        unit.type === "service"
    ) {
        return <><_Restart unit={unit} className={className} /><_Stop unit={unit} className={className} /></>;

    } else if (
        status === "active" &&
        unit.type === "timer"
    ) {  
        return <_Stop unit={unit} className={className} />;  // Restarting a timer doesn't make sense

    } else if (
        status === "failed" ||
        status === "inactive"
    ) {
        return <_Start unit={unit} className={className} />;

    } else  {
        console.error("Unrecognised status", status, "for unit of type", unit.type);
        return  <div className="text-center"> Unkown! </div> ;
    }
}
// Macro functions to create buttons
const _Stop = ({ unit, className }: { unit: Unit, className: string }) => 
    <ActionButton action={async () => await unitAction(unit, "stop")} className={className} color={BUTTON_RED}>Stop</ActionButton>;   // TODO: IMplement these actions
const _Restart = ({ unit, className }: { unit: Unit, className: string }) => 
    <ActionButton action={async () => await unitAction(unit, "start")} className={className} color={BUTTON_YELLOW}>Restart</ActionButton>;
const _Start = ({ unit, className }: { unit: Unit, className: string }) => 
    <ActionButton action={async () => await unitAction(unit, "restart")} className={className} color={BUTTON_GREEN}>Start</ActionButton>; 
