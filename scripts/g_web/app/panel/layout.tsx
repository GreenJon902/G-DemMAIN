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
            <header className="flex w-full flex-wrap items-center gap-2 bg-gray-700 p-2">
                {/* We give the text a very large flex so only it scales, however we still give the buttons flex so that they fill the entire width if they go on the newline */}
                <Link href="/panel" className="w-full text-3xl font-extrabold underline sm:flex-100">G-DemMAIN Panel</Link>
                <LinkButton href="/panel/graphs" className="h-min flex-1" color={BUTTON_CYAN}>Graphs</LinkButton>  
                <LinkButton href="/panel/lists" className="h-min flex-1" color={BUTTON_GREEN}>Lists</LinkButton>  
                <LinkButton href="/panel/mcLogs" className="h-min flex-1" color={BUTTON_YELLOW}>Minecraft Logs</LinkButton>  
                <LinkButton href="/panel/mcConsole" className="h-min flex-1" color={BUTTON_RED}>Console</LinkButton>  
            </header>
            <main className="p-4">
                {children}
            </main>
        </>
    );
}
