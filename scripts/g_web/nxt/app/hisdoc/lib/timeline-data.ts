import "server-only";
import prisma from "@g/com/lib/prisma/client";
import { buildTimelineWhere, TimelineFilters } from "./timeline-filter";
import { resolveEventPersons, EventPerson } from "./persons";

export type TimelineEvent = {
    id: number;
    name: string;
    description: string;
    event_date_type: string;
    event_date1: number;
    event_date_time_offset: number | null;
    event_date_units: string | null;
    event_date_diff: number | null;
    event_date2: number | null;
    tags: { tag: { id: number; name: string; description: string; color: number } }[];
    persons: EventPerson[];
};

const TIMELINE_EVENT_SELECT = {
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
    },
    hd_event_person: {
        where: { soft_deleted: false },
        select: {
            hd_person: { select: { id: true, type: true, data: true, soft_deleted: true } }
        }
    }
} as const;

/**
 * Fetches one page of timeline events matching the given filters, starting after `cursor` (or
 * from the start if null). Shared by the initial server-rendered page and the `getTimelinePage`
 * server action used for client-side re-fetches, so the query/serialisation logic only lives once.
 *
 * BigInt fields (event_date1, event_date_diff, event_date2) are converted to Number before
 * returning — all FlexiDate values fit within Number.MAX_SAFE_INTEGER.
 *
 * @param filters - The parsed timeline filters to apply.
 * @param cursor - id of the last event already loaded, or null to start from the beginning.
 */
export async function fetchTimelinePage(
    filters: TimelineFilters,
    cursor: number | null
): Promise<{ events: TimelineEvent[]; hasMore: boolean }> {
    const where = buildTimelineWhere(filters);

    // Fetch one extra to determine whether more pages exist
    const events = await prisma().hd_event.findMany({
        where,
        orderBy: [{ sort_key: "desc" }, { id: "desc" }],
        take: 21,
        ...(cursor !== null ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: TIMELINE_EVENT_SELECT
    });

    const hasMore = events.length === 21;
    const page = events.slice(0, 20);

    // Collapse hd_event_tag/hd_event_person into the shapes expected by InfiniteTimeline, dropping
    // any tag/person applications whose tag/person has itself been soft-deleted
    const serialised = await Promise.all(page.map(async ({ hd_event_tag, hd_event_person, ...e }) => ({
        ...e,
        event_date1: Number(e.event_date1),
        event_date_diff: e.event_date_diff !== null ? Number(e.event_date_diff) : null,
        event_date2: e.event_date2 !== null ? Number(e.event_date2) : null,
        tags: hd_event_tag
            .filter(rel => !rel.hd_tag.soft_deleted)
            .map(rel => ({ tag: { id: rel.hd_tag.id, name: rel.hd_tag.name, description: rel.hd_tag.description, color: rel.hd_tag.color } })),
        persons: await resolveEventPersons(hd_event_person)
    })));

    return { events: serialised, hasMore };
}
