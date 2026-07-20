import "@/app/globals.css";

import AreaIndicator from "../ui/AreaIndicator";
import SubNav, { SubNavLink } from "../ui/SubNav";
import Link from "next/link";
import { requirePermission } from "@/lib/session";
import type { Metadata } from "next";

// Overrides the root template for everything under /panel — deliberately just one level ("|
// G-DemMAIN", not "| Panel | G-DemMAIN"), since /panel's own page wants exactly "Panel | G-DemMAIN"
// (via the default below) while its sub-pages bake "| Panel" into their own title string to reach
// the same 3-level result — Next doesn't chain multiple ancestor templates automatically.
export const metadata: Metadata = {
    title: {
        template: "%s | G-DemMAIN",
        default: "Panel"
    }
};

const links: SubNavLink[] = [
    { href: "/panel", children: "Panel Home" },
    { href: "/panel/graphs", children: "Graphs" },
    { href: "/panel/lists", children: "Lists" },
    { href: "/panel/mcLogs", children: "Minecraft Logs" },
    { href: "/panel/mcConsole", children: "Console", disabled: { area: "panel", minLevel: "admin" } }
];

export default async function Layout({
    children
}: {
    children: React.ReactNode,
}) {
    await requirePermission("panel", "viewer");

    // Add the panel specific nav bar
    return (
        <>
            <SubNav
                logo={
                    <Link href="/panel">
                        <AreaIndicator className="text-3xl font-extrabold text-nowrap underline">G-DemMAIN Panel</AreaIndicator>
                    </Link>
                }
                links={links}
            />
            <main className="p-4">
                {children}
            </main>
        </>
    );
}
