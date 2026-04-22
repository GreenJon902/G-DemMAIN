"use client";

import { ReactNode, useEffect, useState } from "react";
import { ActionButton, BUTTON_CYAN, BUTTON_GREEN, BUTTON_RED, BUTTON_YELLOW, LinkButton } from "./ui/Button";
import PanelPageSection from "./ui/PanelPageSection";
import { loadPanelDataAction, PanelData, Status, Unit, unitAction } from "./actions";

/**
 * This component has the content of the main dash page.
 * We need to separate this from the main page as we want to send the client an already populated page, however we can't load that data while in "use_client";
 */
export default function ActualPage({ initialData }: { initialData: PanelData }) {

    // Keep the state of the units and system-resources up to date
    const [data, setData] = useState(initialData);
    useEffect(() => {
        const interval = setInterval(async () => {
            setData(await loadPanelDataAction());
        }, 3000);
        return () => clearInterval(interval);
    }, [])

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
                    <div className="h-50 min-w-50 flex-1 bg-red-200 p-4 font-bold"> System CPU% (per core), MEM% usage, and network and disk stats</div>
                    <div className="h-50 min-w-50 flex-1 bg-green-200 p-4 font-bold"> Minecraft, Node, MySQL CPU and MEM usage. <br/> THis should also render TPS </div>
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
                                    <UnitControls unit={unit} status={status} />
                                    <td className="w-0 p-1">  {/* w-0 makes it fit the width of the child */}
                                        <LinkButton href={{ pathname: "panel/log", query: { name: unit.name } }} className="w-full" color={BUTTON_CYAN} newTab>View Log</LinkButton>  
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
 * These will be wrapped in <td className="p-1"> tags so that it can be immediately placed into a table.
 */
function UnitControls({ unit, status }: { unit: Unit, status: Status }) {

    if (
        status === "activating" ||
        status === "deactivating" ||
        !unit.controllable  // This needs to be first as the other clauses don't check for controllable-ness
    ) {
        return <_Td colSpan={2} /> // No controls

    } else if (
        status === "active" &&
        unit.type === "service"
    ) {
        return <><_Td><_Restart unit={unit} /></_Td><_Td><_Stop unit={unit} /></_Td></>;

    } else if (
        status === "active" &&
        unit.type === "timer"
    ) {  
        return <_Td colSpan={2}><_Stop unit={unit} /></_Td>;  // Restarting a timer doesn't make sense

    } else if (
        status === "failed" ||
        status === "inactive"
    ) {
        return <_Td colSpan={2}><_Start unit={unit} /></_Td>;

    } else  {
        console.error("Unrecognised status", status, "for unit of type", unit.type);
        return <_Td colSpan={2}> <div className="text-center"> Unkown! </div> </_Td>;
    }
}
// Macro functions to create buttons
const _Stop = ({ unit }: { unit: Unit }) => 
    <ActionButton action={async () => await unitAction(unit, "stop")} className="w-full" color={BUTTON_RED}>Stop</ActionButton>;   // TODO: IMplement these actions
const _Restart = ({ unit }: { unit: Unit }) => 
    <ActionButton action={async () => await unitAction(unit, "start")} className="w-full" color={BUTTON_YELLOW}>Restart</ActionButton>;
const _Start = ({ unit }: { unit: Unit }) => 
    <ActionButton action={async () => await unitAction(unit, "restart")} className="w-full" color={BUTTON_GREEN}>Start</ActionButton>; 
const _Td = ({ children, colSpan=1 }: { children?: ReactNode, colSpan?: number }) => <td colSpan={colSpan} className="p-1">{children}</td>;
