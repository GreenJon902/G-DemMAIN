import { z } from "zod";
import { hd_changelog_what, hd_person_type, hd_event_event_date_type, hd_event_event_date_units } from "@g/com/prisma/enums";
import { FlexiDate } from "../../lib/date/flexidate";

// A "builder" is registered per (what, schema_version) pair in BUILDERS below: it validates the
// already-JSON.parsed before/after values against its own schema and builds the concrete list of
// FieldDiff records (one per rendered row) directly off them. This intentionally fuses "what does
// this JSON shape look like" with "what fields get rendered" for a given schema version, so
// FieldDiffRow never has to touch the raw snapshot shape (no generics, no keyof-T indexing, no
// casts) — it just switches on FieldDiff.kind, which TypeScript narrows exhaustively on its own.
// The FieldDiff types themselves are schema-version-agnostic (see below); only the builders and the
// `*SnapshotV1` types are version-specific. A future schema_version 2 gets its own sibling
// `*SnapshotV2` type and builder, registered alongside v1/v0 in BUILDERS — not a change to v1's.

/** Thrown by {@link buildFieldDiffs} when there's no builder registered for (`what`, `schemaVersion`). */
export class UnsupportedSchemaVersionError extends Error {
    constructor(public readonly schemaVersion: number) {
        super(`Unsupported hd_changelog schema_version: ${schemaVersion}`);
    }
}

// Generic (schema-version-agnostic) shapes used by the FieldDiff union below. These describe what
// a renderer needs, not what any particular schema version's JSON looks like — a builder for a
// future schema version maps its own snapshot shape onto these same types.

/** An embedded tag reference, as recorded in an EVENT snapshot's `tags` array. */
export type TagRelationItem = { id: number; name: string; color: number };
/** An embedded person reference, as recorded in an EVENT snapshot's `persons` array. */
export type PersonRelationItem = { id: number; type: hd_person_type; data: string };
/** An embedded related-event reference, as recorded in an EVENT snapshot's `relatedEvents` array. */
export type EventRelationItem = { id: number; name: string };

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
type FlexiDateFieldDiff = { kind: "flexidate"; label: string; old: FlexiDate<number> | undefined; new: FlexiDate<number> | undefined };
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

/** hd_changelog schema_version 1 snapshot of an hd_tag row (see doc/Databases.md). */
const TAG_SNAPSHOT_V1_SCHEMA = z.object({
    id: z.number(),
    name: z.string(),
    description: z.string(),
    color: z.number(),
    soft_deleted: z.boolean()
});
export type TagSnapshotV1 = z.infer<typeof TAG_SNAPSHOT_V1_SCHEMA>;

/** hd_changelog schema_version 1 snapshot of an hd_person row (see doc/Databases.md). */
const PERSON_SNAPSHOT_V1_SCHEMA = z.object({
    id: z.number(),
    type: z.enum(hd_person_type),
    data: z.string(),
    linked_user_id: z.number().nullable(),
    soft_deleted: z.boolean()
});
export type PersonSnapshotV1 = z.infer<typeof PERSON_SNAPSHOT_V1_SCHEMA>;

/**
 * hd_changelog schema_version 1 snapshot of an hd_event row plus its active relations at the time
 * of the change (see doc/Databases.md). `event_date1`/`event_date_diff`/`event_date2` come back as
 * `number` rather than `bigint` since `toChangelogJson` (com/lib/prisma/hisdoc/changelog.ts)
 * converts BigInt->Number before JSON.stringify — use `toFlexiDate` (lib/date/flexidate.ts) to convert back.
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

export type BuiltFieldDiffs = {
    fields: FieldDiff[];
    before: TagSnapshotV1 | PersonSnapshotV1 | EventSnapshotV1 | null;
    after: TagSnapshotV1 | PersonSnapshotV1 | EventSnapshotV1 | null;
};

/** A builder validates the already-JSON.parsed before/after values for one (what, schema_version) pair and builds its field-diff rows. */
type Builder = (rawBefore: unknown, rawAfter: unknown) => BuiltFieldDiffs;

/** Builds the field-diff rows for a TAG changelog entry against schema_version 1's shape. */
function buildTagFieldDiffsV1(rawBefore: unknown, rawAfter: unknown): BuiltFieldDiffs {
    const before = rawBefore === null ? null : TAG_SNAPSHOT_V1_SCHEMA.parse(rawBefore);
    const after = rawAfter === null ? null : TAG_SNAPSHOT_V1_SCHEMA.parse(rawAfter);

    const fields: FieldDiff[] = [
        { kind: "text", label: "Name", old_value: before?.name, new_value: after?.name },
        { kind: "longtext", label: "Description", old_value: before?.description, new_value: after?.description },
        { kind: "color", label: "Color", old_value: before?.color, new_value: after?.color },
        { kind: "boolean", label: "Deleted", old_value: before?.soft_deleted, new_value: after?.soft_deleted }
    ];
    return { fields, before, after };
}

/** Builds the field-diff rows for a PERSON changelog entry against schema_version 1's shape. */
function buildPersonFieldDiffsV1(rawBefore: unknown, rawAfter: unknown): BuiltFieldDiffs {
    const before = rawBefore === null ? null : PERSON_SNAPSHOT_V1_SCHEMA.parse(rawBefore);
    const after = rawAfter === null ? null : PERSON_SNAPSHOT_V1_SCHEMA.parse(rawAfter);

    const fields: FieldDiff[] = [
        { kind: "personType", label: "Type", old_value: before?.type, new_value: after?.type },
        { kind: "rawText", label: "Data", old_value: before?.data, new_value: after?.data },
        { kind: "userRef", label: "Linked User", old_value: before?.linked_user_id, new_value: after?.linked_user_id },
        { kind: "boolean", label: "Deleted", old_value: before?.soft_deleted, new_value: after?.soft_deleted }
    ];
    return { fields, before, after };
}

/** Builds the field-diff rows for an EVENT changelog entry against schema_version 1's shape. */
function buildEventFieldDiffsV1(rawBefore: unknown, rawAfter: unknown): BuiltFieldDiffs {
    const before = rawBefore === null ? null : EVENT_SNAPSHOT_V1_SCHEMA.parse(rawBefore);
    const after = rawAfter === null ? null : EVENT_SNAPSHOT_V1_SCHEMA.parse(rawAfter);

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

/** hd_changelog schema_version 0: legacy entries imported with no structured snapshot data — always `{}`. Shared across every `what`, since there's nothing type-specific to validate or render. */
const EMPTY_SNAPSHOT_SCHEMA = z.object({});

/** Builds an empty field-diff result for schema_version 0: validates the JSON is at least a plain object, but there's nothing structured to show. */
function buildEmptyFieldDiffs(rawBefore: unknown, rawAfter: unknown): BuiltFieldDiffs {
    if (rawBefore !== null) EMPTY_SNAPSHOT_SCHEMA.parse(rawBefore);
    if (rawAfter !== null) EMPTY_SNAPSHOT_SCHEMA.parse(rawAfter);
    return { fields: [], before: null, after: null };
}

// Every (what, schema_version) pair this app can render a diff for. A future schema_version 2 for,
// say, EVENT gets its own buildEventFieldDiffsV2 and a `2: buildEventFieldDiffsV2` entry here — not
// a change to buildEventFieldDiffsV1.
const BUILDERS: Record<hd_changelog_what, Record<number, Builder>> = {
    [hd_changelog_what.TAG]: { 0: buildEmptyFieldDiffs, 1: buildTagFieldDiffsV1 },
    [hd_changelog_what.PERSON]: { 0: buildEmptyFieldDiffs, 1: buildPersonFieldDiffsV1 },
    [hd_changelog_what.EVENT]: { 0: buildEmptyFieldDiffs, 1: buildEventFieldDiffsV1 }
};

/**
 * Parses both sides of a changelog entry against the builder registered for (`what`, `schemaVersion`)
 * and builds its field-diff rows. Throws {@link UnsupportedSchemaVersionError} if there's no builder
 * registered for that pair, or (SyntaxError on malformed JSON, ZodError on a shape mismatch)
 * otherwise — callers should catch all of these and fall back to a raw-JSON display.
 */
export function buildFieldDiffs(schemaVersion: number, what: hd_changelog_what, rawOld: string | null, rawNew: string | null): BuiltFieldDiffs {
    const builder = BUILDERS[what][schemaVersion];
    if (builder === undefined) throw new UnsupportedSchemaVersionError(schemaVersion);
    return builder(rawOld === null ? null : JSON.parse(rawOld), rawNew === null ? null : JSON.parse(rawNew));
}
