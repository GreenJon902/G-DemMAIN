"use client";

import ActionButton from "./lists/ActionButton";

export default function Page() {
    return (
        <>
            { /* Quick links -------------------------------------------------- */ }
            <h1 className="text-3xl font-bold underline decoration-4">Quick Links</h1>
            <div className="m-4">
                <div className="flex w-full flex-wrap gap-4"> 
                    {/* TODO: Don't use ActionButton for these */}
                    <ActionButton action={async () => {}} className="flex-1" normalColor="bg-green-600" effectColor="bg-red-800">Lists</ActionButton>  
                    <ActionButton action={async () => {}} className="flex-1" normalColor="bg-yellow-600" effectColor="bg-red-800">Logs</ActionButton>  
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
                <table className="w-full overflow-hidden rounded-md">
                    <tr className="bg-gray-700"> 
                        <th className="p-1 text-left">Service Name</th>
                        <th className="p-1 text-left">Service Status</th>
                        <th className="p-1 text-left">Since</th>
                        <th/>
                        <th/>
                    </tr>
                    {
                        [["g_mc", "Stopped"], ["MySQL", "Failed"], ["g_web", "Active"], ["g_nightly_restart", "Active"]]
                            .map(([name, status]) => ({ name: name, status: status }))
                            .map(service => (
                                <tr className="odd:bg-gray-700 even:bg-gray-800">
                                    <td className="p-1">{service.name}</td>
                                    <td className="p-1">{service.status}</td>
                                    <td>2025/12/32-12:30-GMT</td>
                                    {
                                        service.status === "Active" ? (
                                            <>
                                                <td className="p-1"><ActionButton action={async () => {}} className="w-full" normalColor="bg-red-600" effectColor="bg-red-800">Stop</ActionButton></td>
                                                <td className="p-1"><ActionButton action={async () => {}} className="w-full" normalColor="bg-yellow-600" effectColor="bg-yellow-800">Restart</ActionButton></td>
                                            </>
                                        ) : (
                                            <td colSpan={2} className="p-1"><ActionButton className="w-full" action={async () => {}} normalColor="bg-green-600" effectColor="bg-green-800">Start</ActionButton></td>
                                        )
                                    }
                                </tr>
                            ))
                    }
                </table>
            </div>
            <div className="m-4">
                <div className="h-40 w-full rounded-md bg-gray-950 p-4">
                    Console output from systemd service is started or stopped. <br/>
                    Only renderes when a button is clicked.
                </div>
            </div>
        </>
    );
}
