import { ReactNode } from "react";
import { hd_person_type } from "@g/com/prisma/enums";
import { FieldRow, Unchanged, BeforeAfter, NotRecorded } from "./common";

/** Formats a raw hd_tag.color int as a swatch + hex string, matching the event/tag page convention. */
function ColorValue({ color }: { color: number }) {
    // >>> 0 coerces to unsigned 32-bit so negative signed integers produce a valid hex string
    const hex = "#" + (color >>> 0).toString(16).padStart(6, "0");
    return (
        <span className="inline-flex items-center gap-2">
            <span className="inline-block size-4 rounded-sm" style={{ backgroundColor: hex }} />
            {hex}
        </span>
    );
}

function formatValue(kind: "boolean" | "color" | "personType", value: boolean | number | hd_person_type): ReactNode {
    switch (kind) {
    case "boolean": return value ? "true" : "false";
    case "color": return <ColorValue color={value as number} />;
    case "personType": return value === hd_person_type.MINECRAFT ? "Minecraft" : "NPC";
    }
}

/**
 * Diffs a boolean/color/personType field: a single "(unchanged)" value when both sides match, or
 * explicit Before/After panels when they differ or only one side is available.
 */
export default function ScalarDiff({ label, kind, before, after }: {
    label: string;
    kind: "boolean" | "color" | "personType";
    before: boolean | number | hd_person_type | undefined;
    after: boolean | number | hd_person_type | undefined;
}) {
    if (before === undefined && after === undefined) return null;

    if (before !== undefined && after !== undefined && before === after) {
        return <FieldRow label={label}><Unchanged>{formatValue(kind, after)}</Unchanged></FieldRow>;
    }

    return (
        <FieldRow label={label}>
            <BeforeAfter
                before={before === undefined ? <NotRecorded /> : formatValue(kind, before)}
                after={after === undefined ? <NotRecorded /> : formatValue(kind, after)}
            />
        </FieldRow>
    );
}
