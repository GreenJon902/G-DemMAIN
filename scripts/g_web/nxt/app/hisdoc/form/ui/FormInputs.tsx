"use client";

import { ChangeEvent, FocusEvent, ReactNode, SyntheticEvent, createContext, useContext, useState } from "react";
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

/** A red asterisk marking a field as required, for use after a label/caption. */
export function RequiredMark() {
    return <span className="text-red-500"> *</span>;
}

/**
 * The container for one form row: label above content, styled like the changelog's FieldRow.
 * @param asLabel - Render the container as a <label> so clicking the caption focuses the input.
 *   Leave false for rows whose content holds its own interactive elements.
 * @param required - Shows a red asterisk after the label when true.
 */
export function FormRow({ label, asLabel = false, required = false, children }: { label: string, asLabel?: boolean, required?: boolean, children: ReactNode }) {
    const caption = <span className="text-sm font-semibold text-gray-300">{label}{required && <RequiredMark />}</span>;
    const className = "flex flex-col gap-1 rounded-md bg-gray-800 p-2";
    return asLabel
        ? <label className={className}>{caption}{children}</label>
        : <div className={className}>{caption}{children}</div>;
}

type Validatable = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/**
 * Tracks one native form control's validation error, shown once the control has been blurred
 * (after being focused) or the enclosing form's reportValidity() has run — whichever happens
 * first — and cleared again as soon as the value becomes valid. Spread the returned `onBlur`/
 * `onChange`/`onInvalid` onto the control (composing with any of its own `onChange` logic);
 * `onInvalid` suppresses the browser's own validation bubble in favor of the custom `error` text
 * (render via {@link FieldError}) plus a red border (via {@link inputClass}).
 */
export function useFieldValidation() {
    const [error, setError] = useState("");

    // checkValidity() synchronously (re)computes validity and, if invalid, dispatches "invalid" on
    // the element first — so by the time it returns, onInvalid below has already set the message
    function recheck(el: Validatable) {
        // Native `required` only rejects a literally empty value — a whitespace-only value "counts"
        // as present, even though the server rejects it too (z.string().trim().min(1), actions.tsx).
        // setCustomValidity is the standard way to layer an app-specific rule onto native constraint
        // validation without replacing it
        const isBlank = (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
            && el.required && el.value.trim() === "";
        el.setCustomValidity(isBlank ? "This field can't be blank." : "");
        if (el.checkValidity()) setError("");
    }

    return {
        error,
        onBlur: (e: FocusEvent<Validatable>) => recheck(e.currentTarget),
        onChange: (e: ChangeEvent<Validatable>) => { if (error) recheck(e.currentTarget); },
        onInvalid: (e: SyntheticEvent<Validatable>) => {
            e.preventDefault();
            setError(e.currentTarget.validationMessage);
        }
    };
}

/** Appends an error-state red border to FORM_INPUT_CLASS when `error` is non-empty. */
export function inputClass(error: string): string {
    return `${FORM_INPUT_CLASS}${error ? " border border-red-500" : ""}`;
}

/** Renders a field's current validation error message, or nothing if there isn't one. */
export function FieldError({ error }: { error: string }) {
    if (!error) return null;
    return <p className="text-xs text-red-500">{error}</p>;
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
    const validation = useFieldValidation();
    return (
        <FormRow label={props.label} asLabel required={props.required}>
            <input
                name={props.name}
                type="text"
                required={props.required}
                maxLength={props.maxLength}
                pattern={props.pattern}
                title={props.patternHint}
                placeholder={props.placeholder}
                defaultValue={props.defaultValue}
                onChange={e => { notifyChanged(); validation.onChange(e); }}
                onBlur={validation.onBlur}
                onInvalid={validation.onInvalid}
                className={inputClass(validation.error)}
            />
            <FieldError error={validation.error} />
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
    const validation = useFieldValidation();
    return (
        <FormRow label={props.label} asLabel required={props.required}>
            <textarea
                name={props.name}
                required={props.required}
                rows={props.rows ?? 4}
                defaultValue={props.defaultValue ?? ""}
                onChange={e => { notifyChanged(); validation.onChange(e); }}
                onBlur={validation.onBlur}
                onInvalid={validation.onInvalid}
                className={inputClass(validation.error)}
            />
            <FieldError error={validation.error} />
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

