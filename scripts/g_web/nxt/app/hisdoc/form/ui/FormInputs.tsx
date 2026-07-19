"use client";

import { ReactNode, createContext, useContext } from "react";
import { VALUE_INPUT_CLASS } from "../../../ui/TextInput";

/** Shared styling for the form's text-like inputs. */
export const FORM_INPUT_CLASS = VALUE_INPUT_CLASS;

/**
 * Lets any input inside an EntityForm notify it that a value may have changed, so it can re-check
 * whether the form is dirty. Defaults to a no-op so the inputs also work outside an EntityForm.
 */
export const FormChangedContext = createContext<() => void>(() => {});

/** Hook returning the enclosing EntityForm's change notifier. */
export function useFormChanged(): () => void {
    return useContext(FormChangedContext);
}

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
 * A labelled single-line text input row. Uncontrolled; native validation attributes are passed
 * straight through so required/maxLength/pattern are enforced client-side by reportValidity.
 *
 * @param pattern - Optional HTML validation pattern the value must fully match.
 * @param patternHint - Tooltip / validation-message hint describing the expected format
 *   (rendered as the input's `title` attribute, which browsers append to the pattern error).
 */
export function FormTextInput(props: {
    name: string,
    label: string,
    defaultValue?: string,
    maxLength?: number,
    required?: boolean,
    pattern?: string,
    patternHint?: string,
    placeholder?: string
}) {
    const notifyChanged = useFormChanged();
    return (
        <FormRow label={props.label} asLabel>
            <input
                name={props.name}
                type="text"
                required={props.required}
                maxLength={props.maxLength}
                pattern={props.pattern}
                title={props.patternHint}
                placeholder={props.placeholder}
                defaultValue={props.defaultValue}
                onChange={notifyChanged}
                className={FORM_INPUT_CLASS}
            />
        </FormRow>
    );
}

/** A labelled multi-line textarea row. Uncontrolled; `required` is enforced client-side. */
export function FormLongTextInput(props: {
    name: string,
    label: string,
    defaultValue?: string,
    required?: boolean,
    rows?: number
}) {
    const notifyChanged = useFormChanged();
    return (
        <FormRow label={props.label} asLabel>
            <textarea
                name={props.name}
                required={props.required}
                rows={props.rows ?? 4}
                defaultValue={props.defaultValue ?? ""}
                onChange={notifyChanged}
                className={FORM_INPUT_CLASS}
            />
        </FormRow>
    );
}

/** A labelled native colour-picker row, submitting "#rrggbb". */
export function FormColorInput(props: { name: string, label: string, defaultValue: string }) {
    const notifyChanged = useFormChanged();
    return (
        <FormRow label={props.label} asLabel>
            <input
                name={props.name}
                type="color"
                defaultValue={props.defaultValue}
                onChange={notifyChanged}
                className="h-10 w-20 cursor-pointer rounded bg-gray-700 p-1"
            />
        </FormRow>
    );
}

