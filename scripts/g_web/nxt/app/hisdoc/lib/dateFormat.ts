/** Pads a number to two digits with a leading zero if needed. */
function pad2(n: number): string {
    return String(n).padStart(2, "0");
}

/** Formats an exact Date as "yyyy/mm/dd", in the server's local timezone. */
export function formatTimestampDate(date: Date): string {
    return `${date.getFullYear()}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;
}

/** Formats an exact Date/time as "yyyy/mm/dd hh:mm:ss", in the server's local timezone. */
export function formatTimestamp(date: Date): string {
    return `${formatTimestampDate(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}
