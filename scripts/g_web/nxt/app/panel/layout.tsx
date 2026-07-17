import "@/app/globals.css";

import AreaIndicator from "../ui/AreaIndicator";
import SubNav, { SubNavLink } from "../ui/SubNav";
import Link from "next/link";
import { requirePermission, NS } from "@/lib/session";

export default async function Layout({
    children
}: {
    children: React.ReactNode,
}) {
    await requirePermission("panel", "viewer");
    const isAdmin = await NS.optimisticCheckPermission("panel", "admin");

    const links: SubNavLink[] = [
        { href: "/panel", children: "Panel Home" },
        { href: "/panel/graphs", children: "Graphs" },
        { href: "/panel/lists", children: "Lists" },
        { href: "/panel/mcLogs", children: "Minecraft Logs" },
        { href: "/panel/mcConsole", children: "Console", disabled: !isAdmin }
    ];

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
