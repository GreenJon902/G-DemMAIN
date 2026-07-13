"use client";

import { useRef, useState } from "react";
import { useAuthContext, makeAreaSudoGuard } from "@/app/AuthContext";
import { ActionButton, BUTTON_GREEN } from "@/app/ui/Button";
import FlexiDateInput from "./FlexiDateInput";
import { TagChip } from "./TagChip";

interface EventFormProps {
    /** The server action to call on submit. For add: addEvent directly. For edit: a bound wrapper like (fd) => editEvent(id, fd). */
    action: (formData: FormData) => Promise<void>;
    tags: { id: number; name: string; description: string; color: number }[];
    persons: { id: number; displayName: string; type: "MINECRAFT" | "NPC" }[];
    /** All existing events for the related-events selector. */
    events: { id: number; name: string }[];
    /** Pre-filled values for edit mode; omit for add mode. */
    defaultValues?: {
        name: string;
        description: string;
        details: string | null;
        event_date_type: string;
        event_date1: bigint;
        event_date_time_offset: number | null;
        event_date_units: string | null;
        event_date_diff: bigint | null;
        event_date2: bigint | null;
        tag_ids: number[];
        person_ids: number[];
        related_event_ids: number[];
    };
    /** When true, shows the changelog note field and changes the submit label to "Save Changes". */
    isEdit?: boolean;
}

/**
 * A shared form for adding or editing a HisDoc event.
 *
 * In add mode (no defaultValues, isEdit omitted) all fields start empty.
 * In edit mode (defaultValues provided, isEdit true) fields are pre-filled and
 * a changelog note field is shown.
 *
 * Submission is handled by ActionButton, which builds FormData from the form ref
 * and passes it to the provided action. The <form> element is never submitted natively.
 *
 * @param props.action - Server action to invoke on submit.
 * @param props.tags - Full list of available tags.
 * @param props.persons - Full list of available persons.
 * @param props.events - All existing events available for linking.
 * @param props.defaultValues - Pre-filled field values for edit mode.
 * @param props.isEdit - When true, shows changelog note field and "Save Changes" label.
 */
export default function EventForm(props: EventFormProps) {
    const formRef = useRef<HTMLFormElement>(null);
    const ctx = useAuthContext();

    const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(
        () => new Set(props.defaultValues?.tag_ids ?? [])
    );
    const [selectedPersonIds, setSelectedPersonIds] = useState<Set<number>>(
        () => new Set(props.defaultValues?.person_ids ?? [])
    );
    const [selectedEventIds, setSelectedEventIds] = useState<Set<number>>(
        () => new Set(props.defaultValues?.related_event_ids ?? [])
    );

    /** Toggles a tag's selection state. */
    function toggleTag(id: number) {
        setSelectedTagIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }

    /** Toggles a person's selection state. */
    function togglePerson(id: number) {
        setSelectedPersonIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }

    /** Toggles a related event's selection state. */
    function toggleEvent(id: number) {
        setSelectedEventIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }

    // Coerce defaultValues into the shape FlexiDateInput expects
    const flexiDateDefault = props.defaultValues
        ? {
            event_date_type: props.defaultValues.event_date_type as "centered" | "ranged",
            event_date1: props.defaultValues.event_date1,
            event_date_time_offset: props.defaultValues.event_date_time_offset ?? 0,
            event_date_units: props.defaultValues.event_date_units as "d" | "h" | "m" | null,
            event_date_diff: props.defaultValues.event_date_diff,
            event_date2: props.defaultValues.event_date2
        }
        : undefined;

    return (
        <form ref={formRef}>
            <div className="flex max-w-2xl flex-col gap-6">

                <label className="flex flex-col gap-1">
                    <span className="text-sm text-gray-400">Name</span>
                    <input
                        name="name"
                        type="text"
                        required
                        maxLength={255}
                        defaultValue={props.defaultValues?.name}
                        className="w-full rounded bg-gray-700 px-3 py-2 text-white"
                    />
                </label>

                <label className="flex flex-col gap-1">
                    <span className="text-sm text-gray-400">Description</span>
                    <textarea
                        name="description"
                        required
                        rows={4}
                        defaultValue={props.defaultValues?.description}
                        className="w-full rounded bg-gray-700 px-3 py-2 text-white"
                    />
                </label>

                <label className="flex flex-col gap-1">
                    <span className="text-sm text-gray-400">Details</span>
                    <textarea
                        name="details"
                        rows={6}
                        defaultValue={props.defaultValues?.details ?? ""}
                        className="w-full rounded bg-gray-700 px-3 py-2 text-white"
                    />
                </label>

                <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold tracking-wide text-gray-400 uppercase">Date</h3>
                    <FlexiDateInput defaultValue={flexiDateDefault} />
                </div>

                <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold tracking-wide text-gray-400 uppercase">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                        {props.tags.map(tag => {
                            // >>> 0 coerces to unsigned 32-bit so negative signed integers produce a valid hex string
                            const hexColor = "#" + (tag.color >>> 0).toString(16).padStart(6, "0");
                            const isSelected = selectedTagIds.has(tag.id);
                            return (
                                <TagChip
                                    key={tag.id}
                                    id={tag.id}
                                    name={tag.name}
                                    description={tag.description}
                                    bgColorCSS={isSelected ? hexColor : "#374151"}
                                    holeColorCSS={isSelected ? "#111827" : hexColor}
                                    onClick={() => toggleTag(tag.id)}
                                />
                            );
                        })}
                    </div>
                    {Array.from(selectedTagIds).map(id => (
                        <input key={id} type="hidden" name="tag_ids" value={id} />
                    ))}
                </div>

                <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold tracking-wide text-gray-400 uppercase">Persons</h3>
                    <div className="flex flex-wrap gap-2">
                        {props.persons.map(person => {
                            const isSelected = selectedPersonIds.has(person.id);
                            return (
                                <button
                                    key={person.id}
                                    type="button"
                                    onClick={() => togglePerson(person.id)}
                                    className={`flex items-center gap-2 rounded px-3 py-1 text-sm text-white ${isSelected ? "bg-indigo-700" : "bg-gray-700"}`}
                                >
                                    {person.displayName}
                                    <span className="text-xs text-gray-300">{person.type}</span>
                                </button>
                            );
                        })}
                    </div>
                    {Array.from(selectedPersonIds).map(id => (
                        <input key={id} type="hidden" name="person_ids" value={id} />
                    ))}
                </div>

                <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold tracking-wide text-gray-400 uppercase">Related Events</h3>
                    <div className="flex flex-wrap gap-2">
                        {props.events.map(event => {
                            const isSelected = selectedEventIds.has(event.id);
                            return (
                                <button
                                    key={event.id}
                                    type="button"
                                    onClick={() => toggleEvent(event.id)}
                                    className={`rounded px-3 py-1 text-sm text-white ${isSelected ? "bg-indigo-700" : "bg-gray-700"}`}
                                >
                                    {event.name}
                                </button>
                            );
                        })}
                    </div>
                    {/* Single comma-separated value — parseEventFormFields splits on ',' */}
                    <input
                        type="hidden"
                        name="related_event_ids"
                        value={Array.from(selectedEventIds).join(",")}
                    />
                </div>

                {props.isEdit && (
                    <label className="flex flex-col gap-1">
                        <span className="text-sm text-gray-400">Changelog Note</span>
                        <textarea
                            name="changelog_note"
                            required
                            rows={4}
                            className="w-full rounded bg-gray-700 px-3 py-2 text-white"
                        />
                    </label>
                )}

                <ActionButton
                    color={BUTTON_GREEN}
                    guard={makeAreaSudoGuard("hisdoc", "editor", ctx)}
                    action={async () => {
                        const fd = new FormData(formRef.current!);
                        await props.action(fd);
                    }}
                >
                    {props.isEdit ? "Save Changes" : "Add Event"}
                </ActionButton>

            </div>
        </form>
    );
}
