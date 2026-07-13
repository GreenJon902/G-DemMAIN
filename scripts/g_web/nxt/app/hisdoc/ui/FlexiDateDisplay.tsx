import { FlexiDateInput, formatFlexiDate } from "../lib/flexidate";


/**
 * Displays a formatted FlexiDate string.
 *
 * Props mirror the six `FlexiDateInput` fields directly so callers can spread
 * a database row: `<FlexiDateDisplay {...event} />`.
 */
export function FlexiDateDisplay(date: FlexiDateInput) {
    return <span className="text-sm text-nowrap text-gray-400">{formatFlexiDate(date)}</span>;
}
