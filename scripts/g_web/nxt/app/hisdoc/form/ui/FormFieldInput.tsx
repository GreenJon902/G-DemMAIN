"use client";

import { ReactNode } from "react";
import { hd_person_type } from "@g/com/prisma/enums";
import FlexiDateInput from "../../ui/FlexiDateInput";
import type { FormField } from "../lib/formFields";
import { TagsSelect, PersonsSelect, RelatedEventsSelect } from "./RelationSelects";

/** Shared styling for the form's text-like inputs. */
export const FORM_INPUT_CLASS = "w-full rounded bg-gray-700 px-3 py-2 text-white";

/** Human-readable labels for the person type select. */
const PERSON_TYPE_LABELS: Record<hd_person_type, string> = {
    [hd_person_type.MINECRAFT]: "Minecraft",
    [hd_person_type.NPC]: "NPC"
};

/**
 * The container for one form row: label above content, styled like the changelog's FieldRow.
 * @param asLabel - Render the container as a <label> so clicking the caption focuses the input.
 *   Leave false for rows whose content holds its own interactive elements.
 */
export function FormRow({ label, asLabel = false, children }: { label: string, asLabel?: boolean, children: ReactNode }) {
    const caption = <span className="text-sm font-semibold text-gray-300">{label}</span>;
    const className = "flex flex-col gap-1 rounded-md bg-gray-800 p-2";
    return asLabel
        ? <label className={className}>{caption}{children}</label>
        : <div className={className}>{caption}{children}</div>;
}

/**
 * Renders one FormField as an input row, dispatching on the field's kind — the form counterpart
 * of the changelog's FieldDiffRow. Each kind's FormData serialization is documented in
 * form/lib/formFields.ts.
 */
export default function FormFieldInput({ field }: { field: FormField }) {
    switch (field.kind) {
    case "text":
        return (
            <FormRow label={field.label} asLabel>
                <input
                    name={field.name}
                    type="text"
                    required
                    maxLength={field.maxLength}
                    defaultValue={field.defaultValue}
                    className={FORM_INPUT_CLASS}
                />
            </FormRow>
        );
    case "longtext":
    case "nullableLongtext":
        return (
            <FormRow label={field.label} asLabel>
                <textarea
                    name={field.name}
                    required={field.kind === "longtext"}
                    rows={field.rows ?? 4}
                    defaultValue={field.defaultValue ?? ""}
                    className={FORM_INPUT_CLASS}
                />
            </FormRow>
        );
    case "color":
        return (
            <FormRow label={field.label} asLabel>
                <input
                    name={field.name}
                    type="color"
                    defaultValue={field.defaultValue}
                    className="h-10 w-20 cursor-pointer rounded bg-gray-700 p-1"
                />
            </FormRow>
        );
    case "personType":
        return (
            <FormRow label={field.label} asLabel>
                <select name={field.name} defaultValue={field.defaultValue} className={FORM_INPUT_CLASS}>
                    {Object.values(hd_person_type).map(type => (
                        <option key={type} value={type}>{PERSON_TYPE_LABELS[type]}</option>
                    ))}
                </select>
            </FormRow>
        );
    case "flexidate":
        return (
            <FormRow label={field.label}>
                <FlexiDateInput defaultValue={field.defaultValue} />
            </FormRow>
        );
    case "tags":
        return (
            <FormRow label={field.label}>
                <TagsSelect options={field.options} defaultSelectedIds={field.defaultSelectedIds} />
            </FormRow>
        );
    case "persons":
        return (
            <FormRow label={field.label}>
                <PersonsSelect options={field.options} defaultSelectedIds={field.defaultSelectedIds} />
            </FormRow>
        );
    case "relatedEvents":
        return (
            <FormRow label={field.label}>
                <RelatedEventsSelect options={field.options} defaultSelectedIds={field.defaultSelectedIds} />
            </FormRow>
        );
    }
}
