"use client";

import { useState } from "react";
import type { FlexiDateInput } from "../lib/flexidate";

// Shared Tailwind classes for numeric inputs
const inputClass = "bg-gray-700 text-white rounded px-2 py-1 w-32";
const labelClass = "text-gray-400 text-sm";

/**
 * A controlled compound input for FlexiDate values, designed for use inside
 * an HTML <form>. Serialises its full state to hidden <input type="hidden">
 * fields so FormData picks up all values on submission.
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
    const [type, setType] = useState<"centered" | "ranged">(
        defaultValue?.event_date_type ?? "centered"
    );
    const [date1, setDate1] = useState(defaultValue?.event_date1.toString() ?? "");
    const [dateTimeOffset, setDateTimeOffset] = useState(
        defaultValue?.event_date_time_offset.toString() ?? "0"
    );
    // Centered-only fields
    const [dateUnits, setDateUnits] = useState<"d" | "h" | "m">(
        defaultValue?.event_date_units ?? "d"
    );
    const [dateDiff, setDateDiff] = useState(defaultValue?.event_date_diff?.toString() ?? "");
    // Ranged-only fields
    const [date2, setDate2] = useState(defaultValue?.event_date2?.toString() ?? "");

    function handleTypeChange(next: "centered" | "ranged") {
        setType(next);
        // Reset fields that belong only to the mode being left
        if (next === "centered") {
            setDate2("");
        } else {
            setDateDiff("");
            setDateUnits("d");
        }
    }

    return (
        <div className="flex flex-col gap-3">
            {/* Mode selector */}
            <div className="flex gap-4">
                <label className="flex cursor-pointer items-center gap-2">
                    <input
                        type="radio"
                        name="flexi_date_type_ui"
                        value="centered"
                        checked={type === "centered"}
                        onChange={() => handleTypeChange("centered")}
                    />
                    <span className="text-white">Centered</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                    <input
                        type="radio"
                        name="flexi_date_type_ui"
                        value="ranged"
                        checked={type === "ranged"}
                        onChange={() => handleTypeChange("ranged")}
                    />
                    <span className="text-white">Ranged</span>
                </label>
            </div>

            {/* UTC offset — shared by both modes */}
            <div className="flex items-center gap-2">
                <label className={labelClass} htmlFor="flexi_date_time_offset">
                    UTC offset (minutes)
                </label>
                <input
                    id="flexi_date_time_offset"
                    type="number"
                    className={inputClass}
                    value={dateTimeOffset}
                    onChange={e => setDateTimeOffset(e.target.value)}
                    step={1}
                    placeholder="0"
                />
            </div>

            {type === "centered" ? (
                <>
                    <div className="flex items-center gap-2">
                        <label className={labelClass} htmlFor="flexi_date1_centered">
                            Centre value
                        </label>
                        <input
                            id="flexi_date1_centered"
                            type="number"
                            className={inputClass}
                            value={date1}
                            onChange={e => setDate1(e.target.value)}
                            step={1}
                            placeholder="0"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <label className={labelClass} htmlFor="flexi_date_units">
                            Units
                        </label>
                        <select
                            id="flexi_date_units"
                            className="rounded bg-gray-700 px-2 py-1 text-white"
                            value={dateUnits}
                            onChange={e => setDateUnits(e.target.value as "d" | "h" | "m")}
                        >
                            <option value="d">Days (d)</option>
                            <option value="h">Hours (h)</option>
                            <option value="m">Minutes (m)</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <label className={labelClass} htmlFor="flexi_date_diff">
                            ± margin
                        </label>
                        <input
                            id="flexi_date_diff"
                            type="number"
                            className={inputClass}
                            value={dateDiff}
                            onChange={e => setDateDiff(e.target.value)}
                            step={1}
                            placeholder="0"
                        />
                    </div>
                </>
            ) : (
                <>
                    <div className="flex items-center gap-2">
                        <label className={labelClass} htmlFor="flexi_date1_ranged">
                            Start (days since epoch)
                        </label>
                        <input
                            id="flexi_date1_ranged"
                            type="number"
                            className={inputClass}
                            value={date1}
                            onChange={e => setDate1(e.target.value)}
                            step={1}
                            placeholder="0"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <label className={labelClass} htmlFor="flexi_date2">
                            End (days since epoch)
                        </label>
                        <input
                            id="flexi_date2"
                            type="number"
                            className={inputClass}
                            value={date2}
                            onChange={e => setDate2(e.target.value)}
                            step={1}
                            placeholder="0"
                        />
                    </div>
                </>
            )}

            {/* Hidden fields consumed by parseFlexiDateForm — always emitted so FormData is complete */}
            <input type="hidden" name="date_type" value={type} />
            <input type="hidden" name="date1" value={date1} />
            <input type="hidden" name="date_time_offset" value={dateTimeOffset} />
            <input type="hidden" name="date_units" value={type === "centered" ? dateUnits : ""} />
            <input type="hidden" name="date_diff" value={dateDiff} />
            <input type="hidden" name="date2" value={date2} />
        </div>
    );
}
