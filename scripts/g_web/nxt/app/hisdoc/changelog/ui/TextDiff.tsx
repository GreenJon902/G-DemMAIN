import { ReactNode } from "react";
import { diffWordsWithSpace } from "diff";
import { FieldRow, Unchanged, BeforeAfter, NotRecorded, NullValue, EmptyValue } from "./common";

function renderPlain(value: string): ReactNode {
    return value === "" ? <EmptyValue /> : value;
}

/** Renders a word-level diff, insertions green, deletions red+strikethrough, unchanged plain. */
function renderWordDiff(before: string, after: string): ReactNode {
    const parts = diffWordsWithSpace(before, after);
    return (
        <>
            {parts.map((part, i) => {
                if (part.added) return <ins key={i} className="bg-green-900/60 text-green-200 no-underline">{part.value}</ins>;
                if (part.removed) return <del key={i} className="bg-red-900/60 text-red-200 line-through">{part.value}</del>;
                return <span key={i}>{part.value}</span>;
            })}
        </>
    );
}

/**
 * Diffs a text/longtext field. Null and empty string are distinguished explicitly (a "(null)" or
 * "(empty string)" badge) rather than both rendering as blank. When both sides are present,
 * non-null, and differ, renders a word-level diff via the `diff` package; when only one side is
 * available (e.g. INSERT, where old_values is null), shows explicit Before/After panels instead —
 * there's nothing to usefully diff against.
 */
export default function TextDiff({ label, before, after, longtext = false }: {
    label: string;
    before: string | null | undefined;
    after: string | null | undefined;
    longtext?: boolean;
}) {
    if (before === undefined && after === undefined) return null;

    const wrapperClass = longtext ? "whitespace-pre-wrap" : "";

    if (before !== undefined && after !== undefined) {
        if (before === null && after === null) {
            return <FieldRow label={label}><Unchanged><NullValue /></Unchanged></FieldRow>;
        }
        if (before !== null && after !== null) {
            if (before === after) {
                return <FieldRow label={label}><Unchanged><span className={wrapperClass}>{renderPlain(after)}</span></Unchanged></FieldRow>;
            }
            return <FieldRow label={label}><div className={wrapperClass}>{renderWordDiff(before, after)}</div></FieldRow>;
        }
    }

    const renderSide = (value: string | null | undefined) => {
        if (value === undefined) return <NotRecorded />;
        if (value === null) return <NullValue />;
        return <span className={wrapperClass}>{renderPlain(value)}</span>;
    };

    return (
        <FieldRow label={label}>
            <BeforeAfter before={renderSide(before)} after={renderSide(after)} />
        </FieldRow>
    );
}
