import { NS } from "@/lib/session";
import { LinkButton, BUTTON_GREEN, BUTTON_INDIGO } from "@/app/ui/Button";
import Link from "next/link";
import { ReactNode } from "react";

/** Layout wrapping all /hisdoc routes with a dark header navbar and main content area. */
export default async function HisDocLayout({ children }: { children: ReactNode }) {
    const canEdit = await NS.optimisticCheckUser("hisdoc");

    return (
        <>
            <header className="flex w-full items-center justify-between bg-gray-800 px-6 py-3">
                <Link href="/hisdoc" className="text-2xl font-bold text-white">
                    HisDoc
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
            <main className="min-h-screen bg-gray-900 p-6">{children}</main>
        </>
    );
}
