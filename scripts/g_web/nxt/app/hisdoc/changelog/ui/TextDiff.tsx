import { ReactNode } from "react";
import { FieldRow, BeforeAfter, NotRecorded, NullValue, EmptyValue } from "./common";
import RenderedWordDiff from "./RenderedWordDiff";

function renderPlain(value: string): ReactNode {
    return value === "" ? <EmptyValue /> : value;
}

/**
 * Diffs a text/longtext field. Null and empty string are distinguished explicitly (a "(null)" or
 * "(empty string)" badge) rather than both rendering as blank. When both sides are present,
 * non-null, and differ, renders a word-level diff via the `diff` package; when only one side is
 * available (e.g. INSERT, where old_values is null), shows explicit Before/After panels instead —
 * there's nothing to usefully diff against.
 *
 * @param wordDiff - When false, a changed value is shown as explicit Before/After panels rather
 *                    than a word-level diff. Used for values where word-diffing is meaningless
 *                    (e.g. a UUID, where character runs don't correspond to editable words).
 */
export default function TextDiff({ label, before, after, longtext = false, wordDiff = true }: {
    label: string;
    before: string | null | undefined;
    after: string | null | undefined;
    longtext?: boolean;
    wordDiff?: boolean;
}) {
    if (before === undefined && after === undefined) return null;

    const wrapperClass = longtext ? "whitespace-pre-wrap" : "";

    if (before !== undefined && after !== undefined) {
        if (before === null && after === null) {
            return <FieldRow label={label} unchanged><NullValue /></FieldRow>;
        }
        if (before !== null && after !== null) {
            if (before === after) {
                return <FieldRow label={label} unchanged><span className={wrapperClass}>{renderPlain(after)}</span></FieldRow>;
            }
            if (wordDiff) {
                return <FieldRow label={label}><div className={wrapperClass}><RenderedWordDiff before={before} after={after} /></div></FieldRow>;
            }
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
