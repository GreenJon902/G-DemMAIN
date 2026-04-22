"use client";

import { ReactNode } from "react";
import { ActionButton, BUTTON_CYAN, BUTTON_GREEN, BUTTON_RED, BUTTON_YELLOW, LinkButton } from "./ui/Button";
import PanelPageSection from "./ui/PanelPageSection";

export default function Page() {
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
            <PanelPageSection title="Services">
                <table className="w-full overflow-hidden rounded-md"><tbody>
                    {
                        // TODO: Properly implement this and actions and refreshing
                        [["g_mc.service", "dead"], ["MySQL.service", "failed"], ["g_web.service", "running"], ["g_nightly_restart.timer", "waiting"]]
                            .map(([name, status]) => ({ name: name.split(".")[0], type: name.split(".")[1], status: status }))
                            .map(service => (
                                <tr className="odd:bg-gray-700 even:bg-gray-800" key={service.name}>
                                    <td className="w-6 p-1">
                                        <StatusIndicator status={service.status} />
                                    </td>
                                    <td className="p-1">
                                        {service.name}
                                        <span className="text-xs text-gray-400">
                                            .{service.type}
                                        </span>
                                    </td>
                                    <ServiceControls service={service} />
                                    <td className="w-0 p-1">  {/* w-0 makes it fit the width of the child */}
                                        <LinkButton href={{ pathname: "panel/log", query: { name: service.name } }} className="w-full" color={BUTTON_CYAN} newTab>View Log</LinkButton>  
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
function StatusIndicator({ status }: { status: string }) {
    // Get the color
    const color = { "running": "bg-green-600", "waiting": "bg-cyan-900", "dead": "bg-yellow-600", "failed": "bg-red-600" }[status];

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
 * Create the controls for the given service.
 * These will be wrapped in <td className="p-1"> tags so that it can be immediately placed into a table.
 */
function ServiceControls({ service }: { service: { name: string, status: string } }) {

    if (service.status === "running") {
        return <><_Td><_Restart /></_Td><_Td><_Stop /></_Td></>;
    } else if (service.status === "waiting") {  // This is a timer
        return <_Td colSpan={2}><_Stop /></_Td>;
    } else if (service.status === "failed") {
        return <_Td colSpan={2}><_Start /></_Td>;
    } else if (service.status === "dead") {  // This has been stopped, or has finished
        return <_Td colSpan={2}><_Start /></_Td>;
    } else {
        console.error("Unrecognised status", service.status);
        return <_Td colSpan={2}> <div className="text-center"> Unkown! </div> </_Td>;
    }
}
const _Stop    = () => <ActionButton action={async () => {}} className="w-full" color={BUTTON_RED}   >Stop   </ActionButton>; 
const _Restart = () => <ActionButton action={async () => {}} className="w-full" color={BUTTON_YELLOW}>Restart</ActionButton>; 
const _Start   = () => <ActionButton action={async () => {}} className="w-full" color={BUTTON_GREEN} >Start  </ActionButton>; 
const _Td = ({ children, colSpan=1 }: { children: ReactNode, colSpan?: number }) => <td colSpan={colSpan} className="p-1">{children}</td>;
