"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import TextLink, { TEXT_LINK_WHITE } from "@/app/ui/TextLink";
import { FlexiDateInput } from "../lib/flexidate";
import { FlexiDateDisplay } from "./FlexiDateDisplay";
import { TagChip } from "./TagChip";
import SmallPerson from "./SmallPerson";
import { getTimelinePage } from "../actions";
import { TimelineEvent as ApiTimelineEvent } from "../lib/timeline-data";

// How long a re-fetch (filter change or "load more") can run before the loading indicator is
// shown — keeps quick re-fetches from flashing a spinner, while slow ones still give feedback
const LOADING_INDICATOR_DELAY_MS = 400;

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
 * Inline event card.
 *
 * @param e - The event data to render.
 * @param showTags - Whether to render the event's tags row.
 * @param showPersons - Whether to render the event's persons row.
 */
function EventCard({ e, showTags, showPersons }: { e: ApiTimelineEvent; showTags: boolean; showPersons: boolean }) {
    return (
        <div className="flex flex-col gap-2 rounded-lg bg-gray-800 p-4">
            <TextLink href={"/hisdoc/event/" + e.id} color={TEXT_LINK_WHITE} solid className="font-semibold">
                {e.name}
            </TextLink>
            <FlexiDateDisplay {...toFlexiDateInput(e)} />
            <p className="line-clamp-3 text-sm text-gray-300">{e.description}</p>
            {showTags && e.tags.length > 0 && (
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
            )}
            {showPersons && e.persons.length > 0 && (
                <div className="flex flex-row flex-wrap gap-2">
                    {e.persons.map(person => (
                        <SmallPerson key={person.id} id={person.id} type={person.type} playerdata={person.data} name={person.name} />
                    ))}
                </div>
            )}
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
    const showTags = searchParams.get("showtags") !== "0";
    const showPersons = searchParams.get("showpersons") !== "0";

    const [events, setEvents] = useState<ApiTimelineEvent[]>(initialEvents);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [loadingMore, setLoadingMore] = useState(false);
    // True once a filter re-fetch has been running longer than LOADING_INDICATOR_DELAY_MS. Old
    // events stay on screen the whole time — this only adds an indicator alongside them, it never
    // clears the list, so filter changes don't flash to empty while the new page loads
    const [filterLoading, setFilterLoading] = useState(false);

    // Skip the re-fetch on initial mount — initialEvents already covers page 0
    const isFirstMount = useRef(true);

    useEffect(() => {
        if (isFirstMount.current) {
            isFirstMount.current = false;
            return;
        }

        let cancelled = false;
        const loadingTimer = setTimeout(() => {
            if (!cancelled) setFilterLoading(true);
        }, LOADING_INDICATOR_DELAY_MS);

        getTimelinePage(searchParamsStr, null).then(data => {
            if (cancelled) return;
            clearTimeout(loadingTimer);
            setEvents(data.events);
            setHasMore(data.hasMore);
            setFilterLoading(false);
        });

        // Cancel a stale in-flight request if the filters change again before it resolves, so it
        // can't clobber a newer result
        return () => {
            cancelled = true;
            clearTimeout(loadingTimer);
        };
    }, [searchParamsStr]);

    /** Fetches the next page using the last event's id as cursor, then appends the results. */
    async function loadMore() {
        setLoadingMore(true);
        const cursor = events[events.length - 1]?.id ?? null;
        const data = await getTimelinePage(searchParamsStr, cursor);
        setEvents(prev => [...prev, ...data.events]);
        setHasMore(data.hasMore);
        setLoadingMore(false);
    }

    return (
        <div className="flex flex-col gap-4">
            {filterLoading && <p className="text-gray-400">Loading…</p>}
            {events.map(e => <EventCard key={e.id} e={e} showTags={showTags} showPersons={showPersons} />)}
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
