import "server-only";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@g/com/lib/prisma/client";
import { parseTimelineFilters, buildTimelineWhere } from "../../lib/timeline-filter";
import { resolveEventPersons } from "../../lib/persons";

/**
 * GET /hisdoc/api/timeline
 *
 * Returns a paginated batch of timeline events matching the given filters.
 * No authentication required — timeline is public.
 *
 * Query params:
 * - `cursor` — id of the last event seen; if provided, the response starts after it
 * - `tags`, `persons`, `from`, `to`, `q` — filter params (see parseTimelineFilters)
 *
 * Response: `{ events: TimelineEvent[], hasMore: boolean }`
 *
 * BigInt fields (event_date1, event_date_diff, event_date2) are converted to Number
 * before serialisation — all FlexiDate values fit within Number.MAX_SAFE_INTEGER.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
    const params = req.nextUrl.searchParams;
    const filters = parseTimelineFilters(params);

    const cursorStr = params.get("cursor");
    const cursor = cursorStr !== null ? parseInt(cursorStr, 10) : null;

    const where = buildTimelineWhere(filters);

    // Fetch one extra to determine whether more pages exist
    const events = await prisma().hd_event.findMany({
        where,
        orderBy: [{ sort_key: "desc" }, { id: "desc" }],
        take: 21,
        ...(cursor !== null && !isNaN(cursor)
            ? { cursor: { id: cursor }, skip: 1 }
            : {}),
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
            // sort_key is a STORED generated column — not needed client-side; omit to avoid BigInt serialisation
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
        }
    });

    const hasMore = events.length === 21;
    const page = events.slice(0, 20);

    // JSON.stringify throws on BigInt — convert all FlexiDate bigint fields to Number, and collapse
    // hd_event_tag/hd_event_person into the shapes expected by InfiniteTimeline, dropping any
    // applications whose tag/person has itself been soft-deleted
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

    return NextResponse.json({ events: serialised, hasMore });
}
