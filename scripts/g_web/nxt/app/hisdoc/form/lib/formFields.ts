/**
 * Declarative field specs for the generic hisdoc add/edit form, mirroring the changelog diff
 * generalisation (see changelog/lib/fieldDiffs.ts): a discriminated-union field spec, per-entity
 * build functions returning ordered field lists, and a single switch(kind) renderer
 * (form/ui/FormFieldInput.tsx).
 *
 * Everything here is plain serializable data — the build functions run in server components and
 * their results cross the RSC boundary into the client EntityForm, so specs carry no functions.
 * Default values are baked into each field, exactly like build*FieldDiffs bakes old/new values.
 */

import { hd_person_type } from "@g/com/prisma/enums";
import type { FlexiDateInput } from "../../lib/flexidate";
import { colorToHex } from "../../lib/color";

/** A selectable tag in the tags relation field. */
export type TagOption = { id: number, name: string, description: string, color: number };
/** A selectable person in the persons relation field. `displayName` is pre-resolved server-side. */
export type PersonOption = { id: number, displayName: string, type: hd_person_type };
/** A selectable event in the related-events relation field. */
export type EventOption = { id: number, name: string };

// FormData field names are chosen per-field via `name` for scalar kinds; relation and flexidate
// kinds serialize under fixed legacy names (tag_ids/person_ids/related_event_ids, date_*) so the
// existing parsers in actions.ts and lib/flexidate.ts keep working unchanged
type TextFormField = { kind: "text", name: string, label: string, defaultValue?: string, maxLength?: number };
type LongTextFormField = { kind: "longtext" | "nullableLongtext", name: string, label: string, defaultValue?: string, rows?: number };
type ColorFormField = { kind: "color", name: string, label: string, defaultValue?: string };  // "#rrggbb"
type PersonTypeFormField = { kind: "personType", name: string, label: string, defaultValue?: hd_person_type };
type FlexiDateFormField = { kind: "flexidate", label: string, defaultValue?: FlexiDateInput };
type TagsFormField = { kind: "tags", label: string, options: Array<TagOption>, defaultSelectedIds: Array<number> };
type PersonsFormField = { kind: "persons", label: string, options: Array<PersonOption>, defaultSelectedIds: Array<number> };
type RelatedEventsFormField = { kind: "relatedEvents", label: string, options: Array<EventOption>, defaultSelectedIds: Array<number> };

export type FormField =
    | TextFormField
    | LongTextFormField
    | ColorFormField
    | PersonTypeFormField
    | FlexiDateFormField
    | TagsFormField
    | PersonsFormField
    | RelatedEventsFormField;

/** Current values of an event, used to pre-fill the edit form. */
export type EventFormDefaults = {
    name: string,
    description: string,
    details: string | null,
    flexiDate: FlexiDateInput,
    tag_ids: Array<number>,
    person_ids: Array<number>,
    related_event_ids: Array<number>
};

/**
 * Builds the ordered field list for the event add/edit form.
 * @param defaults - Current values for edit mode; undefined for add mode.
 * @param options - Full lists of selectable tags, persons and relatable events.
 */
export function buildEventFormFields(
    defaults: EventFormDefaults | undefined,
    options: { tags: Array<TagOption>, persons: Array<PersonOption>, events: Array<EventOption> }
): Array<FormField> {
    return [
        { kind: "text", name: "name", label: "Name", defaultValue: defaults?.name, maxLength: 255 },
        { kind: "longtext", name: "description", label: "Description", defaultValue: defaults?.description, rows: 4 },
        { kind: "nullableLongtext", name: "details", label: "Details", defaultValue: defaults?.details ?? undefined, rows: 6 },
        { kind: "flexidate", label: "Date", defaultValue: defaults?.flexiDate },
        { kind: "tags", label: "Tags", options: options.tags, defaultSelectedIds: defaults?.tag_ids ?? [] },
        { kind: "persons", label: "Persons", options: options.persons, defaultSelectedIds: defaults?.person_ids ?? [] },
        { kind: "relatedEvents", label: "Related Events", options: options.events, defaultSelectedIds: defaults?.related_event_ids ?? [] }
    ];
}

/**
 * Builds the ordered field list for the person add/edit form.
 * Note linked_user_id is deliberately absent — it stays SQL-managed.
 * @param defaults - Current values for edit mode; undefined for add mode.
 */
export function buildPersonFormFields(defaults: { type: hd_person_type, data: string } | undefined): Array<FormField> {
    return [
        { kind: "personType", name: "type", label: "Type", defaultValue: defaults?.type },
        { kind: "text", name: "data", label: "Data (Minecraft UUID or NPC name)", defaultValue: defaults?.data, maxLength: 255 }
    ];
}

/**
 * Builds the ordered field list for the tag add/edit form.
 * @param defaults - Current values for edit mode; undefined for add mode.
 */
export function buildTagFormFields(defaults: { name: string, description: string, color: number } | undefined): Array<FormField> {
    return [
        { kind: "text", name: "name", label: "Name", defaultValue: defaults?.name, maxLength: 255 },
        { kind: "longtext", name: "description", label: "Description", defaultValue: defaults?.description, rows: 4 },
        // Native color inputs can't be empty, so add mode gets a fixed indigo default
        { kind: "color", name: "color", label: "Color", defaultValue: defaults ? colorToHex(defaults.color) : "#6366f1" }
    ];
}
