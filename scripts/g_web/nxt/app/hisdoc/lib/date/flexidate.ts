import { pad2, floorDivBigInt } from "./utils";

/**
 * hd_event's 6 FlexiDate columns (see doc/Databases.md) — a fuzzy-date system: either a single
 * date with an uncertainty margin ("centered"), or a date range ("ranged").
 *
 * IMPORTANT: event_date1/event_date_diff/event_date2 are NOT relative to UTC. They're the
 * submitter's own local wall-clock count as entered in the event form — the picker's literal
 * digits, reinterpreted as if they were UTC, with zero offset math applied. event_date_time_offset
 * separately records (best-effort) what the real UTC offset was believed to be at entry time —
 * true UTC seconds = `value * unit_seconds - event_date_time_offset * 60`. This is a deliberate
 * legacy decision (see doc/Databases.md), not a bug.
 *
 * Parameterised over the numeric type of event_date1/event_date_diff/event_date2: `bigint` (the
 * default) for display/computation, `number` for round-tripping through changelog JSON snapshots
 * (see changelog/lib/fieldDiffs.ts), which can't carry bigint.
 */
export type FlexiDate<N = bigint> = {
    event_date_type: "centered" | "ranged";
    event_date1: N;
    event_date_time_offset: number;
    event_date_units: "d" | "h" | "m" | null;
    event_date_diff: N | null;
    event_date2: N | null;
};

/** The number of seconds in each unit. */
const UNIT_MULTIPLIERS: Record<"d" | "h" | "m", bigint> = {
    d: 86400n,
    h: 3600n,
    m: 60n
};

/**
 * Formats a UTC offset in minutes as a signed "(+|-)HH:MM" string, e.g. `60` -> `"+01:00"`,
 * `-30` -> `"-00:30"`. Used both for the event form's offset input field (matching the legacy Java
 * form's own offset field before it) and for the "(UTC+...)" suffix in {@link formatFlexiDate}.
 * @param offsetMinutes - The UTC offset in minutes.
 */
export function formatSignedOffset(offsetMinutes: number): string {
    const sign = offsetMinutes < 0 ? "-" : "+";
    const abs = Math.abs(offsetMinutes);
    return `${sign}${pad2(Math.trunc(abs / 60))}:${pad2(abs % 60)}`;
}

/**
 * Parses a signed "(+|-)HH:MM" offset string (as produced by {@link formatSignedOffset}) back into
 * minutes. The sign is required, hours must be 00-23, and minutes must be 00-59. Returns null if
 * unparseable or out of range.
 * @param value - The offset string to parse.
 */
export function parseSignedOffset(value: string): number | null {
    const match = /^([+-])([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
    if (!match) return null;
    const [, sign, hoursStr, minsStr] = match;
    const minutes = Number(hoursStr) * 60 + Number(minsStr);
    return sign === "-" ? -minutes : minutes;
}

/**
 * Formats a unix timestamp (in seconds) as a YYYY-MM-DD string.
 *
 * Reads it back via getUTC* purely as a convenient way to extract calendar fields — unixSeconds is
 * already the FlexiDate's own (non-UTC) local wall-clock count reinterpreted as an epoch value, so
 * the result is that same local time, not a true UTC render.
 *
 * @param unixSeconds - The FlexiDate's stored count, scaled to seconds.
 */
function formatDate(unixSeconds: bigint): string {
    const d = new Date(Number(unixSeconds * 1000n));
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/**
 * Formats a unix timestamp (in seconds) as a YYYY-MM-DD HH:MM string.
 *
 * See {@link formatDate}'s note — the getUTC* read here isn't a true UTC render, just a convenient
 * way to pull calendar fields back out of the FlexiDate's own (non-UTC) local wall-clock count.
 *
 * @param unixSeconds - The FlexiDate's stored count, scaled to seconds.
 */
function formatDateTime(unixSeconds: bigint): string {
    const d = new Date(Number(unixSeconds * 1000n));
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

/**
 * Formats a unix timestamp (in seconds) as a YYYY-MM-DD HH:?? string. The minutes are rendered as
 * "??" rather than "00" because hour precision only pins down the hour, not the minute.
 *
 * See {@link formatDate}'s note — the getUTC* read here isn't a true UTC render, just a convenient
 * way to pull calendar fields back out of the FlexiDate's own (non-UTC) local wall-clock count.
 *
 * @param unixSeconds - The FlexiDate's stored count, scaled to seconds.
 */
function formatHourDateTime(unixSeconds: bigint): string {
    const d = new Date(Number(unixSeconds * 1000n));
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:??`;
}

/**
 * Formats a FlexiDate for human display.
 *
 * Centered dates are rendered as `"<date> ± <diff><unit> (<offset>)"`. The time component is
 * included only when the unit is hours or minutes; hour precision renders the minutes as "??"
 * since only the hour is known. Ranged dates are rendered as `"Between <date1> and <date2>
 * (<offset>)"`. The UTC suffix is omitted when the offset is zero.
 *
 * @param date - The FlexiDate to format.
 */
export function formatFlexiDate(date: FlexiDate): string {
    const offset = date.event_date_time_offset;
    const suffix = offset !== 0 ? ` (UTC${formatSignedOffset(offset)})` : "";

    if (date.event_date_type === "ranged") {
        const start = formatDate(date.event_date1 * 86400n);
        const end = formatDate(date.event_date2! * 86400n);
        return `Sometime between ${start} and ${end}${suffix}`;
    }

    // Centered
    const units = date.event_date_units!;
    const multiplier = UNIT_MULTIPLIERS[units];
    const centerUnix = date.event_date1 * multiplier;

    let dateStr: string;
    if (units === "d") {
        dateStr = formatDate(centerUnix);
    } else if (units === "h") {
        dateStr = formatHourDateTime(centerUnix);
    } else {
        dateStr = formatDateTime(centerUnix);
    }

    const plusmins = (date.event_date_diff !== 0n) ? `± ${date.event_date_diff}${units}` : "";

    return `${dateStr} ${plusmins}${suffix}`;
}

/**
 * Returns the earliest possible true-UTC unix timestamp in seconds for a FlexiDate.
 * - Centered: `(event_date1 - event_date_diff) * unitMultiplier - event_date_time_offset * 60`
 * - Ranged: `event_date1 * 86400 - event_date_time_offset * 60`
 *
 * Subtracts the offset to convert the FlexiDate's own (non-UTC) local wall-clock count into a true
 * UTC instant — needed for correct chronological ordering across events entered with different
 * offsets (see the FlexiDate type's own doc comment). Not identical to event_start_key in
 * doc/Databases.md, which additionally anchors to midday for sort-ordering purposes — this
 * function returns a true bound instead, for range validation (see form/actions.tsx).
 *
 * @param date - The FlexiDate to compute from.
 */
export function earliestUnix(date: FlexiDate): bigint {
    const raw = date.event_date_type === "ranged"
        ? date.event_date1 * 86400n
        : (date.event_date1 - date.event_date_diff!) * UNIT_MULTIPLIERS[date.event_date_units!];
    return raw - BigInt(date.event_date_time_offset * 60);
}

/**
 * Returns the latest possible true-UTC unix timestamp in seconds for a FlexiDate.
 * - Centered, day precision: `(event_date1 + event_date_diff) * 86400 + 86399 - event_date_time_offset * 60`
 * - Centered, hour/minute precision: `(event_date1 + event_date_diff) * unitMultiplier - event_date_time_offset * 60`
 * - Ranged: `event_date2 * 86400 + 86399 - event_date_time_offset * 60`
 *
 * Day precision carries no time-of-day, so the day itself only ends the second before the next
 * day's midnight (23:59:59, i.e. +86399s) — without this, the "latest possible" bound would
 * actually be the day's very first instant, which is backwards for an upper bound. Hour/minute
 * precision already pins an exact instant, so no adjustment is needed there.
 *
 * See {@link earliestUnix}'s note on the offset subtraction. Not identical to event_end_key in
 * doc/Databases.md, which additionally anchors to midday for sort-ordering purposes — this
 * function returns a true bound instead, for range validation (see form/actions.tsx).
 *
 * @param date - The FlexiDate to compute from.
 */
export function latestUnix(date: FlexiDate): bigint {
    let raw: bigint;
    if (date.event_date_type === "ranged") {
        raw = date.event_date2! * 86400n + 86399n;
    } else {
        const units = date.event_date_units!;
        raw = (date.event_date1 + date.event_date_diff!) * UNIT_MULTIPLIERS[units];
        if (units === "d") raw += 86399n;
    }
    return raw - BigInt(date.event_date_time_offset * 60);
}

// The earliest/latest instant a FlexiDate can represent must stay inside what MySQL's DATETIME
// type supports, matching the event form's date-picker min/max
export const MIN_FLEXIDATE_UNIX = Date.UTC(1000, 0, 1) / 1000;
export const MAX_FLEXIDATE_UNIX = Date.UTC(9999, 11, 31, 23, 59, 59) / 1000;

/**
 * Formats a value measured in `units` since epoch as the corresponding picker input value: a
 * `YYYY-MM-DD` string for day units (<input type="date">), or `YYYY-MM-DDTHH:MM` for hour/minute
 * units (<input type="datetime-local">). Inverse of parseDateInputValue.
 *
 * See {@link formatDate}'s note — the getUTC* read here isn't a true UTC render, just a convenient
 * way to pull calendar fields back out of the FlexiDate's own (non-UTC) local wall-clock count.
 *
 * @param value - The stored count of `units` since epoch (e.g. hd_event.event_date1).
 * @param units - The unit the value is measured in.
 */
export function formatDateInputValue(value: bigint, units: "d" | "h" | "m"): string {
    const unix = value * UNIT_MULTIPLIERS[units];
    const d = new Date(Number(unix * 1000n));
    const date = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
    if (units === "d") return date;
    return `${date}T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

/**
 * Parses a date / datetime-local picker value back into a count of `units` since epoch, treating
 * the picker's literal wall-clock digits as if they were UTC (see the FlexiDate type's own doc
 * comment) — no offset math involved. Returns null for an empty or unparseable value.
 *
 * The result is always an exact multiple of `units` (day values always fall on a UTC midnight, hour
 * values on the hour, since the picker never supplies finer precision than that), so integer
 * rounding here is just guarding against floating-point noise, not compensating for a real fraction.
 *
 * @param value - The picker's value string (`YYYY-MM-DD` or `YYYY-MM-DDTHH:MM[:SS]`).
 * @param units - The unit to measure the result in.
 */
export function parseDateInputValue(value: string, units: "d" | "h" | "m"): bigint | null {
    if (!value) return null;
    // Date-only values get a midnight time; either way a trailing Z pins parsing to UTC so the
    // browser's local timezone never leaks in
    const ms = Date.parse(value.includes("T") ? value + "Z" : value + "T00:00:00Z");
    if (isNaN(ms)) return null;
    const unix = ms / 1000;
    const multiplier = Number(UNIT_MULTIPLIERS[units]);
    return BigInt(Math.round(unix / multiplier));
}

/**
 * Converts a count of `fromUnits` since epoch into the equivalent count of `toUnits` since epoch,
 * operating directly on the underlying instant rather than round-tripping through a formatted
 * picker string. Precision increases (e.g. d → h) are exact, since the multipliers nest evenly;
 * precision decreases (e.g. h → d) floor to the start of the coarser unit's bucket rather than
 * rounding, so reducing precision drops the extra detail instead of shifting the date/hour
 * forward.
 *
 * @param count - The stored count, measured in `fromUnits`.
 * @param fromUnits - The unit `count` is currently measured in.
 * @param toUnits - The unit to convert to.
 */
export function convertFlexiDateCount(count: bigint, fromUnits: "d" | "h" | "m", toUnits: "d" | "h" | "m"): bigint {
    if (fromUnits === toUnits) return count;
    const unix = count * UNIT_MULTIPLIERS[fromUnits];
    return floorDivBigInt(unix, UNIT_MULTIPLIERS[toUnits]);
}

/**
 * Converts a number-encoded FlexiDate — e.g. a changelog JSON snapshot, or an API/DB row
 * serialised across a client/server boundary — into the bigint-based shape used for display and
 * computation. Loosely typed on the input since current callers (changelog snapshots, the
 * timeline API) hand back plain JSON-safe fields rather than the literal unions FlexiDate itself
 * uses.
 *
 * @param fields - The number-encoded FlexiDate fields to convert.
 */
export function toFlexiDate(fields: {
    event_date_type: string;
    event_date1: number;
    event_date_time_offset: number | null;
    event_date_units: string | null;
    event_date_diff: number | null;
    event_date2: number | null;
}): FlexiDate {
    return {
        event_date_type: fields.event_date_type as "centered" | "ranged",
        event_date1: BigInt(fields.event_date1),
        event_date_time_offset: fields.event_date_time_offset ?? 0,
        event_date_units: fields.event_date_units as "d" | "h" | "m" | null,
        event_date_diff: fields.event_date_diff !== null ? BigInt(fields.event_date_diff) : null,
        event_date2: fields.event_date2 !== null ? BigInt(fields.event_date2) : null
    };
}

/**
 * Parses raw form fields into a typed FlexiDate. Returns null if required
 * fields are missing or cannot be parsed.
 *
 * Field names: `date_type`, `date1`, `date_time_offset`, `date_units`, `date_diff`, `date2`.
 * For centered dates, `date_units` and `date_diff` are required; `date2` is ignored.
 * For ranged dates, `date2` is required; `date_units` and `date_diff` are ignored.
 *
 * @param fields - Raw FormData from a submitted form.
 */
export function parseFlexiDateForm(fields: FormData): FlexiDate | null {
    const dateType = fields.get("date_type");
    if (dateType !== "centered" && dateType !== "ranged") return null;

    const date1Str = fields.get("date1");
    const offsetStr = fields.get("date_time_offset");
    if (!date1Str || !offsetStr) return null;

    let date1: bigint;
    try {
        date1 = BigInt(date1Str as string);
    } catch {
        return null;
    }

    const offset = parseSignedOffset(offsetStr as string);
    if (offset === null) return null;

    if (dateType === "centered") {
        const unitsRaw = fields.get("date_units");
        const diffStr = fields.get("date_diff");
        if (!unitsRaw || !diffStr) return null;
        if (unitsRaw !== "d" && unitsRaw !== "h" && unitsRaw !== "m") return null;

        let diff: bigint;
        try {
            diff = BigInt(diffStr as string);
        } catch {
            return null;
        }

        return {
            event_date_type: "centered",
            event_date1: date1,
            event_date_time_offset: offset,
            event_date_units: unitsRaw,
            event_date_diff: diff,
            event_date2: null
        };
    }

    // ranged
    const date2Str = fields.get("date2");
    if (!date2Str) return null;

    let date2: bigint;
    try {
        date2 = BigInt(date2Str as string);
    } catch {
        return null;
    }

    return {
        event_date_type: "ranged",
        event_date1: date1,
        event_date_time_offset: offset,
        event_date_units: null,
        event_date_diff: null,
        event_date2: date2
    };
}
