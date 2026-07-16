import { TagSnapshotV1, PersonSnapshotV1, EventSnapshotV1 } from "./snapshot";

// One descriptor table per hd_changelog "what" per schema version, consumed by a single generic
// row-renderer (FieldDiffRow) instead of a hand-written render block per entity type — adding a
// column to hd_tag/hd_person/hd_event within the current schema version is meant to be a one-line
// change here, not new JSX. A future schema_version 2 (see snapshot.ts) gets its own sibling
// `*_FIELDS_V2` table alongside a `*SnapshotV2` type, not a generalization of these.

/** A scalar field diffed as a single before/after (or word-diffed, for text kinds) value. */
type ScalarField<T extends object> = {
    kind: "text" | "longtext" | "nullableLongtext" | "boolean" | "color" | "personType" | "datetime" | "userRef";
    key: keyof T & string;
    label: string;
};

/** The 6 hd_event date columns, treated as one logical field — never partially diffed. */
type FlexiDateField = { kind: "flexidate"; label: string };

/** One of an EVENT snapshot's embedded relation arrays (tags/persons/relatedEvents). */
type RelationField<T extends object> = { kind: "tags" | "persons" | "relatedEvents"; key: keyof T & string; label: string };

export type FieldDescriptor<T extends object> = ScalarField<T> | FlexiDateField | RelationField<T>;

export const TAG_FIELDS_V1: Array<FieldDescriptor<TagSnapshotV1>> = [
    { kind: "text", key: "name", label: "Name" },
    { kind: "longtext", key: "description", label: "Description" },
    { kind: "color", key: "color", label: "Color" },
    { kind: "boolean", key: "soft_deleted", label: "Deleted" }
];

/** Field table to use per hd_changelog.schema_version, for a TAG entry. */
export const TAG_FIELD_VERSIONS: Record<number, Array<FieldDescriptor<TagSnapshotV1>>> = {
    1: TAG_FIELDS_V1
};

export const PERSON_FIELDS_V1: Array<FieldDescriptor<PersonSnapshotV1>> = [
    { kind: "personType", key: "type", label: "Type" },
    { kind: "text", key: "data", label: "Data" },
    { kind: "userRef", key: "linked_user_id", label: "Linked User" },
    { kind: "boolean", key: "soft_deleted", label: "Deleted" }
];

/** Field table to use per hd_changelog.schema_version, for a PERSON entry. */
export const PERSON_FIELD_VERSIONS: Record<number, Array<FieldDescriptor<PersonSnapshotV1>>> = {
    1: PERSON_FIELDS_V1
};

export const EVENT_FIELDS_V1: Array<FieldDescriptor<EventSnapshotV1>> = [
    { kind: "text", key: "name", label: "Name" },
    { kind: "longtext", key: "description", label: "Description" },
    { kind: "nullableLongtext", key: "details", label: "Details" },
    { kind: "userRef", key: "posted_by_user_id", label: "Posted By" },
    { kind: "datetime", key: "posted_at", label: "Posted At" },
    { kind: "flexidate", label: "Date" },
    { kind: "tags", key: "tags", label: "Tags" },
    { kind: "persons", key: "persons", label: "Persons" },
    { kind: "relatedEvents", key: "relatedEvents", label: "Related Events" },
    { kind: "boolean", key: "soft_deleted", label: "Deleted" }
];

/** Field table to use per hd_changelog.schema_version, for an EVENT entry. */
export const EVENT_FIELD_VERSIONS: Record<number, Array<FieldDescriptor<EventSnapshotV1>>> = {
    1: EVENT_FIELDS_V1
};
