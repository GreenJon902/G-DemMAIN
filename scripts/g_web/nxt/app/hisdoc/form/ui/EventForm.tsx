"use client";

import type { FlexiDateInput as FlexiDateValue } from "../../lib/flexidate";
import FlexiDateInput from "./FlexiDateInput";
import type { ActionResult } from "../../lib/actionHelpers";
import EntityForm from "./EntityForm";
import { FormRow, FormTextInput, FormLongTextInput } from "./FormInputs";
import { TagsSelect, PersonsSelect, RelatedEventsSelect } from "./RelationSelects";
import type { TagOption, PersonOption, EventOption } from "../lib/optionTypes";

/** Current values of an event, used to pre-fill the edit form. */
export type EventFormDefaults = {
    name: string,
    description: string,
    details: string | null,
    flexiDate: FlexiDateValue,
    tag_ids: Array<number>
};

/**
 * The event add/edit form: name, description, optional details, FlexiDate, and the tag/person/
 * related-event relation selectors, submitted through the generic EntityForm shell.
 *
 * @param action - The server action to call on submit. For add: addEvent directly; for edit: a bound wrapper like (fd) => editEvent(id, fd).
 * @param defaults - Current values for edit mode; undefined for add mode.
 * @param defaultPersons - The event's current persons (with resolved names); the full person list
 *   is never preloaded — PersonsSelect searches it server-side instead.
 * @param defaultRelatedEvents - The currently-related events (id + name); the full event list is
 *   never preloaded — RelatedEventsSelect searches it server-side instead.
 * @param excludeEventId - In edit mode, the event being edited, kept out of the related-events
 *   search results so it can't be related to itself.
 */
export default function EventForm(props: {
    action: (formData: FormData) => Promise<ActionResult>,
    isEdit?: boolean,
    submitLabel: string,
    defaults?: EventFormDefaults,
    tagOptions: Array<TagOption>,
    defaultPersons: Array<PersonOption>,
    defaultRelatedEvents: Array<EventOption>,
    excludeEventId?: number
}) {
    return (
        <EntityForm action={props.action} isEdit={props.isEdit} submitLabel={props.submitLabel} minLevel="editor">
            <FormTextInput name="name" label="Name" required maxLength={255} defaultValue={props.defaults?.name} />
            <FormLongTextInput name="description" label="Description" required rows={4} defaultValue={props.defaults?.description} />
            <FormLongTextInput name="details" label="Details" rows={6} defaultValue={props.defaults?.details ?? undefined} />
            <FormRow label="Date">
                <FlexiDateInput defaultValue={props.defaults?.flexiDate} />
            </FormRow>
            <FormRow label="Tags">
                <TagsSelect options={props.tagOptions} defaultSelectedIds={props.defaults?.tag_ids ?? []} />
            </FormRow>
            <FormRow label="Persons">
                <PersonsSelect defaultSelected={props.defaultPersons} />
            </FormRow>
            <FormRow label="Related Events">
                <RelatedEventsSelect defaultSelected={props.defaultRelatedEvents} excludeId={props.excludeEventId} />
            </FormRow>
        </EntityForm>
    );
}
