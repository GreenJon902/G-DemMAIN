"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatFlexiDate, FlexiDateInput } from "../lib/flexidate";
import { TagChip } from "./TagChip";

type ApiTimelineEvent = {
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
};

/** Converts an ApiTimelineEvent's numeric date fields to the bigint FlexiDateInput shape. */
function toFlexiDateInput(e: ApiTimelineEvent): FlexiDateInput {
    return {
        event_date_type: e.event_date_type as "centered" | "ranged",
        event_date1: BigInt(e.event_date1),
        event_date_time_offset: e.event_date_time_offset ?? 0,
        event_date_units: e.event_date_units as "d" | "h" | "m" | null,
        event_date_diff: e.event_date_diff !== null ? BigInt(e.event_date_diff) : null,
        event_date2: e.event_date2 !== null ? BigInt(e.event_date2) : null
    };
}

/**
 * Inline event card. Cannot use TimelineItem (Server Component) from client code.
 *
 * @param e - The event data to render.
 */
function EventCard({ e }: { e: ApiTimelineEvent }) {
    return (
        <div className="flex flex-col gap-2 rounded-lg bg-gray-800 p-4">
            <Link href={"/hisdoc/event/" + e.id} className="font-semibold text-white">
                {e.name}
            </Link>
            <span className="text-sm text-gray-300">{formatFlexiDate(toFlexiDateInput(e))}</span>
            <p className="line-clamp-3 text-sm text-gray-300">{e.description}</p>
            <div className="flex flex-row flex-wrap gap-2">
                {e.tags.map(({ tag }) => {
                    // >>> 0 coerces to unsigned 32-bit so negative signed integers produce a valid hex string
                    const hexColor = "#" + (tag.color >>> 0).toString(16).padStart(6, "0");
                    return (
                        <TagChip
                            key={tag.id}
                            id={tag.id}
                            name={tag.name}
                            description={tag.description}
                            bgColor={hexColor}
                            holeColor="#1f2937"
                        />
                    );
                })}
            </div>
        </div>
    );
}

/**
 * Inner implementation of InfiniteTimeline. Calls useSearchParams, so it must
 * be wrapped in <Suspense> by the exported default (Next.js 15 requirement).
 *
 * @param initialEvents - First page of events fetched server-side.
 * @param initialHasMore - Whether more events exist beyond the initial page.
 */
function InfiniteTimelineInner({
    initialEvents,
    initialHasMore
}: {
    initialEvents: ApiTimelineEvent[];
    initialHasMore: boolean;
}) {
    const searchParams = useSearchParams();
    const searchParamsStr = searchParams.toString();

    const [events, setEvents] = useState<ApiTimelineEvent[]>(initialEvents);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [loadingMore, setLoadingMore] = useState(false);
    const [filterLoading, setFilterLoading] = useState(false);

    // Skip the re-fetch on initial mount — initialEvents already covers page 0
    const isFirstMount = useRef(true);

    useEffect(() => {
        if (isFirstMount.current) {
            isFirstMount.current = false;
            return;
        }

        setEvents([]);
        setHasMore(false);
        setFilterLoading(true);

        fetch(`/hisdoc/api/timeline?${searchParamsStr}`)
            .then(r => r.json())
            .then((data: { events: ApiTimelineEvent[]; hasMore: boolean }) => {
                setEvents(data.events);
                setHasMore(data.hasMore);
                setFilterLoading(false);
            });
    }, [searchParamsStr]);

    /** Fetches the next page using the last event's id as cursor, then appends the results. */
    async function loadMore() {
        setLoadingMore(true);
        const cursor = events[events.length - 1]?.id;
        const qs = searchParamsStr ? `${searchParamsStr}&` : "";
        const url = `/hisdoc/api/timeline?${qs}${cursor !== undefined ? `cursor=${cursor}` : ""}`;
        const r = await fetch(url);
        const data: { events: ApiTimelineEvent[]; hasMore: boolean } = await r.json();
        setEvents(prev => [...prev, ...data.events]);
        setHasMore(data.hasMore);
        setLoadingMore(false);
    }

    return (
        <div className="flex flex-col gap-4">
            {filterLoading ? (
                <p className="text-gray-400">Loading…</p>
            ) : (
                events.map(e => <EventCard key={e.id} e={e} />)
            )}
            {hasMore && (
                <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-800"
                >
                    {loadingMore ? "Loading…" : "Load more"}
                </button>
            )}
        </div>
    );
}

/**
 * Client component that displays a paginated list of timeline events and loads
 * more on demand. Watches URL search params for filter changes and re-fetches
 * from scratch when they change.
 *
 * @param initialEvents - First page of events fetched server-side.
 * @param initialHasMore - Whether more events exist beyond the initial page.
 */
export default function InfiniteTimeline({
    initialEvents,
    initialHasMore
}: {
    initialEvents: ApiTimelineEvent[];
    initialHasMore: boolean;
}) {
    return (
        <Suspense fallback={<p className="text-gray-400">Loading…</p>}>
            <InfiniteTimelineInner initialEvents={initialEvents} initialHasMore={initialHasMore} />
        </Suspense>
    );
}
