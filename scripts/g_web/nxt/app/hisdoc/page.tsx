import "server-only";
import prisma from "@g/com/lib/prisma/client";
import { parseTimelineFilters } from "./lib/timeline-filter";
import { fetchTimelinePage } from "./lib/timeline-data";
import InfiniteTimeline from "./ui/InfiniteTimeline";
import TimelineFilters from "./ui/TimelineFilters";
import { getMinecraftUsername } from "./lib/minecraft";

/**
 * Main HisDoc timeline page. Fetches the first page of events and all tags/persons
 * server-side using the current URL filter params, then renders the filter sidebar
 * alongside the infinite-scroll timeline.
 *
 * @param searchParams - Next.js 15 async search params (must be awaited before use).
 */
export default async function HisDocPage({
    searchParams
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const sp = await searchParams;
    const urlParams = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
        if (typeof v === "string") urlParams.set(k, v);
        else if (Array.isArray(v)) v.forEach(val => urlParams.append(k, val));
    }

    const filters = parseTimelineFilters(urlParams);

    const [{ events: serialisedPage, hasMore }, allTags, allPersons] = await Promise.all([
        fetchTimelinePage(filters, null),
        prisma().hd_tag.findMany({ where: { soft_deleted: false }, orderBy: { name: "asc" } }),
        prisma().hd_person.findMany({ where: { soft_deleted: false }, orderBy: { data: "asc" } })
    ]);

    // Resolve Minecraft uuids to usernames; NPC persons use their data field directly. Both the raw
    // data (SmallPerson's playerhead image) and resolved name (search matching + display text) are
    // needed by TimelineFilters, since getMinecraftUsername must stay server-only
    const resolvedNames = await Promise.all(
        allPersons.map(p =>
            p.type === "MINECRAFT" ? getMinecraftUsername(p.data) : Promise.resolve(p.data)
        )
    );

    const personsForFilters = allPersons.map((p, i) => ({
        id: p.id,
        type: p.type,
        data: p.data,
        name: resolvedNames[i]
    }));

    return (
        <div className="flex gap-6">
            <TimelineFilters tags={allTags} persons={personsForFilters} />
            <main className="flex flex-1 flex-col gap-4">
                <InfiniteTimeline initialEvents={serialisedPage} initialHasMore={hasMore} />
            </main>
        </div>
    );
}
