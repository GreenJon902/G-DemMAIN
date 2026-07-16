import { z } from "zod";
import { hd_person_type, hd_event_event_date_type, hd_event_event_date_units } from "@g/com/prisma/enums";
import { FlexiDateInput } from "../../lib/flexidate";

/** Thrown by the parse* functions below when `schemaVersion` has no registered schema. */
export class UnsupportedSchemaVersionError extends Error {
    constructor(public readonly schemaVersion: number) {
        super(`Unsupported hd_changelog schema_version: ${schemaVersion}`);
    }
}

/** hd_changelog schema_version 1 snapshot of an hd_tag row (see doc/Databases.md). */
const TAG_SNAPSHOT_V1_SCHEMA = z.object({
    id: z.number(),
    name: z.string(),
    description: z.string(),
    color: z.number(),
    soft_deleted: z.boolean()
});
export type TagSnapshotV1 = z.infer<typeof TAG_SNAPSHOT_V1_SCHEMA>;

const TAG_SCHEMAS_BY_VERSION: Record<number, z.ZodType<TagSnapshotV1>> = {
    1: TAG_SNAPSHOT_V1_SCHEMA
};

/** hd_changelog schema_version 1 snapshot of an hd_person row (see doc/Databases.md). */
const PERSON_SNAPSHOT_V1_SCHEMA = z.object({
    id: z.number(),
    type: z.enum(hd_person_type),
    data: z.string(),
    linked_user_id: z.number().nullable(),
    soft_deleted: z.boolean()
});
export type PersonSnapshotV1 = z.infer<typeof PERSON_SNAPSHOT_V1_SCHEMA>;

const PERSON_SCHEMAS_BY_VERSION: Record<number, z.ZodType<PersonSnapshotV1>> = {
    1: PERSON_SNAPSHOT_V1_SCHEMA
};

/**
 * hd_changelog schema_version 1 snapshot of an hd_event row plus its active relations at the time
 * of the change (see doc/Databases.md). `event_date1`/`event_date_diff`/`event_date2` come back as
 * `number` rather than `bigint` since `toChangelogJson` (com/lib/prisma/hisdoc/changelog.ts)
 * converts BigInt->Number before JSON.stringify — use {@link toFlexiDateInput} to convert back.
 */
const EVENT_SNAPSHOT_V1_SCHEMA = z.object({
    id: z.number(),
    name: z.string(),
    description: z.string(),
    details: z.string().nullable(),
    posted_by_user_id: z.number(),
    posted_at: z.string(),
    event_date_type: z.enum(hd_event_event_date_type),
    event_date1: z.number(),
    event_date_time_offset: z.number(),
    event_date_units: z.enum(hd_event_event_date_units).nullable(),
    event_date_diff: z.number().nullable(),
    event_date2: z.number().nullable(),
    soft_deleted: z.boolean(),
    tags: z.array(z.object({ id: z.number(), name: z.string(), color: z.number() })),
    persons: z.array(z.object({ id: z.number(), type: z.enum(hd_person_type), data: z.string() })),
    relatedEvents: z.array(z.object({ id: z.number(), name: z.string() }))
});
export type EventSnapshotV1 = z.infer<typeof EVENT_SNAPSHOT_V1_SCHEMA>;

const EVENT_SCHEMAS_BY_VERSION: Record<number, z.ZodType<EventSnapshotV1>> = {
    1: EVENT_SNAPSHOT_V1_SCHEMA
};

/**
 * Parses and validates a raw hd_changelog.old_values/new_values string against the TAG schema
 * registered for `schemaVersion`. Returns null for a null column (no snapshot on this side).
 * Throws {@link UnsupportedSchemaVersionError} if `schemaVersion` has no registered schema, or
 * (SyntaxError on malformed JSON, ZodError on a shape mismatch) otherwise — callers should catch
 * all of these and fall back to a raw-JSON display.
 */
export function parseTagSnapshot(schemaVersion: number, raw: string | null): TagSnapshotV1 | null {
    if (raw === null) return null;
    const schema = TAG_SCHEMAS_BY_VERSION[schemaVersion];
    if (schema === undefined) throw new UnsupportedSchemaVersionError(schemaVersion);
    return schema.parse(JSON.parse(raw));
}

/** Same as {@link parseTagSnapshot}, validated against the PERSON schema registered for `schemaVersion`. */
export function parsePersonSnapshot(schemaVersion: number, raw: string | null): PersonSnapshotV1 | null {
    if (raw === null) return null;
    const schema = PERSON_SCHEMAS_BY_VERSION[schemaVersion];
    if (schema === undefined) throw new UnsupportedSchemaVersionError(schemaVersion);
    return schema.parse(JSON.parse(raw));
}

/** Same as {@link parseTagSnapshot}, validated against the EVENT schema registered for `schemaVersion`. */
export function parseEventSnapshot(schemaVersion: number, raw: string | null): EventSnapshotV1 | null {
    if (raw === null) return null;
    const schema = EVENT_SCHEMAS_BY_VERSION[schemaVersion];
    if (schema === undefined) throw new UnsupportedSchemaVersionError(schemaVersion);
    return schema.parse(JSON.parse(raw));
}

/** Converts an EventSnapshotV1's date fields back to the bigint-based shape FlexiDateDisplay expects. */
export function toFlexiDateInput(snapshot: EventSnapshotV1): FlexiDateInput {
    return {
        event_date_type: snapshot.event_date_type,
        event_date1: BigInt(snapshot.event_date1),
        event_date_time_offset: snapshot.event_date_time_offset,
        event_date_units: snapshot.event_date_units,
        event_date_diff: snapshot.event_date_diff === null ? null : BigInt(snapshot.event_date_diff),
        event_date2: snapshot.event_date2 === null ? null : BigInt(snapshot.event_date2)
    };
}
