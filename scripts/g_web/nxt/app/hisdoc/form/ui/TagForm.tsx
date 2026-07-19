"use client";

import { colorToHex } from "../../lib/color";
import type { ActionResult } from "../../lib/actionHelpers";
import EntityForm from "./EntityForm";
import { FormTextInput, FormLongTextInput, FormColorInput } from "./FormInputs";

/**
 * The tag add/edit form: name, description and colour, submitted through the generic EntityForm
 * shell.
 *
 * @param action - The server action to call on submit. For add: addTag directly; for edit: a bound wrapper like (fd) => editTag(id, fd).
 * @param defaults - Current values for edit mode; undefined for add mode.
 */
export default function TagForm(props: {
    action: (formData: FormData) => Promise<ActionResult>,
    isEdit?: boolean,
    submitLabel: string,
    defaults?: { name: string, description: string, color: number }
}) {
    return (
        <EntityForm action={props.action} isEdit={props.isEdit} submitLabel={props.submitLabel} minLevel="admin">
            <FormTextInput name="name" label="Name" required maxLength={255} defaultValue={props.defaults?.name} />
            <FormLongTextInput name="description" label="Description" required rows={4} defaultValue={props.defaults?.description} />
            {/* Native color inputs can't be empty, so add mode gets a fixed indigo default */}
            <FormColorInput name="color" label="Color" defaultValue={props.defaults ? colorToHex(props.defaults.color) : "#6366f1"} />
        </EntityForm>
    );
}
