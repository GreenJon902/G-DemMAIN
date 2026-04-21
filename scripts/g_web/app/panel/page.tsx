"use client";

import ActionButton from "./lists/ActionButton";

export default function Page() {
    return ( // TODO: These headered sections with content can be generalised too
        <>
            { /* Quick links -------------------------------------------------- */ }
            <h1 className="text-3xl font-bold underline decoration-4">Quick Links</h1>
            <div className="m-4">
                <div className="flex w-full flex-wrap gap-4"> 
                    {/* TODO: Don't use ActionButton for these */}
                    <ActionButton action={async () => {}} className="flex-1" normalColor="bg-green-600" effectColor="bg-red-800">Lists</ActionButton>  
                    <ActionButton action={async () => {}} className="flex-1" normalColor="bg-yellow-600" effectColor="bg-red-800">Minecraft Logs</ActionButton>  
                    <ActionButton action={async () => {}} className="flex-1" normalColor="bg-red-600" effectColor="bg-red-800">Console</ActionButton>  
                </div>
            </div>
            { /* Resource monitors -------------------------------------------------- */ }
            <h1 className="text-3xl font-bold underline decoration-4">Resources</h1>
            <div className="m-4">
                <div className="flex w-full flex-wrap gap-4">
                    <div className="h-50 min-w-50 flex-1 bg-red-200 p-4 font-bold"> System CPU% (per core), MEM% usage, and network and disk stats</div>
                    <div className="h-50 min-w-50 flex-1 bg-green-200 p-4 font-bold"> Minecraft, Node, MySQL CPU and MEM usage. <br/> THis should also render TPS </div>
                </div>
            </div>
            { /* Service status -------------------------------------------------- */ }
            <h1 className="text-3xl font-bold underline decoration-4">Services</h1>  { /* TODO: This type class can be generalised */ }
            <div className="m-4">
                <table className="w-full overflow-hidden rounded-md"><tbody>
                    {
                        // TODO: Properly implement this and actions and mini log
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
                                    {
                                        service.status === "running" ? (
                                            <>
                                                <td className="p-1"><ActionButton action={async () => {}} className="w-full" normalColor="bg-red-600" effectColor="bg-red-800">Stop</ActionButton></td>
                                                <td className="p-1"><ActionButton action={async () => {}} className="w-full" normalColor="bg-yellow-600" effectColor="bg-yellow-800">Restart</ActionButton></td>
                                            </>
                                        ) : (
                                            <td colSpan={2} className="p-1"> {
                                                service.status === "waiting" ? (
                                                    <ActionButton className="w-full" action={async () => {}} normalColor="bg-red-600" effectColor="bg-red-800">Stop</ActionButton>
                                                ): (
                                                    <ActionButton className="w-full" action={async () => {}} normalColor="bg-green-600" effectColor="bg-green-800">Start</ActionButton>
                                                )
                                            }
                                            </td>
                                        )
                                    }
                                    <td>
                                        {/* TODO: Don't use ActionButton for these */}
                                        <ActionButton action={async () => {}} className="flex-1" normalColor="bg-gray-500" effectColor="bg-gray-600">View Log</ActionButton>  
                                    </td>
                                </tr>
                            ))
                    }
                </tbody></table>
            </div>
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
