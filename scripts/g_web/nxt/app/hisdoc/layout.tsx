import { NS } from "@/lib/session";
import { LinkButton, BUTTON_GREEN } from "@/app/ui/Button";
import AreaIndicator from "@/app/ui/AreaIndicator";
import SubNav, { SubNavLink } from "@/app/ui/SubNav";
import Link from "next/link";
import { ReactNode } from "react";
import { Great_Vibes } from "next/font/google";

const greatVibes = Great_Vibes({ weight: "400", subsets: ["latin"] });

// Flourish (arrow) drawn under the logo text
const LOGO_FLOURISH =
    "absolute left-[0.8em] -bottom-[1em] h-[1.5em] w-[3em] bg-[currentColor] " +
    "[clip-path:polygon(0em_0.2em,calc(100%-0.15em)_0.2em,calc(100%-0.15em)_0em,100%_0.25em,calc(100%-0.15em)_0.5em,calc(100%-0.15em)_0.3em,0em_0.3em)]";

/** Layout wrapping all /hisdoc routes with a dark header navbar and main content area. */
export default async function HisDocLayout({ children }: { children: ReactNode }) {
    const canEdit = await NS.optimisticCheckPermission("hisdoc", "editor");
    
    const links: SubNavLink[] = [
        { href: "/hisdoc", children: "Timeline" },
        { href: "/hisdoc/tags", children: "Tags" },
        { href: "/hisdoc/persons", children: "Persons" },
        { href: "/hisdoc/event/add", children: "Add Event", disabled: !canEdit }
    ];
    
    return (
        <>
            <SubNav
                logo={
                    <Link
                        href="/hisdoc"
                        className={`${greatVibes.className} relative inline-block cursor-pointer text-3xl font-bold`}
                    >
                        <AreaIndicator>
                            HisDoc
                            <div aria-hidden className={LOGO_FLOURISH} />
                        </AreaIndicator>
                    </Link>
                }
                links={links}
            />
            <main className="min-h-screen bg-gray-900 p-4">{children}</main>
        </>
    );
}
