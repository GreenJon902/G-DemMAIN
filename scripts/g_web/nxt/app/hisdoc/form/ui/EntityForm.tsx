"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useAuthContext, makeAreaSudoGuard } from "@/app/AuthContext";
import { useErrorContext } from "@/app/ErrorContext";
import { ActionButton, BUTTON_GREEN } from "@/app/ui/Button";
import type { AreaPermission } from "@g/com/lib/authConstants";
import type { ActionResult } from "../../lib/actionHelpers";
import { FormChangedContext, FormLongTextInput } from "./FormInputs";

interface EntityFormProps {
    /** The server action to call on submit. For add: the action directly. For edit: a bound wrapper like (fd) => editEvent(id, fd). */
    action: (formData: FormData) => Promise<ActionResult>;
    /** When true, shows the required changelog note field. */
    isEdit?: boolean;
    /** Label for the submit button, e.g. "Add Event" or "Save Changes". */
    submitLabel: string;
    /** The hisdoc permission level this form's submit requires; drives the sudo guard. */
    minLevel: AreaPermission<"hisdoc">;
    /** The entity-specific field rows (FormInputs primitives, relation selects, etc.). */
    children: ReactNode;
}

/**
 * Serialises a form's current FormData into a stable string for dirty-comparison. Entries are
 * JSON-encoded and sorted so repeated keys (relation hidden inputs) compare consistently. String
 * values are trimmed first, so a whitespace-only edit doesn't count as a change — trimTextInputs
 * strips it before submission anyway, and the whitespace-aware validation treats it as blank.
 * The changelog note is excluded — typing a note alone is not a change worth submitting.
 */
function serializeFormState(form: HTMLFormElement): string {
    const entries: string[] = [];
    for (const [key, value] of new FormData(form)) {
        if (key === "changelog_note") continue;
        entries.push(JSON.stringify([key, typeof value === "string" ? value.trim() : value]));
    }
    return entries.sort().join("\n");
}

/**
 * Trims every text-like input's current value in place (text inputs and textareas are the only
 * ones that can hold arbitrary whitespace). Run right before reportValidity so a whitespace-only
 * value fails `required` instead of passing, and so the trimmed value — not the raw one — is what
 * ends up in the FormData sent to the server.
 */
function trimTextInputs(form: HTMLFormElement): void {
    form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input[type='text'], textarea").forEach(el => {
        el.value = el.value.trim();
    });
}

/**
 * The generic hisdoc add/edit form shell. Renders the entity-specific children (composed from the
 * FormInputs primitives by EventForm/PersonForm/TagForm) plus, in edit mode, a required changelog
 * note field, and owns the submission machinery:
 *
 * - Dirty tracking: children report changes via FormChangedContext; the submit button stays
 *   disabled until the form's FormData differs from its initial snapshot.
 * - Client validation: the guard runs the form's native reportValidity() before the sudo guard,
 *   so invalid forms show browser validation messages and never prompt for sudo or hit the server.
 * - Errors: the action returns an ActionResult; its error is thrown into the shared error modal.
 *
 * The <form> element is never submitted natively.
 */
export default function EntityForm(props: EntityFormProps) {
    const formRef = useRef<HTMLFormElement>(null);
    const initialState = useRef<string | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const ctx = useAuthContext();
    const { showError } = useErrorContext();

    // Snapshot the pristine form once, after the children (incl. hidden relation inputs) have mounted
    useEffect(() => {
        if (formRef.current) initialState.current = serializeFormState(formRef.current);
    }, []);

    // Re-checks dirtiness after the notifying field's state has been committed to the DOM — the
    // relation selects update hidden inputs via React state, hence the deferral to a macrotask
    const notifyChanged = useCallback(() => {
        setTimeout(() => {
            if (!formRef.current || initialState.current === null) return;
            setIsDirty(serializeFormState(formRef.current) !== initialState.current);
        }, 0);
    }, []);

    return (
        // Submission always goes through the ActionButton below, never natively (e.g. Enter in a text input)
        <form ref={formRef} onSubmit={e => e.preventDefault()}>
            <FormChangedContext value={notifyChanged}>
                <div className="flex max-w-2xl flex-col gap-4">
                    {props.children}

                    {props.isEdit && <FormLongTextInput name="changelog_note" label="Changelog Note" required rows={4} />}

                    <ActionButton
                        color={BUTTON_GREEN}
                        disabled={!isDirty}
                        title={isDirty ? undefined : "No changes to submit"}
                        guard={async () => {
                            // Strip whitespace before native validation, so an invalid form never prompts for sudo
                            trimTextInputs(formRef.current!);
                            if (!formRef.current!.reportValidity()) return false;
                            return await makeAreaSudoGuard("hisdoc", props.minLevel, ctx)();
                        }}
                        onError={showError}
                        action={async () => {
                            const result = await props.action(new FormData(formRef.current!));
                            if (result?.error) throw new Error(result.error);
                        }}
                    >
                        {props.submitLabel}
                    </ActionButton>
                </div>
            </FormChangedContext>
        </form>
    );
}
