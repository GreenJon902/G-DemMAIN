import { pad2 } from "./utils";

/** Formats an exact Date as "yyyy/mm/dd", with no timezone suffix — shared by the two exports below. */
function formatDatePart(date: Date): string {
    return `${date.getUTCFullYear()}/${pad2(date.getUTCMonth() + 1)}/${pad2(date.getUTCDate())}`;
}

/** Formats an exact Date as "yyyy/mm/dd UTC". */
export function formatTimestampDate(date: Date): string {
    return `${formatDatePart(date)} UTC`;
}

/**
 * Formats an exact Date/time as "yyyy/mm/dd hh:mm:ss UTC".
 *
 * Rendered in UTC rather than the viewer's own timezone so it's deterministic regardless of
 * server config — note this may change to render in the viewing user's local timezone instead.
 */
export function formatTimestamp(date: Date): string {
    return `${formatDatePart(date)} ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())} UTC`;
}
