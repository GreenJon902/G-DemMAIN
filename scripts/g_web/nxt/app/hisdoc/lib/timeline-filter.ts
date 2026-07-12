import type { Prisma } from "@g/com/prisma/client";

// Serialised (URL-persisted) states: required, excluded, ignored. Absent from the map means
// "included" (the default) — see buildTimelineWhere's inclusion clause for what that means for
// filtering. Shared with TimelineFilters.tsx, which layers its own "in" (included/untouched)
// display state on top of this for the UI's cycle order.
export type FilterState = "re" | "ex" | "ig";

// "exact" — q must appear as a substring as-is. "keywords" — q is split on whitespace and every
// word must appear as a substring (independently of the others).
export type SearchMode = "exact" | "keywords";

// "inclusive" — the event's date range must overlap [from, to]. "exclusive" — the event's date
// range must fall entirely within [from, to].
export type DateRangeMode = "inclusive" | "exclusive";

export type TimelineFilters = {
    tags: Map<number, FilterState>;
    persons: Map<number, FilterState>;
    from: bigint | null;    // earliest unix seconds bound
    to: bigint | null;      // latest unix seconds bound
    q: string | null;       // text search
    qMode: SearchMode;
    qSearchDescription: boolean;   // also match against description, not just name
    dateMode: DateRangeMode;
};

/**
 * Parses a single `id:state` entry (e.g. `"3:re"`) into a typed tuple.
 * Returns null if the entry is malformed or the state value is unrecognised.
 */
function parseFilterEntry(entry: string): [number, FilterState] | null {
    const colonIdx = entry.indexOf(":");
    if (colonIdx === -1) return null;
    const id = parseInt(entry.slice(0, colonIdx), 10);
    if (isNaN(id)) return null;
    const state = entry.slice(colonIdx + 1);
    if (state !== "re" && state !== "ex" && state !== "ig") return null;
    return [id, state];
}

/**
 * Parses a comma-separated `id:state` param string (e.g. `"3:re,7:ex,12:ig"`) into a Map of
 * id → state. Invalid entries are silently skipped. Shared by the API route and the
 * TimelineFilters UI so both sides of the URL contract stay in sync.
 */
export function parseFilterParam(raw: string | null): Map<number, FilterState> {
    const map = new Map<number, FilterState>();
    if (!raw) return map;
    for (const entry of raw.split(",")) {
        const parsed = parseFilterEntry(entry.trim());
        if (parsed) map.set(parsed[0], parsed[1]);
    }
    return map;
}

/** Serialises a filter state Map back to the `id:state,...` URL param format, or null if empty. */
export function serializeFilterParam(map: Map<number, FilterState>): string | null {
    if (map.size === 0) return null;
    return Array.from(map.entries())
        .map(([id, state]) => `${id}:${state}`)
        .join(",");
}

/**
 * Parses URL search params into a TimelineFilters object.
 *
 * Expected params:
 * - `tags` — comma-separated `id:state` pairs (`re`/`ex`/`ig`); invalid entries skipped.
 * - `persons` — same format as `tags`.
 * - `from` / `to` — YYYY-MM-DD strings converted to unix seconds; absent or unparseable → null.
 * - `q` — raw text string; absent or empty → null.
 * - `qmode` — `"exact"` selects exact-match mode; anything else (including absent) → `"keywords"`.
 * - `qdesc` — `"0"` disables searching the description; anything else (including absent) → true.
 * - `datemode` — `"exclusive"` selects exclusive mode; anything else (including absent) → `"inclusive"`.
 *
 * @param params - The URL search params to parse.
 */
export function parseTimelineFilters(params: URLSearchParams): TimelineFilters {
    const tags = parseFilterParam(params.get("tags"));
    const persons = parseFilterParam(params.get("persons"));

    // Parse YYYY-MM-DD date bounds to unix seconds via Date.parse
    const fromStr = params.get("from");
    const toStr = params.get("to");

    let from: bigint | null = null;
    let to: bigint | null = null;

    if (fromStr) {
        const ms = Date.parse(fromStr);
        if (!isNaN(ms)) from = BigInt(Math.floor(ms / 1000));
    }
    if (toStr) {
        // Date.parse gives midnight UTC
        //   of that day for both — fine for `from` (start of day), but `to` needs pushing to the last
        //   second of that day, since FlexiDates can carry a time (h/m units) and would otherwise be
        //   excluded by an end-of-range date that's meant to include its whole day
        const ms = Date.parse(toStr);
        if (!isNaN(ms)) to = BigInt(Math.floor(ms / 1000)) + 86399n;
    }

    const qRaw = params.get("q");
    const q = qRaw && qRaw.length > 0 ? qRaw : null;

    const qMode: SearchMode = params.get("qmode") === "exact" ? "exact" : "keywords";
    const qSearchDescription = params.get("qdesc") !== "0";
    const dateMode: DateRangeMode = params.get("datemode") === "exclusive" ? "exclusive" : "inclusive";

    return { tags, persons, from, to, q, qMode, qSearchDescription, dateMode };
}

/**
 * Builds the AND clauses for one filterable axis (tags or persons), applied independently:
 * - Inclusion: untouched/absent ids are "included" by default. Once at least one id on this axis
 *   has been touched (`re`/`ex`/`ig` — the only states ever stored), the event must carry at
 *   least one still-untouched id, expressed as "some id not in (touched ids)" so it doesn't need
 *   to know the full universe of ids. `re`/`ex`/`ig` ids are all excluded from this pool — marking
 *   a tag required or excluded removes it from "included" rather than strengthening it, so
 *   picking a required tag doesn't make the inclusion check vacuous. If every id has been
 *   touched, this is unsatisfiable and the axis excludes all events. With nothing touched at all,
 *   no inclusion clause is added and the axis imposes no restriction.
 * - Required: the event must carry every `re` id (each gets its own AND clause).
 * - Excluded: the event must carry no `ex` id (each gets its own AND clause).
 *
 * @param states - id → state map for this axis.
 * @param makeRequired - Builds the "must be present" clause for one id.
 * @param makeExcluded - Builds the "must not be present" clause for one id.
 * @param makeInclusion - Builds the "at least one included id present" clause, given the touched ids to exclude from that pool.
 */
function buildAxisClauses(
    states: Map<number, FilterState>,
    makeRequired: (id: number) => Prisma.hd_eventWhereInput,
    makeExcluded: (id: number) => Prisma.hd_eventWhereInput,
    makeInclusion: (touchedIds: number[]) => Prisma.hd_eventWhereInput
): Prisma.hd_eventWhereInput[] {
    const clauses: Prisma.hd_eventWhereInput[] = [];
    for (const [id, state] of states) {
        if (state === "re") clauses.push(makeRequired(id));
        else if (state === "ex") clauses.push(makeExcluded(id));
    }
    if (states.size > 0) {
        clauses.push(makeInclusion(Array.from(states.keys())));
    }
    return clauses;
}

/**
 * Builds the text-search AND clause for a non-null query string.
 * - `"exact"` mode: the whole query must appear as a substring in the search field(s).
 * - `"keywords"` mode: the query is split on whitespace, and every word must independently
 *   appear as a substring in the search field(s).
 * `name` is always searched; `description` is included too when `searchDescription` is true.
 *
 * @param q - The query string (non-empty).
 * @param mode - Exact-match vs keyword-match.
 * @param searchDescription - Whether to also match against `description`.
 */
function buildTextSearchClause(q: string, mode: SearchMode, searchDescription: boolean): Prisma.hd_eventWhereInput {
    const fieldClauses = (text: string): Prisma.hd_eventWhereInput[] => {
        const clauses: Prisma.hd_eventWhereInput[] = [{ name: { contains: text } }];
        if (searchDescription) clauses.push({ description: { contains: text } });
        return clauses;
    };

    if (mode === "exact") {
        return { OR: fieldClauses(q) };
    }

    const words = q.split(/\s+/).filter(word => word.length > 0);
    return { AND: words.map(word => ({ OR: fieldClauses(word) })) };
}

/**
 * Builds a Prisma `hd_event` WhereInput from the given timeline filters.
 * Date bounds are compared against `event_start_key`/`event_end_key` (the event's true earliest/
 * latest possible instant — see earliestUnix/latestUnix in flexidate.ts).
 * Soft-deleted events, and soft-deleted tag/person applications, are always excluded
 * regardless of which filters are active.
 *
 * @param filters - The parsed timeline filters to apply.
 * @returns A Prisma WhereInput; always includes a `soft_deleted: false` condition.
 */
export function buildTimelineWhere(filters: TimelineFilters): Prisma.hd_eventWhereInput {
    const andClauses: Prisma.hd_eventWhereInput[] = [{ soft_deleted: false }];
    
    // Tag filters
    andClauses.push(...buildAxisClauses(
        filters.tags,
        id => ({ hd_event_tag: { some: { tag_id: id, soft_deleted: false } } }),
        id => ({ hd_event_tag: { none: { tag_id: id, soft_deleted: false } } }),
        notIncludedIds => ({
            hd_event_tag: {
                some: { tag_id: notIncludedIds.length > 0 ? { notIn: notIncludedIds } : undefined, soft_deleted: false }
            }
        })
    ));

    // Person filters
    andClauses.push(...buildAxisClauses(
        filters.persons,
        id => ({ hd_event_person: { some: { person_id: id, soft_deleted: false } } }),
        id => ({ hd_event_person: { none: { person_id: id, soft_deleted: false } } }),
        notIncludedIds => ({
            hd_event_person: {
                some: { person_id: notIncludedIds.length > 0 ? { notIn: notIncludedIds } : undefined, soft_deleted: false }
            }
        })
    ));

    // Date range — inclusive requires the event's range to overlap [from, to]; exclusive requires
    //   it to fall entirely within [from, to]
    // TODO: This ignores timezones. Is this correct?
    if (filters.dateMode === "exclusive") {
        if (filters.from !== null) andClauses.push({ event_start_key: { gte: filters.from } });
        if (filters.to !== null) andClauses.push({ event_end_key: { lte: filters.to } });
    } else {
        if (filters.from !== null) andClauses.push({ event_end_key: { gte: filters.from } });
        if (filters.to !== null) andClauses.push({ event_start_key: { lte: filters.to } });
    }

    // Text search across name and (optionally) description
    if (filters.q !== null) {
        andClauses.push(buildTextSearchClause(filters.q, filters.qMode, filters.qSearchDescription));
    }

    return { AND: andClauses };
}
