import { ReactNode } from "react";

/** One row in the diff: a label followed by whatever value/diff presentation the field's kind produces. */
export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-gray-300">{label}</span>
            {children}
        </div>
    );
}

/** A single value shown once, tagged as unchanged between before and after. */
export function Unchanged({ children }: { children: ReactNode }) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="text-gray-200">{children}</div>
            <span className="text-xs text-gray-500 italic">(unchanged)</span>
        </div>
    );
}

/** Two explicitly-labeled panels, for values that can't be usefully diffed against each other. */
export function BeforeAfter({ before, after }: { before: ReactNode; after: ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-start gap-2">
                <span className="w-12 shrink-0 text-xs text-gray-500">Before</span>
                <div className="text-gray-200">{before}</div>
            </div>
            <div className="flex items-start gap-2">
                <span className="w-12 shrink-0 text-xs text-gray-500">After</span>
                <div className="text-gray-200">{after}</div>
            </div>
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
