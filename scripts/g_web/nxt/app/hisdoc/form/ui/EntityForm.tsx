"use client";

import { useRef } from "react";
import { useAuthContext, makeAreaSudoGuard } from "@/app/AuthContext";
import { useErrorContext } from "@/app/ErrorContext";
import { ActionButton, BUTTON_GREEN } from "@/app/ui/Button";
import type { AreaPermission } from "@g/com/lib/authConstants";
import type { FormField } from "../lib/formFields";
import FormFieldInput, { FormRow, FORM_INPUT_CLASS } from "./FormFieldInput";

interface EntityFormProps {
    /** Ordered field list from one of the build*FormFields functions. */
    fields: Array<FormField>;
    /** The server action to call on submit. For add: the action directly. For edit: a bound wrapper like (fd) => editEvent(id, fd). */
    action: (formData: FormData) => Promise<void>;
    /** When true, shows the required changelog note field. */
    isEdit?: boolean;
    /** Label for the submit button, e.g. "Add Event" or "Save Changes". */
    submitLabel: string;
    /** The hisdoc permission level this form's submit requires; drives the sudo guard. */
    minLevel: AreaPermission<"hisdoc">;
}

/**
 * The generic hisdoc add/edit form: renders a declarative field list (see form/lib/formFields.ts)
 * plus, in edit mode, a required changelog note field.
 *
 * Submission is handled by ActionButton, which builds FormData from the form ref and passes it to
 * the provided action after the sudo guard passes. The <form> element is never submitted natively.
 * Action errors surface through the shared error modal.
 */
export default function EntityForm(props: EntityFormProps) {
    const formRef = useRef<HTMLFormElement>(null);
    const ctx = useAuthContext();
    const { showError } = useErrorContext();

    return (
        <form ref={formRef}>
            <div className="flex max-w-2xl flex-col gap-4">
                {props.fields.map(field => (
                    <FormFieldInput key={field.label} field={field} />
                ))}

                {props.isEdit && (
                    <FormRow label="Changelog Note" asLabel>
                        <textarea
                            name="changelog_note"
                            required
                            rows={4}
                            className={FORM_INPUT_CLASS}
                        />
                    </FormRow>
                )}

                <ActionButton
                    color={BUTTON_GREEN}
                    guard={makeAreaSudoGuard("hisdoc", props.minLevel, ctx)}
                    onError={showError}
                    action={async () => {
                        const fd = new FormData(formRef.current!);
                        await props.action(fd);
                    }}
                >
                    {props.submitLabel}
                </ActionButton>
            </div>
        </form>
    );
}
