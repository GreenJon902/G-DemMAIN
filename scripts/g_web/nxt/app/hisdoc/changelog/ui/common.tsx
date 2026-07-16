import { ReactNode } from "react";
import { hd_person_type } from "@g/com/prisma/enums";
import RenderedWordDiff from "./RenderedWordDiff";

/**
 * One row in the diff: a label followed by whatever value/diff presentation the field's kind
 * produces. When `unchanged` is set, "(unchanged)" is appended to the label (rather than next to
 * the value, so it reads as a property of the row) and the whole row is dimmed.
 */
export function FieldRow({ label, unchanged = false, children }: { label: string; unchanged?: boolean; children: ReactNode }) {
    return (
        <div className={`flex flex-col gap-1 rounded-md bg-gray-800 p-2 ${unchanged ? "opacity-50" : ""}`}>
            <span className="text-sm font-semibold text-gray-300">
                {label}
                {unchanged && <span className="ml-2 text-xs font-normal text-gray-500 italic">(unchanged)</span>}
            </span>
            {children}
        </div>
    );
}

/**
 * One label + content line: a fixed-width gray title on the left, content on the right. The shared
 * inner row of {@link BeforeAfter} and {@link DiffBeforeAfter}, so both keep an identical layout.
 */
function TitledFieldRowInner({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-xs text-gray-500">{title}</span>
            <div className="text-gray-200">{children}</div>
        </div>
    );
}

/** Two explicitly-labeled panels, for values that can't be usefully diffed against each other. */
export function BeforeAfter({ before, after }: { before: ReactNode; after: ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <TitledFieldRowInner title="Before">{before}</TitledFieldRowInner>
            <TitledFieldRowInner title="After">{after}</TitledFieldRowInner>
        </div>
    );
}

/**
 * A word-level diff of two raw strings shown under a "Diff" label, followed by the same
 * before/after panels {@link BeforeAfter} renders, so a diffable field reads consistently with a
 * non-diffable one. Used when both sides are present (see UnsupportedSchemaVersion).
 * All items are wrapped by the given `wrapper` before use.
 */
export function DiffBeforeAfter({ before, after, wrapper = (node) => node }: {
    before: string;
    after: string;
    wrapper?: (node: ReactNode) => ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1">
            <TitledFieldRowInner title="Diff">{wrapper(<RenderedWordDiff before={before} after={after} />)}</TitledFieldRowInner>
            <TitledFieldRowInner title="Before">{wrapper(before)}</TitledFieldRowInner>
            <TitledFieldRowInner title="After">{wrapper(after)}</TitledFieldRowInner>
        </div>
    );
}

/** A small warning annotation shown below a value (e.g. "no longer exists", "changed since"). */
export function Note({ children }: { children: ReactNode }) {
    return <span className="text-xs text-amber-500 italic">{children}</span>;
}

export function NotRecorded() {
    return <span className="text-gray-500 italic">(not recorded)</span>;
}

export function NullValue() {
    return <span className="text-gray-500 italic">(null)</span>;
}

export function EmptyValue() {
    return <span className="text-gray-500 italic">(empty string)</span>;
}

/** Human-readable label for an hd_person_type value. */
export function personTypeLabel(type: hd_person_type): string {
    return type === hd_person_type.MINECRAFT ? "Minecraft" : "NPC";
}
