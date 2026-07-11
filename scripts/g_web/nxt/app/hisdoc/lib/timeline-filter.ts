import type { Prisma } from "@g/com/prisma/client";

type TagFilterState = "re" | "ex" | "ig";  // required, excluded, inclusive-any-of
type PersonFilterState = "re" | "ex" | "ig";

export type TimelineFilters = {
    tags: Record<number, TagFilterState>;    // tag id → state; absent = included (no filtering effect)
    persons: Record<number, PersonFilterState>;
    from: bigint | null;    // earliest unix seconds bound (inclusive)
    to: bigint | null;      // latest unix seconds bound (inclusive)
    q: string | null;       // text search
};

/**
 * Parses a single `id:state` entry (e.g. `"3:re"`) into a typed tuple.
 * Returns null if the entry is malformed or the state value is unrecognised.
 */
function parseFilterEntry(entry: string): [number, "re" | "ex" | "ig"] | null {
    const colonIdx = entry.indexOf(":");
    if (colonIdx === -1) return null;
    const id = parseInt(entry.slice(0, colonIdx), 10);
    if (isNaN(id)) return null;
    const state = entry.slice(colonIdx + 1);
    if (state !== "re" && state !== "ex" && state !== "ig") return null;
    return [id, state];
}

/**
 * Parses a comma-separated `id:state` param string into a typed record.
 * Invalid entries are silently skipped.
 *
 * @param raw - The raw param value (e.g. `"3:re,7:ex,12:ig"`), or null if absent.
 */
function parseFilterParam(raw: string | null): Record<number, "re" | "ex" | "ig"> {
    if (!raw) return {};
    const result: Record<number, "re" | "ex" | "ig"> = {};
    for (const entry of raw.split(",")) {
        const parsed = parseFilterEntry(entry.trim());
        if (parsed) result[parsed[0]] = parsed[1];
    }
    return result;
}

/**
 * Parses URL search params into a TimelineFilters object.
 *
 * Expected params:
 * - `tags` — comma-separated `id:state` pairs (`re`/`ex`/`ig`); invalid entries skipped.
 * - `persons` — same format as `tags`.
 * - `from` / `to` — YYYY-MM-DD strings converted to unix seconds; absent or unparseable → null.
 * - `q` — raw text string; absent or empty → null.
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
        const ms = Date.parse(toStr);
        if (!isNaN(ms)) to = BigInt(Math.floor(ms / 1000));
    }

    const qRaw = params.get("q");
    const q = qRaw && qRaw.length > 0 ? qRaw : null;

    return { tags, persons, from, to, q };
}

/**
 * Builds a Prisma `hd_event` WhereInput from the given timeline filters.
 *
 * Tag/person states: `re` (required) → `some`, `ex` (excluded) → `none`, `ig`
 * (inclusive any-of, labelled "ignored" in the UI) → all `ig` ids collapsed into a single `some { in: [...] }`.
 * Date bounds are compared against `sort_key` (a pre-computed unix-seconds column).
 * Soft-deleted events, and soft-deleted tag/person applications, are always excluded
 * regardless of which filters are active.
 *
 * @param filters - The parsed timeline filters to apply.
 * @returns A Prisma WhereInput; always includes a `soft_deleted: false` condition.
 */
export function buildTimelineWhere(filters: TimelineFilters): Prisma.hd_eventWhereInput {
    const andClauses: Prisma.hd_eventWhereInput[] = [{ soft_deleted: false }];

    // Tag filters
    const inclusiveTags: number[] = [];
    for (const [idStr, state] of Object.entries(filters.tags)) {
        const id = Number(idStr);
        if (state === "re") {
            andClauses.push({ hd_event_tag: { some: { tag_id: id, soft_deleted: false } } });
        } else if (state === "ex") {
            andClauses.push({ hd_event_tag: { none: { tag_id: id, soft_deleted: false } } });
        } else {
            inclusiveTags.push(id);
        }
    }
    if (inclusiveTags.length > 0) {
        andClauses.push({ hd_event_tag: { some: { tag_id: { in: inclusiveTags }, soft_deleted: false } } });
    }

    // Person filters
    const inclusivePersons: number[] = [];
    for (const [idStr, state] of Object.entries(filters.persons)) {
        const id = Number(idStr);
        if (state === "re") {
            andClauses.push({ hd_event_person: { some: { person_id: id, soft_deleted: false } } });
        } else if (state === "ex") {
            andClauses.push({ hd_event_person: { none: { person_id: id, soft_deleted: false } } });
        } else {
            inclusivePersons.push(id);
        }
    }
    if (inclusivePersons.length > 0) {
        andClauses.push({ hd_event_person: { some: { person_id: { in: inclusivePersons }, soft_deleted: false } } });
    }

    // Date range — compared via the sort_key generated column (unix seconds)
    if (filters.from !== null) {
        andClauses.push({ sort_key: { gte: filters.from } });
    }
    if (filters.to !== null) {
        andClauses.push({ sort_key: { lte: filters.to } });
    }

    // Text search across name and description
    if (filters.q !== null) {
        andClauses.push({ OR: [
            { name: { contains: filters.q } },
            { description: { contains: filters.q } }
        ] });
    }

    return { AND: andClauses };
}
