"use client";

import { ReactNode, useState, useEffect } from "react";
import RadioButtons from "@/app/ui/RadioButtons";
import { type FlexiDate, convertFlexiDateCount, formatDateInputValue, parseDateInputValue, formatSignedOffset } from "../../lib/date/flexidate";
import { pad2 } from "../../lib/date/utils";
import { FORM_INPUT_CLASS, FieldError, RequiredMark, inputClass, useFieldValidation, useFormChanged } from "./FormInputs";

// Zero-padded "00".."23" choices for the hour-precision hour selector
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => hour.toString().padStart(2, "0"));

// event_date_diff is stored in a BIGINT UNSIGNED column, but this <input type="number"> is backed by
// a JS double, so Number.MAX_SAFE_INTEGER is the real ceiling — beyond it the input can't represent
// the value exactly anyway
const MARGIN_MAX = Number.MAX_SAFE_INTEGER;

// Practical min/max for the date / datetime-local pickers — MySQL's DATETIME type only supports
// '1000-01-01 00:00:00' to '9999-12-31 23:59:59', so pickers are capped to stay within it
const DATE_MIN = "1000-01-01";
const DATE_MAX = "9999-12-31";
const DATETIME_MIN = `${DATE_MIN}T00:00`;
const DATETIME_MAX = `${DATE_MAX}T23:59`;

/**
 * Caption + content wrapper for one FlexiDate sub-field, matching FormRow's caption styling
 * without repeating its box — the whole widget already sits inside a single FormRow.
 * @param required - Shows a red asterisk after the label when true.
 */
function SubField({ label, htmlFor, required = false, children }: { label: string, htmlFor?: string, required?: boolean, children: ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-gray-300" htmlFor={htmlFor}>{label}{required && <RequiredMark />}</label>
            {children}
        </div>
    );
}

/**
 * A controlled compound input for FlexiDate values, designed for use inside
 * an HTML <form>. Serialises its full state to hidden <input type="hidden">
 * fields so FormData picks up all values on submission.
 *
 * Dates are entered through native pickers — <input type="date"> for day-based values and
 * <input type="datetime-local"> for hour/minute-based ones — and converted to/from the stored
 * units-since-epoch counts by treating the picker's literal digits as if they were UTC, with no
 * offset math involved (see formatDateInputValue / parseDateInputValue in lib/date/flexidate.ts).
 *
 * The `defaultValue` prop initialises state from an existing FlexiDate (e.g.
 * when editing a record). If omitted, defaults to centered mode with empty fields.
 *
 * Hidden field names match what `parseFlexiDateForm` in `lib/date/flexidate.ts` expects:
 * `date_type`, `date1`, `date_time_offset`, `date_units`, `date_diff`, `date2`.
 *
 * @param defaultValue - Optional existing FlexiDate to pre-populate the fields.
 */
export default function FlexiDateInput({ defaultValue }: { defaultValue?: FlexiDate }) {
    const notifyChanged = useFormChanged();

    const [type, setType] = useState<"centered" | "ranged">(
        defaultValue?.event_date_type ?? "centered"
    );
    const [dateTimeOffset, setDateTimeOffset] = useState(() =>
        formatSignedOffset(defaultValue?.event_date_time_offset ?? 0)
    );
    // The auto-detected offset string + timezone abbreviation (e.g. "BST"), shown as a sanity-check
    // hint next to the offset field. Kept alongside the offset string it was detected for (rather
    // than just the tz name) so the hint can disappear once the user edits the field away from it —
    // re-appearing if they type it back to match — without needing to clear this on every keystroke.
    const [detected, setDetected] = useState<{ offsetStr: string; tzName: string } | null>(null);

    // Centered-only fields — the picked instant is kept as the picker's own value string
    const [dateUnits, setDateUnits] = useState<"d" | "h" | "m">(
        defaultValue?.event_date_units ?? "d"
    );
    const [centerInput, setCenterInput] = useState(() => {
        if (defaultValue?.event_date_type !== "centered") return "";
        const formatted = formatDateInputValue(defaultValue.event_date1, defaultValue.event_date_units!);
        // Hour precision only tracks the hour, so the minute component is always pinned to 00
        return defaultValue.event_date_units === "h" ? formatted.slice(0, 13) + ":00" : formatted;
    });
    const [dateDiff, setDateDiff] = useState(defaultValue?.event_date_diff?.toString() ?? "0");

    // Auto-fill the offset from the browser's own timezone for a brand-new event — editing an
    // existing one keeps its stored offset untouched. Matches the legacy Java form's own
    // `-new Date().getTimezoneOffset()` autofill.
    // Also auto-fills the centered date to today field.
    useEffect(() => {
        if (defaultValue) return;
        const offsetStr = formatSignedOffset(-new Date().getTimezoneOffset());
        // Must run client-only (real browser timezone isn't available during SSR/the useState
        // initializer, and using it there would cause a hydration mismatch anyway)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDateTimeOffset(offsetStr);
        const tzPart = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
            .formatToParts(new Date())
            .find(part => part.type === "timeZoneName");
        if (tzPart) setDetected({ offsetStr, tzName: tzPart.value });

        // Default the centered date to today — only meaningful for day precision (the initial
        // default), since that's the only mode with no time component to also get right; must run
        // client-only for the same reason as the offset autofill above
        const now = new Date();

        setCenterInput(`${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally runs once, only for a brand-new event
    }, []);
    // Ranged-only fields, always whole days
    const [startInput, setStartInput] = useState(() =>
        defaultValue?.event_date_type === "ranged"
            ? formatDateInputValue(defaultValue.event_date1, "d")
            : ""
    );
    const [endInput, setEndInput] = useState(() =>
        defaultValue?.event_date_type === "ranged"
            ? formatDateInputValue(defaultValue.event_date2!, "d")
            : ""
    );

    // One independent validation-error tracker per required field (see useFieldValidation) — called
    // unconditionally since hooks can't be conditional, even though only one mode's fields are ever
    // mounted at a time
    const offsetValidation = useFieldValidation();
    const centerValidation = useFieldValidation();
    const centerHourDateValidation = useFieldValidation();
    const centerHourSelectValidation = useFieldValidation();
    const marginValidation = useFieldValidation();
    const startValidation = useFieldValidation();
    const endValidation = useFieldValidation();

    /** Switches mode, keeping each mode's own inputs so toggling back restores them. */
    function handleTypeChange(next: "centered" | "ranged") {
        setType(next);
        notifyChanged();
    }

    // Converts the already-picked instant to the new unit and re-encodes it in that unit's input
    // format (date vs datetime-local). Converting the stored count directly (rather than
    // reparsing the formatted string under the new unit) avoids compounding rounding drift across
    // repeated precision switches
    function handleUnitsChange(next: "d" | "h" | "m") {
        const prevCount = parseDateInputValue(centerInput, dateUnits);
        setDateUnits(next);
        setCenterInput(prevCount === null ? "" : formatDateInputValue(convertFlexiDateCount(prevCount, dateUnits, next), next));
        notifyChanged();
    }

    // Updates the date portion of a centered hour-precision value, keeping the picked hour if one
    // has already been chosen — an unset hour is left unset rather than defaulting to 00
    function handleCenterHourDateChange(dateStr: string) {
        const hour = centerInput.length >= 13 ? centerInput.slice(11, 13) : "";
        setCenterInput(dateStr ? (hour ? `${dateStr}T${hour}:00` : dateStr) : "");
        notifyChanged();
    }

    /** Updates the hour portion of a centered hour-precision value, keeping the picked date. */
    function handleCenterHourChange(hour: string) {
        setCenterInput(prev => {
            const datePart = prev.slice(0, 10);
            return datePart ? `${datePart}T${hour}:00` : prev;
        });
        notifyChanged();
    }

    // Hidden numeric values are derived at render from the picker's own literal digits
    const date1Count = type === "centered"
        ? parseDateInputValue(centerInput, dateUnits)
        : parseDateInputValue(startInput, "d");
    const date2Count = type === "ranged" ? parseDateInputValue(endInput, "d") : null;

    return (
        <div className="flex flex-col gap-3">
            <RadioButtons<"centered" | "ranged">
                className="text-sm text-white"
                lightBg
                choices={["centered", "ranged"]}
                selected={type}
                setter={handleTypeChange}
                nameConv={mode => mode === "centered" ? "Centered" : "Ranged"}
                titleConv={mode => mode === "centered"
                    ? "A single date with an uncertainty margin either side"
                    : "Happened sometime between two dates"}
            />

            {/* Timezone offset — shared by both modes. Not literally "UTC": it's the offset of
                whatever timezone the date fields below are entered in, which may not be the
                browser's current one (e.g. backfilling a historical date from elsewhere) */}
            <SubField label="Timezone offset of the date below" htmlFor="flexi_date_time_offset" required>
                <p className="text-xs text-gray-400">
                    Format: (+|-)HH:MM from UTC.
                </p>
                <input
                    id="flexi_date_time_offset"
                    type="text"
                    className={inputClass(offsetValidation.error)}
                    value={dateTimeOffset}
                    onChange={e => {
                        setDateTimeOffset(e.target.value);
                        notifyChanged();
                        offsetValidation.onChange(e);
                    }}
                    onBlur={offsetValidation.onBlur}
                    onInvalid={offsetValidation.onInvalid}
                    pattern="[+\-]([01][0-9]|2[0-3]):[0-5][0-9]"
                    required
                    placeholder="+00:00"
                />
                <FieldError error={offsetValidation.error} />
                <p className="text-xs text-gray-400">
                    {detected?.offsetStr === dateTimeOffset && `Detected as ${detected.tzName} — check this matches. `}
                    Enter the date/time below using that same local clock.
                </p>
            </SubField>

            {type === "centered" ? (
                <>
                    {dateUnits === "h" ? (
                        <SubField label="Date & Hour" htmlFor="flexi_date1_centered_date" required>
                            <div className="flex gap-2">
                                <input
                                    id="flexi_date1_centered_date"
                                    type="date"
                                    className={inputClass(centerHourDateValidation.error) + " flex-1"}
                                    value={centerInput.slice(0, 10)}
                                    onChange={e => {
                                        handleCenterHourDateChange(e.target.value);
                                        centerHourDateValidation.onChange(e);
                                    }}
                                    onBlur={centerHourDateValidation.onBlur}
                                    onInvalid={centerHourDateValidation.onInvalid}
                                    min={DATE_MIN}
                                    max={DATE_MAX}
                                    required
                                />
                                {/* Options are written "HH:??" to match formatFlexiDate — minutes are never known at hour precision */}
                                <select
                                    id="flexi_date1_centered_hour"
                                    aria-label="Hour"
                                    className={inputClass(centerHourSelectValidation.error)}
                                    value={centerInput.length >= 13 ? centerInput.slice(11, 13) : "hh"}
                                    onChange={e => {
                                        handleCenterHourChange(e.target.value);
                                        centerHourSelectValidation.onChange(e);
                                    }}
                                    onBlur={centerHourSelectValidation.onBlur}
                                    onInvalid={centerHourSelectValidation.onInvalid}
                                    required
                                >
                                    <option value="" disabled hidden>hh:??</option>
                                    {HOUR_OPTIONS.map(hour => <option key={hour} value={hour}>{hour}:??</option>)}
                                </select>
                            </div>
                            <FieldError error={centerHourDateValidation.error || centerHourSelectValidation.error} />
                        </SubField>
                    ) : (
                        <SubField label={dateUnits === "d" ? "Date" : "Date & time"} htmlFor="flexi_date1_centered" required>
                            {/* Entered using the timezone set by the offset field above — not UTC, and not
                                necessarily the browser's current zone */}
                            <input
                                id="flexi_date1_centered"
                                type={dateUnits === "d" ? "date" : "datetime-local"}
                                className={inputClass(centerValidation.error)}
                                value={centerInput /* TODO: This defaults to 00+offset when switching from days to minutes, is this right? */}
                                onChange={e => {
                                    setCenterInput(e.target.value);
                                    notifyChanged();
                                    centerValidation.onChange(e);
                                }}
                                onBlur={centerValidation.onBlur}
                                onInvalid={centerValidation.onInvalid}
                                min={dateUnits === "d" ? DATE_MIN : DATETIME_MIN}
                                max={dateUnits === "d" ? DATE_MAX : DATETIME_MAX}
                                required
                            />
                            <FieldError error={centerValidation.error} />
                        </SubField>
                    )}

                    <SubField label="Precision" htmlFor="flexi_date_units">
                        <select
                            id="flexi_date_units"
                            className={FORM_INPUT_CLASS}
                            value={dateUnits}
                            onChange={e => handleUnitsChange(e.target.value as "d" | "h" | "m")}
                        >
                            <option value="d">Days (d)</option>
                            <option value="h">Hours (h)</option>
                            <option value="m">Minutes (m)</option>
                        </select>
                    </SubField>

                    <SubField label={`± margin (${dateUnits})`} htmlFor="flexi_date_diff" required>
                        <input
                            id="flexi_date_diff"
                            type="number"
                            className={inputClass(marginValidation.error)}
                            value={dateDiff}
                            onChange={e => {
                                setDateDiff(e.target.value);
                                notifyChanged();
                                marginValidation.onChange(e);
                            }}
                            onBlur={marginValidation.onBlur}
                            onInvalid={marginValidation.onInvalid}
                            step={1}
                            min={0}
                            max={MARGIN_MAX}
                            required
                            placeholder="0"
                        />
                        <FieldError error={marginValidation.error} />
                    </SubField>
                </>
            ) : (
                <>
                    <SubField label="Start date" htmlFor="flexi_date1_ranged" required>
                        <input
                            id="flexi_date1_ranged"
                            type="date"
                            className={inputClass(startValidation.error)}
                            value={startInput}
                            onChange={e => {
                                setStartInput(e.target.value);
                                notifyChanged();
                                startValidation.onChange(e);
                            }}
                            onBlur={startValidation.onBlur}
                            onInvalid={startValidation.onInvalid}
                            min={DATE_MIN}
                            max={DATE_MAX}
                            required
                        />
                        <FieldError error={startValidation.error} />
                    </SubField>

                    <SubField label="End date" htmlFor="flexi_date2" required>
                        <input
                            id="flexi_date2"
                            type="date"
                            className={inputClass(endValidation.error)}
                            value={endInput}
                            onChange={e => {
                                setEndInput(e.target.value);
                                notifyChanged();
                                endValidation.onChange(e);
                            }}
                            onBlur={endValidation.onBlur}
                            onInvalid={endValidation.onInvalid}
                            // Native validation enforces date1 <= date2, on top of the overall MySQL-safe range
                            min={startInput || DATE_MIN}
                            max={DATE_MAX}
                            required
                        />
                        <FieldError error={endValidation.error} />
                    </SubField>
                </>
            )}

            {/* Hidden fields consumed by parseFlexiDateForm — always emitted so FormData is complete */}
            <input type="hidden" name="date_type" value={type} />
            <input type="hidden" name="date1" value={date1Count?.toString() ?? ""} />
            <input type="hidden" name="date_time_offset" value={dateTimeOffset} />
            <input type="hidden" name="date_units" value={type === "centered" ? dateUnits : ""} />
            <input type="hidden" name="date_diff" value={type === "centered" ? dateDiff : ""} />
            <input type="hidden" name="date2" value={date2Count?.toString() ?? ""} />
        </div>
    );
}
