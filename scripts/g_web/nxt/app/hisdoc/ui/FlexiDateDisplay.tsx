import { FlexiDate, formatFlexiDate } from "../lib/date/flexidate";


/**
 * Displays a formatted FlexiDate string.
 *
 * Props mirror the six `FlexiDate` fields directly so callers can spread
 * a database row: `<FlexiDateDisplay {...event} />`.
 */
export function FlexiDateDisplay(date: FlexiDate) {
    return <span className="text-sm text-nowrap text-gray-400">{formatFlexiDate(date)}</span>;
}
