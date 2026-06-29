"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

type FilterState = "re" | "ex" | "in";

/** Returns the next state in the absent → re → ex → in → absent cycle. */
function nextFilterState(state: FilterState | "absent"): FilterState | "absent" {
    if (state === "absent") return "re";
    if (state === "re") return "ex";
    if (state === "ex") return "in";
    return "absent";
}

const STATE_CLASS: Record<FilterState, string> = {
    re: "bg-green-700",
    ex: "bg-red-700",
    in: "bg-blue-700"
};

/** Parses a filter param string (e.g. "1:re,2:ex") into a Map of id→state. */
function parseFilterParam(param: string | null): Map<number, FilterState> {
    const map = new Map<number, FilterState>();
    if (!param) return map;
    for (const part of param.split(",")) {
        const [idStr, state] = part.split(":");
        const id = parseInt(idStr, 10);
        if (!isNaN(id) && (state === "re" || state === "ex" || state === "in")) {
            map.set(id, state);
        }
    }
    return map;
}

/** Serialises a filter state Map to the "id:state,..." URL param format, or null if empty. */
function serializeFilterParam(map: Map<number, FilterState>): string | null {
    if (map.size === 0) return null;
    return Array.from(map.entries())
        .map(([id, state]) => `${id}:${state}`)
        .join(",");
}

/**
 * Inner implementation of TimelineFilters. Calls useSearchParams, so it must
 * be wrapped in <Suspense> by the exported default (Next.js 15 requirement).
 *
 * @param tags - Available tags to display in the tag filter.
 * @param persons - Available persons to display in the person filter.
 */
function TimelineFiltersInner({
    tags,
    persons
}: {
    tags: { id: number; name: string; color: number }[];
    persons: { id: number; displayName: string }[];
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Ref kept current every render so the debounce closure always sees the latest params
    const searchParamsRef = useRef(searchParams);
    // eslint-disable-next-line react-hooks/refs
    searchParamsRef.current = searchParams;

    const [queryText, setQueryText] = useState(searchParams.get("q") ?? "");

    // Skip the initial debounce flush so mounting doesn't push a redundant navigation
    const isFirstTextMount = useRef(true);

    useEffect(() => {
        if (isFirstTextMount.current) {
            isFirstTextMount.current = false;
            return;
        }
        const timer = setTimeout(() => {
            const params = new URLSearchParams(searchParamsRef.current.toString());
            if (queryText) {
                params.set("q", queryText);
            } else {
                params.delete("q");
            }
            const qs = params.toString();
            router.push(pathname + (qs ? "?" + qs : ""));
        }, 300);
        return () => clearTimeout(timer);
    }, [queryText, router, pathname]);

    /** Merges updates into the current URL params and navigates. Null values delete the key. */
    function pushParams(updates: Record<string, string | null>) {
        const params = new URLSearchParams(searchParams.toString());
        for (const [key, value] of Object.entries(updates)) {
            if (value === null) {
                params.delete(key);
            } else {
                params.set(key, value);
            }
        }
        const qs = params.toString();
        router.push(pathname + (qs ? "?" + qs : ""));
    }

    /** Cycles a tag's filter state and pushes the updated `tags` param to the URL. */
    function cycleTag(id: number) {
        const map = parseFilterParam(searchParams.get("tags"));
        const next = nextFilterState(map.get(id) ?? "absent");
        if (next === "absent") {
            map.delete(id);
        } else {
            map.set(id, next);
        }
        pushParams({ tags: serializeFilterParam(map) });
    }

    /** Cycles a person's filter state and pushes the updated `persons` param to the URL. */
    function cyclePerson(id: number) {
        const map = parseFilterParam(searchParams.get("persons"));
        const next = nextFilterState(map.get(id) ?? "absent");
        if (next === "absent") {
            map.delete(id);
        } else {
            map.set(id, next);
        }
        pushParams({ persons: serializeFilterParam(map) });
    }

    const tagStates = parseFilterParam(searchParams.get("tags"));
    const personStates = parseFilterParam(searchParams.get("persons"));
    const hasFilters = !!(
        searchParams.get("tags") ||
        searchParams.get("persons") ||
        searchParams.get("q") ||
        searchParams.get("from") ||
        searchParams.get("to")
    );

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold tracking-wide text-gray-400 uppercase">
                    Search
                </h3>
                <input
                    type="text"
                    value={queryText}
                    onChange={e => setQueryText(e.target.value)}
                    placeholder="Search events…"
                    className="w-full rounded bg-gray-700 px-2 py-1 text-white"
                />
            </div>

            <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold tracking-wide text-gray-400 uppercase">
                    Date range
                </h3>
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-400">From</label>
                    <input
                        type="date"
                        value={searchParams.get("from") ?? ""}
                        onChange={e => pushParams({ from: e.target.value || null })}
                        className="rounded bg-gray-700 px-2 py-1 text-white"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-400">To</label>
                    <input
                        type="date"
                        value={searchParams.get("to") ?? ""}
                        onChange={e => pushParams({ to: e.target.value || null })}
                        className="rounded bg-gray-700 px-2 py-1 text-white"
                    />
                </div>
            </div>

            {tags.length > 0 && (
                <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold tracking-wide text-gray-400 uppercase">
                        Tags
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {tags.map(tag => {
                            const hexColor = "#" + (tag.color >>> 0).toString(16).padStart(6, "0");
                            const state = tagStates.get(tag.id) ?? "absent";
                            return (
                                <button
                                    key={tag.id}
                                    type="button"
                                    onClick={() => cycleTag(tag.id)}
                                    className={
                                        state === "absent"
                                            ? "rounded border-l-4 bg-gray-700 px-3 py-1 text-sm text-gray-300"
                                            : `rounded border-l-4 px-3 py-1 text-sm text-white ${STATE_CLASS[state]}`
                                    }
                                    style={{ borderLeftColor: hexColor }}
                                >
                                    {tag.name}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {persons.length > 0 && (
                <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold tracking-wide text-gray-400 uppercase">
                        Persons
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {persons.map(person => {
                            const state = personStates.get(person.id) ?? "absent";
                            return (
                                <button
                                    key={person.id}
                                    type="button"
                                    onClick={() => cyclePerson(person.id)}
                                    className={
                                        state === "absent"
                                            ? "rounded bg-gray-700 px-3 py-1 text-sm text-gray-300"
                                            : `rounded px-3 py-1 text-sm text-white ${STATE_CLASS[state]}`
                                    }
                                >
                                    {person.displayName}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {hasFilters && (
                <button
                    type="button"
                    onClick={() => {
                        setQueryText("");
                        router.push(pathname);
                    }}
                    className="text-left text-sm text-gray-400 underline hover:text-white"
                >
                    Clear filters
                </button>
            )}
        </div>
    );
}

/**
 * Client component for filtering the timeline by tags, persons, free text, and date range.
 * Writes all filter state into URL search params so InfiniteTimeline can react to changes.
 *
 * @param tags - Available tags to filter by.
 * @param persons - Available persons to filter by.
 */
export default function TimelineFilters({
    tags,
    persons
}: {
    tags: { id: number; name: string; color: number }[];
    persons: { id: number; displayName: string }[];
}) {
    return (
        <Suspense fallback={null}>
            <TimelineFiltersInner tags={tags} persons={persons} />
        </Suspense>
    );
}
