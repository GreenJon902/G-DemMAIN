import { z } from "zod";
import { hd_person_type, hd_event_event_date_type, hd_event_event_date_units } from "@g/com/prisma/enums";
import { FlexiDateInput } from "../../lib/flexidate";

// One build function per hd_changelog "what", each pairing schema-version-aware parsing with a
// concrete list of FieldDiff records (one per rendered row) built directly off the parsed
// before/after snapshots. This intentionally fuses "what does this JSON shape look like" with
// "what fields get rendered" for a given schema version, so FieldDiffRow never has to touch the
// raw snapshot shape (no generics, no keyof-T indexing, no casts) — it just switches on
// FieldDiff.kind, which TypeScript narrows exhaustively on its own. The FieldDiff types
// themselves are schema-version-agnostic (see below); only the build* functions and the
// `*SnapshotV1` types are version-specific. A future schema_version 2 gets its own sibling
// `*SnapshotV2` type and `build*FieldDiffs` additions, not a generalization of these.

/** Thrown by the build* functions below when `schemaVersion` has no registered schema. */
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

// Generic (schema-version-agnostic) shapes used by the FieldDiff union below. These describe what
// a renderer needs, not what any particular schema version's JSON looks like — a build* function
// for a future schema version maps its own snapshot shape onto these same types.

/** An embedded tag reference, as recorded in an EVENT snapshot's `tags` array. */
export type TagRelationItem = { id: number; name: string; color: number };
/** An embedded person reference, as recorded in an EVENT snapshot's `persons` array. */
export type PersonRelationItem = { id: number; type: hd_person_type; data: string };
/** An embedded related-event reference, as recorded in an EVENT snapshot's `relatedEvents` array. */
export type EventRelationItem = { id: number; name: string };

/** hd_event's 6 FlexiDate columns, in the number-encoded form they round-trip through changelog JSON as. */
export type FlexiDateFields = {
    event_date_type: hd_event_event_date_type;
    event_date1: number;
    event_date_time_offset: number;
    event_date_units: hd_event_event_date_units | null;
    event_date_diff: number | null;
    event_date2: number | null;
};

/** Converts a snapshot's number-encoded date fields back to the bigint-based shape FlexiDateDisplay expects. */
export function toFlexiDateInput(fields: FlexiDateFields): FlexiDateInput {
    return {
        event_date_type: fields.event_date_type,
        event_date1: BigInt(fields.event_date1),
        event_date_time_offset: fields.event_date_time_offset,
        event_date_units: fields.event_date_units,
        event_date_diff: fields.event_date_diff === null ? null : BigInt(fields.event_date_diff),
        event_date2: fields.event_date2 === null ? null : BigInt(fields.event_date2)
    };
}

// A FieldDiff is one rendered row: its `kind` determines which renderer FieldDiffRow dispatches
// to, and (thanks to the discriminated union) also determines the concrete type of its old/new
// value(s) with no cast required at the point of use.

// "rawText" is a text field whose changed value is shown as explicit Before/After panels rather
// than a word-level diff — used for values (e.g. a Minecraft UUID) where word-diffing is meaningless
type TextFieldDiff = { kind: "text" | "longtext" | "nullableLongtext" | "rawText"; label: string; old_value: string | null | undefined; new_value: string | null | undefined };
type BooleanFieldDiff = { kind: "boolean"; label: string; old_value: boolean | undefined; new_value: boolean | undefined };
type ColorFieldDiff = { kind: "color"; label: string; old_value: number | undefined; new_value: number | undefined };
type PersonTypeFieldDiff = { kind: "personType"; label: string; old_value: hd_person_type | undefined; new_value: hd_person_type | undefined };
type DateTimeFieldDiff = { kind: "datetime"; label: string; old_value: string | undefined; new_value: string | undefined };
type UserRefFieldDiff = { kind: "userRef"; label: string; old_value: number | null | undefined; new_value: number | null | undefined };
/** The 6 hd_event date columns, treated as one logical field — never partially diffed. */
type FlexiDateFieldDiff = { kind: "flexidate"; label: string; old: FlexiDateFields | undefined; new: FlexiDateFields | undefined };
type TagsFieldDiff = { kind: "tags"; label: string; old: TagRelationItem[] | undefined; new: TagRelationItem[] | undefined };
type PersonsFieldDiff = { kind: "persons"; label: string; old: PersonRelationItem[] | undefined; new: PersonRelationItem[] | undefined };
type RelatedEventsFieldDiff = { kind: "relatedEvents"; label: string; old: EventRelationItem[] | undefined; new: EventRelationItem[] | undefined };

export type FieldDiff =
    | TextFieldDiff
    | BooleanFieldDiff
    | ColorFieldDiff
    | PersonTypeFieldDiff
    | DateTimeFieldDiff
    | UserRefFieldDiff
    | FlexiDateFieldDiff
    | TagsFieldDiff
    | PersonsFieldDiff
    | RelatedEventsFieldDiff;

export type BuiltFieldDiffs<T> = { fields: FieldDiff[]; before: T | null; after: T | null };

/**
 * Parses both sides of a TAG changelog entry against the schema registered for `schemaVersion`
 * and builds its field-diff rows. Throws {@link UnsupportedSchemaVersionError} if `schemaVersion`
 * has no registered schema, or (SyntaxError on malformed JSON, ZodError on a shape mismatch)
 * otherwise — callers should catch all of these and fall back to a raw-JSON display.
 */
export function buildTagFieldDiffs(schemaVersion: number, rawOld: string | null, rawNew: string | null): BuiltFieldDiffs<TagSnapshotV1> {
    const schema = TAG_SCHEMAS_BY_VERSION[schemaVersion];
    if (schema === undefined) throw new UnsupportedSchemaVersionError(schemaVersion);
    const before = rawOld === null ? null : schema.parse(JSON.parse(rawOld));
    const after = rawNew === null ? null : schema.parse(JSON.parse(rawNew));

    const fields: FieldDiff[] = [
        { kind: "text", label: "Name", old_value: before?.name, new_value: after?.name },
        { kind: "longtext", label: "Description", old_value: before?.description, new_value: after?.description },
        { kind: "color", label: "Color", old_value: before?.color, new_value: after?.color },
        { kind: "boolean", label: "Deleted", old_value: before?.soft_deleted, new_value: after?.soft_deleted }
    ];
    return { fields, before, after };
}

/** Same as {@link buildTagFieldDiffs}, for a PERSON changelog entry. */
export function buildPersonFieldDiffs(schemaVersion: number, rawOld: string | null, rawNew: string | null): BuiltFieldDiffs<PersonSnapshotV1> {
    const schema = PERSON_SCHEMAS_BY_VERSION[schemaVersion];
    if (schema === undefined) throw new UnsupportedSchemaVersionError(schemaVersion);
    const before = rawOld === null ? null : schema.parse(JSON.parse(rawOld));
    const after = rawNew === null ? null : schema.parse(JSON.parse(rawNew));

    const fields: FieldDiff[] = [
        { kind: "personType", label: "Type", old_value: before?.type, new_value: after?.type },
        { kind: "rawText", label: "Data", old_value: before?.data, new_value: after?.data },
        { kind: "userRef", label: "Linked User", old_value: before?.linked_user_id, new_value: after?.linked_user_id },
        { kind: "boolean", label: "Deleted", old_value: before?.soft_deleted, new_value: after?.soft_deleted }
    ];
    return { fields, before, after };
}

/** Same as {@link buildTagFieldDiffs}, for an EVENT changelog entry. */
export function buildEventFieldDiffs(schemaVersion: number, rawOld: string | null, rawNew: string | null): BuiltFieldDiffs<EventSnapshotV1> {
    const schema = EVENT_SCHEMAS_BY_VERSION[schemaVersion];
    if (schema === undefined) throw new UnsupportedSchemaVersionError(schemaVersion);
    const before = rawOld === null ? null : schema.parse(JSON.parse(rawOld));
    const after = rawNew === null ? null : schema.parse(JSON.parse(rawNew));

    const fields: FieldDiff[] = [
        { kind: "text", label: "Name", old_value: before?.name, new_value: after?.name },
        { kind: "longtext", label: "Description", old_value: before?.description, new_value: after?.description },
        { kind: "nullableLongtext", label: "Details", old_value: before?.details, new_value: after?.details },
        { kind: "userRef", label: "Posted By", old_value: before?.posted_by_user_id, new_value: after?.posted_by_user_id },
        { kind: "datetime", label: "Posted At", old_value: before?.posted_at, new_value: after?.posted_at },
        { kind: "flexidate", label: "Date", old: before ?? undefined, new: after ?? undefined },
        { kind: "tags", label: "Tags", old: before?.tags, new: after?.tags },
        { kind: "persons", label: "Persons", old: before?.persons, new: after?.persons },
        { kind: "relatedEvents", label: "Related Events", old: before?.relatedEvents, new: after?.relatedEvents },
        { kind: "boolean", label: "Deleted", old_value: before?.soft_deleted, new_value: after?.soft_deleted }
    ];
    return { fields, before, after };
}
