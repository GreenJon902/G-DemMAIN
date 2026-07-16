import { FieldRow, Unchanged, BeforeAfter, NotRecorded } from "./common";

/**
 * Diffs an ISO-string datetime field (currently only hd_event.posted_at). Never word-diffed — an
 * ISO string differs almost entirely in text even for a one-second change, so it's shown as a
 * single "(unchanged)" formatted value, or explicit Before/After panels otherwise.
 */
export default function DateTimeDiff({ label, before, after }: {
    label: string;
    before: string | undefined;
    after: string | undefined;
}) {
    if (before === undefined && after === undefined) return null;

    const format = (iso: string) => new Date(iso).toLocaleString();

    if (before !== undefined && after !== undefined && before === after) {
        return <FieldRow label={label}><Unchanged>{format(after)}</Unchanged></FieldRow>;
    }

    return (
        <FieldRow label={label}>
            <BeforeAfter
                before={before === undefined ? <NotRecorded /> : format(before)}
                after={after === undefined ? <NotRecorded /> : format(after)}
            />
        </FieldRow>
    );
}
