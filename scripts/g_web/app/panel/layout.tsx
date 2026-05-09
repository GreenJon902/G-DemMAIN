import "@/app/globals.css";

import { BUTTON_CYAN, BUTTON_GREEN, BUTTON_INDIGO, BUTTON_RED, BUTTON_YELLOW, LinkButton } from "./ui/Button";
import Link from "next/link";
import { ArrowUturnLeftIcon } from "@heroicons/react/20/solid";

export default function Layout({
    children
}: {
    children: React.ReactNode,
}) {
    return (
        <>
            <header className="flex w-full flex-wrap items-center gap-2 bg-gray-700 p-2">
                {/* We give the text a very large flex so only it scales, however we still give the buttons flex so that they fill the entire width if they go on the newline */}
                <div className="w-full sm:flex-100 flex flex-nowrap items-center gap-3">
                    <Link href="/" className="h-min flex-1 rounded-full hover:bg-gray-800 p-1"><ArrowUturnLeftIcon className="size-6 text-gray-300 stroke-2" /></Link>  
                    <Link href="/panel" className="text-3xl font-extrabold underline flex-100 text-nowrap hover:text-gray-400">G-DemMAIN Panel</Link>
                </div>
                <div className="flex flex-wrap items-center gap-2 flex-1 sm:flex-nowrap">
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
