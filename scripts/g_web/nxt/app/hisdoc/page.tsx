import "server-only";
import prisma from "@g/com/lib/prisma/client";
import { parseTimelineFilters, buildTimelineWhere } from "./lib/timeline-filter";
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

    const [events, allTags, allPersons] = await Promise.all([
        prisma().hd_event.findMany({
            where: buildTimelineWhere(filters),
            orderBy: [{ sort_key: "desc" }, { id: "desc" }],
            take: 21,
            select: {
                id: true,
                name: true,
                description: true,
                event_date_type: true,
                event_date1: true,
                event_date_time_offset: true,
                event_date_units: true,
                event_date_diff: true,
                event_date2: true,
                hd_event_tag: {
                    where: { soft_deleted: false },
                    select: {
                        hd_tag: { select: { id: true, name: true, description: true, color: true, soft_deleted: true } }
                    }
                }
            }
        }),
        prisma().hd_tag.findMany({ where: { soft_deleted: false }, orderBy: { name: "asc" } }),
        prisma().hd_person.findMany({ where: { soft_deleted: false }, orderBy: { data: "asc" } })
    ]);

    const hasMore = events.length === 21;
    const page = events.slice(0, 20);

    // Convert BigInt date fields to Number (all FlexiDate values fit within Number.MAX_SAFE_INTEGER),
    // and collapse hd_event_tag into the { tag: {...} }[] shape expected by InfiniteTimeline, dropping
    // any tag applications whose tag has itself been soft-deleted
    const serialisedPage = page.map(({ hd_event_tag, ...e }) => ({
        ...e,
        event_date1: Number(e.event_date1),
        event_date_diff: e.event_date_diff !== null ? Number(e.event_date_diff) : null,
        event_date2: e.event_date2 !== null ? Number(e.event_date2) : null,
        tags: hd_event_tag
            .filter(rel => !rel.hd_tag.soft_deleted)
            .map(rel => ({ tag: { id: rel.hd_tag.id, name: rel.hd_tag.name, description: rel.hd_tag.description, color: rel.hd_tag.color } }))
    }));

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
            <aside className="w-64 flex-shrink-0">
                <TimelineFilters tags={allTags} persons={personsForFilters} />
            </aside>
            <main className="flex flex-1 flex-col gap-4">
                <InfiniteTimeline initialEvents={serialisedPage} initialHasMore={hasMore} />
            </main>
        </div>
    );
}
