import "server-only";
import prisma from "@g/com/lib/prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FlexiDateDisplay } from "../../ui/FlexiDateDisplay";

/** Shows a single tag's details and its 20 most recent events. */
export default async function TagPage({ params }: { params: Promise<{ id: string }> }) {
    // Next.js 15: params is a Promise
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);

    const tag = await prisma().hd_tag.findUnique({
        where: { id, soft_deleted: false },
        include: {
            hd_event_tag: {
                where: { soft_deleted: false, hd_event: { soft_deleted: false } },
                include: {
                    hd_event: {
                        select: {
                            id: true, name: true,
                            event_date_type: true, event_date1: true,
                            event_date_time_offset: true, event_date_units: true,
                            event_date_diff: true, event_date2: true
                        }
                    }
                },
                orderBy: { hd_event: { sort_key: "desc" } },
                take: 20
            }
        }
    });

    if (!tag) notFound();

    // >>> 0 coerces to unsigned 32-bit so negative signed integers produce a valid hex string
    const hexColor = "#" + (tag.color >>> 0).toString(16).padStart(6, "0");

    return (
        <>
            <h1 className="mb-2 flex items-center gap-3 text-2xl font-bold text-white">
                <span
                    className="inline-block size-5 rounded-sm"
                    style={{ backgroundColor: hexColor }}
                />
                {tag.name}
            </h1>
            {tag.description && (
                <p className="mb-6 text-gray-400">{tag.description}</p>
            )}
            <h2 className="mb-3 text-xl font-semibold text-white">Recent Events</h2>
            <ul className="space-y-2">
                {tag.hd_event_tag.map(({ hd_event }) => (
                    <li key={hd_event.id} className="flex items-center gap-4">
                        <FlexiDateDisplay {...hd_event} />
                        <Link
                            href={"/hisdoc/event/" + hd_event.id}
                            className="text-indigo-400 hover:text-indigo-300"
                        >
                            {hd_event.name}
                        </Link>
                    </li>
                ))}
            </ul>
        </>
    );
}
