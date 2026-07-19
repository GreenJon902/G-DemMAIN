"use client";

import { ReactNode, useState } from "react";
import RadioButtons from "@/app/ui/RadioButtons";
import { type FlexiDateInput, formatDateInputValue, parseDateInputValue } from "../../lib/flexidate";
import { FORM_INPUT_CLASS, useFormChanged } from "./FormInputs";

/**
 * Caption + content wrapper for one FlexiDate sub-field, matching FormRow's caption styling
 * without repeating its box — the whole widget already sits inside a single FormRow.
 */
function SubField({ label, htmlFor, children }: { label: string, htmlFor?: string, children: ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-gray-300" htmlFor={htmlFor}>{label}</label>
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
 * units-since-epoch counts with the flexidate offset applied (see formatDateInputValue /
 * parseDateInputValue in lib/flexidate.ts).
 *
 * The `defaultValue` prop initialises state from an existing FlexiDate (e.g.
 * when editing a record). If omitted, defaults to centered mode with empty fields.
 *
 * Hidden field names match what `parseFlexiDateForm` in `lib/flexidate.ts` expects:
 * `date_type`, `date1`, `date_time_offset`, `date_units`, `date_diff`, `date2`.
 *
 * @param defaultValue - Optional existing FlexiDate to pre-populate the fields.
 */
export default function FlexiDateInput({ defaultValue }: { defaultValue?: FlexiDateInput }) {
    const notifyChanged = useFormChanged();

    const [type, setType] = useState<"centered" | "ranged">(
        defaultValue?.event_date_type ?? "centered"
    );
    const [dateTimeOffset, setDateTimeOffset] = useState(
        defaultValue?.event_date_time_offset.toString() ?? "0"
    );
    // Centered-only fields — the picked instant is kept as the picker's own value string
    const [dateUnits, setDateUnits] = useState<"d" | "h" | "m">(
        defaultValue?.event_date_units ?? "d"
    );
    const [centerInput, setCenterInput] = useState(() =>
        defaultValue?.event_date_type === "centered"
            ? formatDateInputValue(defaultValue.event_date1, defaultValue.event_date_units!, defaultValue.event_date_time_offset)
            : ""
    );
    const [dateDiff, setDateDiff] = useState(defaultValue?.event_date_diff?.toString() ?? "");
    // Ranged-only fields, always whole days
    const [startInput, setStartInput] = useState(() =>
        defaultValue?.event_date_type === "ranged"
            ? formatDateInputValue(defaultValue.event_date1, "d", defaultValue.event_date_time_offset)
            : ""
    );
    const [endInput, setEndInput] = useState(() =>
        defaultValue?.event_date_type === "ranged"
            ? formatDateInputValue(defaultValue.event_date2!, "d", defaultValue.event_date_time_offset)
            : ""
    );

    const offsetNum = Number(dateTimeOffset) || 0;

    /** Switches mode, keeping each mode's own inputs so toggling back restores them. */
    function handleTypeChange(next: "centered" | "ranged") {
        setType(next);
        notifyChanged();
    }

    // Re-encodes the already-picked instant in the new unit's input format (date vs datetime-local),
    // since the picker element type changes with the unit
    function handleUnitsChange(next: "d" | "h" | "m") {
        setDateUnits(next);
        setCenterInput(prev => {
            const count = parseDateInputValue(prev, next, offsetNum);
            return count === null ? "" : formatDateInputValue(count, next, offsetNum);
        });
        notifyChanged();
    }

    // Hidden numeric values are derived at render so an offset change re-encodes the picked
    // wall-clock dates automatically
    const date1Count = type === "centered"
        ? parseDateInputValue(centerInput, dateUnits, offsetNum)
        : parseDateInputValue(startInput, "d", offsetNum);
    const date2Count = type === "ranged" ? parseDateInputValue(endInput, "d", offsetNum) : null;

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

            {/* UTC offset — shared by both modes */}
            <SubField label="UTC offset (minutes)" htmlFor="flexi_date_time_offset">
                <input
                    id="flexi_date_time_offset"
                    type="number"
                    className={FORM_INPUT_CLASS}
                    value={dateTimeOffset}
                    onChange={e => {
                        setDateTimeOffset(e.target.value);
                        notifyChanged();
                    }}
                    step={1}
                    required
                    placeholder="0"
                />
            </SubField>

            {type === "centered" ? (
                <>
                    <SubField label={dateUnits === "d" ? "Date" : "Date & time"} htmlFor="flexi_date1_centered">
                        <input
                            id="flexi_date1_centered"
                            type={dateUnits === "d" ? "date" : "datetime-local"}
                            className={FORM_INPUT_CLASS}
                            value={centerInput}
                            onChange={e => {
                                setCenterInput(e.target.value);
                                notifyChanged();
                            }}
                            // Hour units can only represent whole hours, so snap the time picker to them
                            step={dateUnits === "h" ? 3600 : undefined}
                            required
                        />
                    </SubField>

                    <SubField label="Units" htmlFor="flexi_date_units">
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

                    <SubField label={`± margin (${dateUnits})`} htmlFor="flexi_date_diff">
                        <input
                            id="flexi_date_diff"
                            type="number"
                            className={FORM_INPUT_CLASS}
                            value={dateDiff}
                            onChange={e => {
                                setDateDiff(e.target.value);
                                notifyChanged();
                            }}
                            step={1}
                            min={0}
                            required
                            placeholder="0"
                        />
                    </SubField>
                </>
            ) : (
                <>
                    <SubField label="Start date" htmlFor="flexi_date1_ranged">
                        <input
                            id="flexi_date1_ranged"
                            type="date"
                            className={FORM_INPUT_CLASS}
                            value={startInput}
                            onChange={e => {
                                setStartInput(e.target.value);
                                notifyChanged();
                            }}
                            required
                        />
                    </SubField>

                    <SubField label="End date" htmlFor="flexi_date2">
                        <input
                            id="flexi_date2"
                            type="date"
                            className={FORM_INPUT_CLASS}
                            value={endInput}
                            onChange={e => {
                                setEndInput(e.target.value);
                                notifyChanged();
                            }}
                            // Native validation enforces date1 <= date2
                            min={startInput || undefined}
                            required
                        />
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
