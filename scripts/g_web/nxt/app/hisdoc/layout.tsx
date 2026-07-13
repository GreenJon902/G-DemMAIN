import { NS } from "@/lib/session";
import { LinkButton, BUTTON_GREEN, BUTTON_INDIGO } from "@/app/ui/Button";
import AreaIndicator from "@/app/ui/AreaIndicator";
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

    return (
        <>
            <header className="flex w-full items-center justify-between bg-gray-800 p-2">
                <Link
                    href="/hisdoc"
                    className={`${greatVibes.className} relative inline-block cursor-pointer text-3xl font-bold`}
                >
                    <AreaIndicator>
                        HisDoc
                        <div aria-hidden className={LOGO_FLOURISH} />
                    </AreaIndicator>
                </Link>
                <nav className="flex gap-2">
                    <LinkButton href="/hisdoc" color={BUTTON_INDIGO}>Timeline</LinkButton>
                    <LinkButton href="/hisdoc/tags" color={BUTTON_INDIGO}>Tags</LinkButton>
                    <LinkButton href="/hisdoc/persons" color={BUTTON_INDIGO}>Persons</LinkButton>
                </nav>
                <div>
                    {canEdit && (
                        <LinkButton href="/hisdoc/event/add" color={BUTTON_GREEN}>Add Event</LinkButton>
                    )}
                </div>
            </header>
            <main className="min-h-screen bg-gray-900 p-4">{children}</main>
        </>
    );
}
