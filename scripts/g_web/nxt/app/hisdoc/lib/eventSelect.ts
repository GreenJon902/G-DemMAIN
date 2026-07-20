/** Common Prisma select shape for FlexiDate-bearing event fields, shared by pages that list events. */
export const EVENT_SELECT = {
    id: true,
    name: true,
    event_date_type: true,
    event_date1: true,
    event_date_time_offset: true,
    event_date_units: true,
    event_date_diff: true,
    event_date2: true
} as const;
