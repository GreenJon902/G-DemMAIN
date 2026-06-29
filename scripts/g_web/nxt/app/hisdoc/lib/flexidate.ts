export type FlexiDateInput = {
    event_date_type: "centered" | "ranged";
    event_date1: bigint;
    event_date_time_offset: number;  // UTC offset in minutes, e.g. 60 = UTC+1
    event_date_units: "d" | "h" | "m" | null;  // null for ranged
    event_date_diff: bigint | null;  // null for ranged
    event_date2: bigint | null;  // null for centered
};

/** The number of seconds in each unit. */
const UNIT_MULTIPLIERS: Record<"d" | "h" | "m", bigint> = {
    d: 86400n,
    h: 3600n,
    m: 60n
};

/**
 * Formats a UTC offset in minutes as a display string.
 * @param offsetMinutes - The UTC offset in minutes (e.g. 60 = UTC+1, -30 = UTC-30).
 */
export function formatOffset(offsetMinutes: number): string {
    if (offsetMinutes === 0) return "UTC";
    return `UTC${offsetMinutes > 0 ? "+" : ""}${offsetMinutes}`;
}

/**
 * Pads a number to two digits with a leading zero if needed.
 * @param n - The number to pad.
 */
function pad2(n: number): string {
    return String(n).padStart(2, "0");
}

/**
 * Formats a unix timestamp (in seconds) as a YYYY-MM-DD string, adjusted for the given UTC offset.
 * @param unixSeconds - Unix timestamp in seconds.
 * @param offsetMinutes - UTC offset in minutes to apply before formatting.
 */
function formatDate(unixSeconds: bigint, offsetMinutes: number): string {
    const ms = (unixSeconds + BigInt(offsetMinutes * 60)) * 1000n;
    const d = new Date(Number(ms));
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/**
 * Formats a unix timestamp (in seconds) as a YYYY-MM-DD HH:MM string, adjusted for the given UTC offset.
 * @param unixSeconds - Unix timestamp in seconds.
 * @param offsetMinutes - UTC offset in minutes to apply before formatting.
 */
function formatDateTime(unixSeconds: bigint, offsetMinutes: number): string {
    const ms = (unixSeconds + BigInt(offsetMinutes * 60)) * 1000n;
    const d = new Date(Number(ms));
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

/**
 * Formats a FlexiDate for human display.
 *
 * Centered dates are rendered as `"<date> ± <diff><unit> (<offset>)"`. The time
 * component is included only when the unit is hours or minutes. Ranged dates are
 * rendered as `"Between <date1> and <date2> (<offset>)"`. The UTC suffix is omitted
 * when the offset is zero.
 *
 * @param date - The FlexiDate to format.
 */
export function formatFlexiDate(date: FlexiDateInput): string {
    const offset = date.event_date_time_offset;
    const offsetStr = formatOffset(offset);
    const suffix = offset !== 0 ? ` (${offsetStr})` : "";

    if (date.event_date_type === "ranged") {
        const start = formatDate(date.event_date1 * 86400n, offset);
        const end = formatDate(date.event_date2! * 86400n, offset);
        return `Between ${start} and ${end}${suffix}`;
    }

    const units = date.event_date_units!;
    const multiplier = UNIT_MULTIPLIERS[units];
    const centerUnix = date.event_date1 * multiplier;

    let dateStr: string;
    if (units === "d") {
        dateStr = formatDate(centerUnix, offset);
    } else {
        dateStr = formatDateTime(centerUnix, offset);
    }

    return `${dateStr} ± ${date.event_date_diff}${units}${suffix}`;
}

/**
 * Returns the earliest possible unix timestamp in seconds for a FlexiDate.
 * - Centered: `(event_date1 - event_date_diff) * unitMultiplier`
 * - Ranged: `event_date1 * 86400`
 *
 * @param date - The FlexiDate to compute from.
 */
export function earliestUnix(date: FlexiDateInput): bigint {
    if (date.event_date_type === "ranged") {
        return date.event_date1 * 86400n;
    }
    const multiplier = UNIT_MULTIPLIERS[date.event_date_units!];
    return (date.event_date1 - date.event_date_diff!) * multiplier;
}

/**
 * Returns the latest possible unix timestamp in seconds for a FlexiDate.
 * - Centered: `(event_date1 + event_date_diff) * unitMultiplier`
 * - Ranged: `event_date2 * 86400`
 *
 * @param date - The FlexiDate to compute from.
 */
export function latestUnix(date: FlexiDateInput): bigint {
    if (date.event_date_type === "ranged") {
        return date.event_date2! * 86400n;
    }
    const multiplier = UNIT_MULTIPLIERS[date.event_date_units!];
    return (date.event_date1 + date.event_date_diff!) * multiplier;
}

/**
 * Parses raw form fields into a typed FlexiDateInput. Returns null if required
 * fields are missing or cannot be parsed.
 *
 * Field names: `date_type`, `date1`, `date_time_offset`, `date_units`, `date_diff`, `date2`.
 * For centered dates, `date_units` and `date_diff` are required; `date2` is ignored.
 * For ranged dates, `date2` is required; `date_units` and `date_diff` are ignored.
 *
 * @param fields - Raw FormData from a submitted form.
 */
export function parseFlexiDateForm(fields: FormData): FlexiDateInput | null {
    const dateType = fields.get("date_type");
    if (dateType !== "centered" && dateType !== "ranged") return null;

    const date1Str = fields.get("date1");
    const offsetStr = fields.get("date_time_offset");
    if (!date1Str || !offsetStr) return null;

    let date1: bigint;
    let offset: number;
    try {
        date1 = BigInt(date1Str as string);
        offset = Number(offsetStr);
        if (!Number.isFinite(offset)) return null;
    } catch {
        return null;
    }

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
