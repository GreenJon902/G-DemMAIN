import "@/app/globals.css";

import { BUTTON_CYAN, BUTTON_GREEN, BUTTON_RED, BUTTON_YELLOW, LinkButton } from "./ui/Button";
import Link from "next/link";

export default function Layout({
    children
}: {
    children: React.ReactNode,
}) {
    return (
        <>
            <header className="flex w-full flex-wrap gap-2 bg-gray-700 p-2 items-center">
                {/* We give the text a very large flex so only it scales, however we still give the buttons flex so that they fill the entire width if they go on the newline */}
                <Link href="/panel" className="sm:flex-100 w-full text-3xl font-extrabold underline">G-DemMAIN Panel</Link>
                <LinkButton href="/panel/graphs" className="flex-1 h-min" color={BUTTON_CYAN}>Graphs</LinkButton>  
                <LinkButton href="/panel/lists" className="flex-1 h-min" color={BUTTON_GREEN}>Lists</LinkButton>  
                <LinkButton href="/panel/mcLogs" className="flex-1 h-min" color={BUTTON_YELLOW}>Minecraft Logs</LinkButton>  
                <LinkButton href="/panel/mcConsole" className="flex-1 h-min" color={BUTTON_RED}>Console</LinkButton>  
            </header>
            <main className="p-4">
                {children}
            </main>
        </>
    );
}
