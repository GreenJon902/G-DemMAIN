"use client";

import { cloneElement, ReactElement, ReactNode, Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { TagChip } from "./TagChip";
import SmallPerson from "./SmallPerson";
import { SimpleButton, ButtonColor, BUTTON_GRAY, BUTTON_LIGHTER_GRAY, BUTTON_GREEN, BUTTON_RED, BUTTON_BLUE } from "@/app/ui/Button";
import TextInput, { VALUE_INPUT_CLASS } from "@/app/ui/TextInput";
import RadioButtons from "@/app/ui/RadioButtons";
import ToggleButton from "@/app/ui/ToggleButton";
import { FilterState, SearchMode, DateRangeMode, parseFilterParam, serializeFilterParam } from "../lib/timeline-filter";

// FilterState plus "in" — the default/untouched state, which is never actually written to the
// URL (absent from the param map), but is given its own code here for symmetry and clarity
type DisplayState = "in" | FilterState;

// The two URL params that hold a serialised filter-state Map, as parsed/set by cycleFilter/setAllFilter
type FilterParamName = "tags" | "persons";

/** Returns the next state in the in → re → ex → ig → in cycle. */
function nextFilterState(state: DisplayState): DisplayState {
    if (state === "in") return "re";
    if (state === "re") return "ex";
    if (state === "ex") return "ig";
    return "in";
}

// User-facing labels for each state. "in" (untouched, default) is shown as "included" — it
// doesn't restrict results, so matching events are included whether or not they have this tag/person
const STATE_LABEL: Record<DisplayState, string> = {
    in: "included",
    re: "required",
    ex: "excluded",
    ig: "ignored"
};

// Cycle/display order, matching the order the labels are introduced in the UI copy
const DISPLAY_ORDER: DisplayState[] = ["in", "re", "ex", "ig"];

// Short codes shown on the "Set all to" buttons
const STATE_SHORT_LABEL: Record<DisplayState, string> = {
    in: "In.",
    re: "Re.",
    ex: "Ex.",
    ig: "Ig."
};

// SimpleButton colors for the "Set all to" buttons, matching the semantic hues used elsewhere
// (green = required, red = excluded, blue = ignored, gray = included/default)
const DISPLAY_BUTTON_COLOR: Record<DisplayState, ButtonColor> = {
    in: BUTTON_LIGHTER_GRAY,
    re: BUTTON_GREEN,
    ex: BUTTON_RED,
    ig: BUTTON_BLUE
};

// Same colours as bg-green-700/red-700/blue-700/gray-700, but as CSS strings for style props
// that can't use Tailwind classes (TagChip's bgColor, SmallPerson's bgColor, the inline legend text)
const STATE_BG_COLOR: Record<FilterState, string> = {
    re: "oklch(52.7% 0.154 150.069)",
    ex: "oklch(50.5% 0.213 27.518)",
    ig: "oklch(48.8% 0.243 264.376)"
};
const GRAY_BG_COLOR = "oklch(37.3% 0.034 259.733)";
const DISPLAY_BG_COLOR: Record<DisplayState, string> = { in: GRAY_BG_COLOR, ...STATE_BG_COLOR };

const SEARCH_BOX_DEBOUNCE = 300;

/**
 * Titled card wrapper shared by every filter section: a bold underlined heading over arbitrary
 * content, inside a rounded, shaded box.
 *
 * @param title - Section heading.
 * @param children - The section's content.
 * @param collapsible - If true, children are hidden behind a Expand/Collapse toggle, collapsed by default.
 * @param summary - Content shown above children regardless of collapsed state (e.g. live stats).
 */
function FilterContainer({
    title,
    children,
    collapsible = false,
    summary
}: {
    title: string;
    children: ReactNode;
    collapsible?: boolean;
    summary?: ReactNode;
}) {
    const [open, setOpen] = useState(false);
    return (
        <div className="flex flex-col gap-2 rounded-lg bg-gray-800 p-3">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-xl leading-none font-bold underline decoration-4">
                    {title}
                </h3>
                {collapsible && (
                    <SimpleButton
                        callback={() => setOpen(o => !o)}
                        color={BUTTON_LIGHTER_GRAY}
                        className="px-2 py-0.5 text-sm text-white"
                    >
                        {open ? "Collapse" : "Expand"}
                    </SimpleButton>
                )}
            </div>
            {summary}
            {(!collapsible || open) && children}
        </div>
    );
}

/**
 * A labelled group of cycle-able filter chips (tags or persons): a live count of items in each
 * state, a row of coloured "set all" buttons that bulk-apply a state to every currently
 * search-matched item, a local search box for narrowing the visible items, and the chips
 * themselves.
 *
 * @param title - Section heading (e.g. "Tags").
 * @param items - All available items in this group.
 * @param matchesSearch - Given an item and the lowercased search text, returns whether it should be shown.
 * @param stateMap - Current id → state for every non-default item in this group.
 * @param onCycle - Called with an item's id when its chip is clicked.
 * @param onSetAll - Called with the target state and the ids of every currently search-matched item.
 * @param renderItem - Renders a single item's chip, given the item and its current display state.
 */
function FilterGroup<T extends { id: number }>({
    title,
    items,
    matchesSearch,
    stateMap,
    onCycle,
    onSetAll,
    renderItem
}: {
    title: string;
    items: T[];
    matchesSearch: (item: T, query: string) => boolean;
    stateMap: Map<number, FilterState>;
    onCycle: (id: number) => void;
    onSetAll: (state: DisplayState, ids: number[]) => void;
    renderItem: (item: T, state: DisplayState, onClick: () => void) => ReactElement;
}) {
    const [query, setQuery] = useState("");
    const visibleItems = query ? items.filter(item => matchesSearch(item, query.toLowerCase())) : items;

    // Counts across *all* items — describes the filter as a whole, regardless of the local search
    const globalCounts: Record<DisplayState, number> = { in: 0, re: 0, ex: 0, ig: 0 };
    for (const item of items) {
        globalCounts[stateMap.get(item.id) ?? "in"]++;
    }
    const visibleIds = visibleItems.map(item => item.id);

    const stats = (
        <p className="text-sm text-white">
            {DISPLAY_ORDER.map((state, i) => (
                <span key={state}>
                    {i > 0 && ", "}
                    <span style={{ color: DISPLAY_BG_COLOR[state] }}>{globalCounts[state]} {STATE_LABEL[state]}</span>
                </span>
            ))}.
        </p>
    );

    return (
        <FilterContainer title={title} collapsible summary={stats}>
            <div className="flex items-center gap-2 text-sm text-white">
                <span>Set all to:</span>
                {DISPLAY_ORDER.map(state => (
                    <SimpleButton
                        key={state}
                        title={`Set all to ${STATE_LABEL[state]}`}
                        callback={() => onSetAll(state, visibleIds)}
                        color={DISPLAY_BUTTON_COLOR[state]}
                        className="px-2 py-0.5 text-sm text-white"
                    >
                        {STATE_SHORT_LABEL[state]}
                    </SimpleButton>
                ))}
            </div>

            <TextInput
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={`Search ${title.toLowerCase()}…`}
            />
            <div className="border-t border-gray-700" />

            <div className="flex flex-wrap gap-2">
                {visibleItems.map(item => {
                    const state = stateMap.get(item.id) ?? "in";
                    return cloneElement(renderItem(item, state, () => onCycle(item.id)), { key: item.id });
                })}
            </div>
        </FilterContainer>
    );
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
    tags: { id: number; name: string; description: string; color: number }[];
    persons: { id: number; type: "MINECRAFT" | "NPC"; data: string; name: string }[];
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Ref kept current every render so the debounce closure always sees the latest params
    const searchParamsRef = useRef(searchParams);
    // eslint-disable-next-line react-hooks/refs
    searchParamsRef.current = searchParams;

    // Text for the search box
    const [queryText, setQueryText] = useState(searchParams.get("q") ?? "");

    // Skip the initial debounce flush so mounting doesn't push a redundant navigation
    const isFirstTextMount = useRef(true);
    
    // Debounce the search box, wait 300ms after a key press before updating the filters
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
        }, SEARCH_BOX_DEBOUNCE);
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

    /** Cycles a single item's filter state within the given URL param and pushes the result. */
    function cycleFilter(param: FilterParamName, id: number) {
        const map = parseFilterParam(searchParams.get(param));
        const next = nextFilterState(map.get(id) ?? "in");
        if (next === "in") {
            map.delete(id);
        } else {
            map.set(id, next);
        }
        pushParams({ [param]: serializeFilterParam(map) });
    }
    const cycleTag = (id: number) => cycleFilter("tags", id);
    const cyclePerson = (id: number) => cycleFilter("persons", id);

    /** Sets every given id's filter state within the given URL param (or clears it, for "in") and pushes the result. */
    function setAllFilter(param: FilterParamName, state: DisplayState, ids: number[]) {
        const map = parseFilterParam(searchParams.get(param));
        for (const id of ids) {
            if (state === "in") map.delete(id); else map.set(id, state);
        }
        pushParams({ [param]: serializeFilterParam(map) });
    }
    const setAllTags = (state: DisplayState, ids: number[]) => setAllFilter("tags", state, ids);
    const setAllPersons = (state: DisplayState, ids: number[]) => setAllFilter("persons", state, ids);

    const tagStates = parseFilterParam(searchParams.get("tags"));
    const personStates = parseFilterParam(searchParams.get("persons"));

    const qMode: SearchMode = searchParams.get("qmode") === "exact" ? "exact" : "keywords";
    const qSearchDescription = searchParams.get("qdesc") !== "0";
    const dateMode: DateRangeMode = searchParams.get("datemode") === "exclusive" ? "exclusive" : "inclusive";
    const showTags = searchParams.get("showtags") !== "0";
    const showPersons = searchParams.get("showpersons") !== "0";

    const hasFilters = !!(
        searchParams.get("tags") ||
        searchParams.get("persons") ||
        searchParams.get("q") ||
        searchParams.get("qmode") ||
        searchParams.get("qdesc") ||
        searchParams.get("from") ||
        searchParams.get("to") ||
        searchParams.get("datemode") ||
        searchParams.get("showtags") ||
        searchParams.get("showpersons")
    );

    return (
        <div className="flex flex-col gap-4">
            <FilterContainer title="Show">
                <ToggleButton
                    checked={showTags}
                    setter={checked => pushParams({ showtags: checked ? null : "0" })}
                    label="Show tags"
                    className="text-sm"
                />
                <ToggleButton
                    checked={showPersons}
                    setter={checked => pushParams({ showpersons: checked ? null : "0" })}
                    label="Show persons"
                    className="text-sm"
                />
            </FilterContainer>

            <FilterContainer title="Search">
                <TextInput
                    value={queryText}
                    onChange={e => setQueryText(e.target.value)}
                    placeholder="Search events…"
                />
                <RadioButtons<SearchMode>
                    className="text-sm"
                    lightBg
                    choices={["keywords", "exact"]}
                    selected={qMode}
                    setter={mode => pushParams({ qmode: mode === "keywords" ? null : mode })}
                    nameConv={mode => mode === "exact" ? "Exact" : "Keywords"}
                    titleConv={mode => mode === "exact" ? "Text must match exactly" : "Each word must be contained by the text"}
                />
                <ToggleButton
                    className="text-sm"
                    checked={qSearchDescription}
                    setter={checked => pushParams({ qdesc: checked ? null : "0" })}
                    label="Search description"
                />
            </FilterContainer>

            <FilterContainer title="Date range">
                <div className="flex flex-row flex-wrap items-center gap-1">
                    <label htmlFor="date-from" className="text-sm text-white cursor-pointer">From:</label>
                    <input
                        id="date-from"
                        type="date"
                        value={searchParams.get("from") ?? ""}
                        onChange={e => pushParams({ from: e.target.value || null })}
                        className={VALUE_INPUT_CLASS}
                    />
                </div>
                <div className="flex flex-row flex-wrap items-center gap-1">
                    <label htmlFor="date-to" className="text-sm text-white cursor-pointer">To:</label>
                    <input
                        id="date-to"
                        type="date"
                        value={searchParams.get("to") ?? ""}
                        onChange={e => pushParams({ to: e.target.value || null })}
                        className={VALUE_INPUT_CLASS}
                    />
                </div>
                <RadioButtons<DateRangeMode>
                    className="text-sm"
                    lightBg
                    choices={["inclusive", "exclusive"]}
                    selected={dateMode}
                    setter={mode => pushParams({ datemode: mode === "inclusive" ? null : mode })}
                    nameConv={mode => mode === "exclusive" ? "Exclusive" : "Inclusive"}
                    titleConv={mode => mode === "exclusive" ? "Event must be entirely contained in the date range" : "Event must overlap with the date range"}
                />
            </FilterContainer>

            {tags.length > 0 && (
                <FilterGroup
                    title="Tags"
                    items={tags}
                    matchesSearch={(tag, q) => tag.name.toLowerCase().includes(q)}
                    stateMap={tagStates}
                    onCycle={cycleTag}
                    onSetAll={setAllTags}
                    renderItem={(tag, state, onClick) => {
                        // >>> 0 coerces to unsigned 32-bit so negative signed integers produce a valid hex string
                        const hexColor = "#" + (tag.color >>> 0).toString(16).padStart(6, "0");
                        return (
                            <TagChip
                                id={tag.id}
                                name={tag.name}
                                description={tag.description}
                                bgColor={state === "in" ? GRAY_BG_COLOR : STATE_BG_COLOR[state]}
                                holeColor={hexColor}
                                onClick={onClick}
                            />
                        );
                    }}
                />
            )}

            {persons.length > 0 && (
                <FilterGroup
                    title="Persons"
                    items={persons}
                    matchesSearch={(person, q) => person.name.toLowerCase().includes(q)}
                    stateMap={personStates}
                    onCycle={cyclePerson}
                    onSetAll={setAllPersons}
                    renderItem={(person, state, onClick) => (
                        <button type="button" onClick={onClick} className="cursor-pointer">
                            <SmallPerson
                                id={person.id}
                                type={person.type}
                                playerdata={person.data}
                                name={person.name}
                                isLink={false}
                                bgColor={state === "in" ? undefined : STATE_BG_COLOR[state]}
                            />
                        </button>
                    )}
                />
            )}

            {hasFilters && (
                <SimpleButton
                    callback={() => {
                        setQueryText("");
                        router.push(pathname);
                    }}
                    color={BUTTON_GRAY}
                    className="self-start px-2 py-0.5 text-sm text-white"
                >
                    Clear filters
                </SimpleButton>
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
    tags: { id: number; name: string; description: string; color: number }[];
    persons: { id: number; type: "MINECRAFT" | "NPC"; data: string; name: string }[];
}) {
    return (
        <Suspense fallback={null}>
            <TimelineFiltersInner tags={tags} persons={persons} />
        </Suspense>
    );
}
