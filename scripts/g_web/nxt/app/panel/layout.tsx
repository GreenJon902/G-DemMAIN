import "@/app/globals.css";

import { BUTTON_CYAN, BUTTON_GREEN, BUTTON_INDIGO, BUTTON_RED, BUTTON_YELLOW, LinkButton } from "../ui/Button";
import Link from "next/link";
import { NS } from "@/lib/session";
import { forbidden, unauthorized } from "next/navigation";

export default async function Layout({
    children
}: {
    children: React.ReactNode,
}) {
    // Check the user is authorised to view the panel
    if (!await NS.optimisticCheckUser("panel")) {
        // User not authorised to view this route
        
        // Check if user has session
        if (await NS.hasSession()) {
            // User has a session, just not permissions
            // So send the forbbiden page
            forbidden();
        } else {
            // User has no session
            // So send to the unauthorised page
            unauthorized();
        }
    }

    // Add the panel specific nav bar
    return (
        <>
            <header className="flex w-full flex-wrap items-center gap-2 border-t border-t-gray-500 bg-gray-700 p-2">
                {/* We give the text a very large flex so only it scales, however we still give the buttons flex so that they fill the entire width if they go on the newline */}
                <div className="flex w-full flex-nowrap items-center gap-3 sm:flex-100">
                    <Link href="/panel" className="flex-100 text-3xl font-extrabold text-nowrap underline hover:text-gray-400">G-DemMAIN Panel</Link>
                </div>
                <div className="flex flex-1 flex-wrap items-center gap-2 sm:flex-nowrap">
                    <LinkButton href="/panel" className="h-min flex-1" color={BUTTON_INDIGO}>Panel Home</LinkButton>  
                    <LinkButton href="/panel/graphs" className="h-min flex-1" color={BUTTON_CYAN}>Graphs</LinkButton>  
                    <LinkButton href="/panel/lists" className="h-min flex-1" color={BUTTON_GREEN}>Lists</LinkButton>  
                    <LinkButton href="/panel/mcLogs" className="h-min flex-1" color={BUTTON_YELLOW}>Minecraft Logs</LinkButton>  
                    <LinkButton href="/panel/mcConsole" className="h-min flex-1" color={BUTTON_RED}>Console</LinkButton>  
                </div>
            </header>
            <main className="p-4">
                {children}
            </main>
        </>
    );
}
