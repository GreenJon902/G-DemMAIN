"use client";

import { useState } from "react";
import { hd_person_type } from "@g/com/prisma/enums";
import type { ActionResult } from "../../lib/actionHelpers";
import EntityForm from "./EntityForm";
import { FormRow, FormTextInput, FORM_INPUT_CLASS, useFormChanged } from "./FormInputs";

/** Human-readable labels for the person type select. */
const PERSON_TYPE_LABELS: Record<hd_person_type, string> = {
    [hd_person_type.MINECRAFT]: "Minecraft",
    [hd_person_type.NPC]: "NPC"
};

// Mirrors chk_hd_person_minecraft_uuid / actions.ts' MINECRAFT_UUID_REGEX as an HTML validation pattern
const MINECRAFT_UUID_PATTERN = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

/**
 * The controlled person-type select row. Lives as its own component (rather than inline in
 * PersonForm) so useFormChanged reads the context from inside the EntityForm provider.
 */
function PersonTypeSelect({ value, onChange }: { value: hd_person_type, onChange: (value: hd_person_type) => void }) {
    const notifyChanged = useFormChanged();
    return (
        <FormRow label="Type" asLabel>
            <select
                name="type"
                value={value}
                onChange={e => {
                    onChange(e.target.value as hd_person_type);
                    notifyChanged();
                }}
                className={FORM_INPUT_CLASS}
            >
                {Object.values(hd_person_type).map(type => (
                    <option key={type} value={type}>{PERSON_TYPE_LABELS[type]}</option>
                ))}
            </select>
        </FormRow>
    );
}

/**
 * The person add/edit form: a type select and a data field whose label and client-side validation
 * follow the type — MINECRAFT requires a hyphenated UUID (also re-checked server-side), NPC any
 * name. linked_user_id is deliberately absent — it stays SQL-managed.
 *
 * @param action - The server action to call on submit. For add: addPerson directly; for edit: a bound wrapper like (fd) => editPerson(id, fd).
 * @param defaults - Current values for edit mode; undefined for add mode.
 */
export default function PersonForm(props: {
    action: (formData: FormData) => Promise<ActionResult>,
    isEdit?: boolean,
    submitLabel: string,
    defaults?: { type: hd_person_type, data: string }
}) {
    const [type, setType] = useState<hd_person_type>(props.defaults?.type ?? hd_person_type.MINECRAFT);
    const isMinecraft = type === hd_person_type.MINECRAFT;

    return (
        <EntityForm action={props.action} isEdit={props.isEdit} submitLabel={props.submitLabel} minLevel="admin">
            <PersonTypeSelect value={type} onChange={setType} />
            <FormTextInput
                name="data"
                label={isMinecraft ? "Minecraft UUID" : "Name"}
                required
                maxLength={isMinecraft ? 36 : 255}
                pattern={isMinecraft ? MINECRAFT_UUID_PATTERN : undefined}
                patternHint={isMinecraft ? "A hyphenated Minecraft UUID, e.g. 069a79f4-44e9-4726-a5be-fca90e38aaf5" : undefined}
                placeholder={isMinecraft ? "069a79f4-44e9-4726-a5be-fca90e38aaf5" : undefined}
                defaultValue={props.defaults?.data}
            />
        </EntityForm>
    );
}
