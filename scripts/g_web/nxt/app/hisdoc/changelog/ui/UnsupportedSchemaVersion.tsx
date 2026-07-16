import { ReactNode } from "react";
import { BeforeAfter, DiffBeforeAfter, NullValue, FieldRow } from "./common";

/**
 * Raw-data fallback shown when a changelog entry's schema_version has no registered field
 * table/parser, or when old_values/new_values fails to parse (malformed JSON or a shape mismatch) —
 * forward/legacy compatibility per doc/Databases.md ("Shape is determined by schema_version"). Since
 * the shape is unknown, no structured field diff is possible; when both sides are present a
 * best-effort word diff plus the raw sides is shown, otherwise just the raw sides. The "could not
 * render a diff" warning banner is raised by the page above the change message, not here.
 */
export default function UnsupportedSchemaVersion({ rawOld, rawNew }: {
    rawOld: string | null;
    rawNew: string | null;
}) {
    // Format a raw side like code, distinguishing a genuinely-null side from an empty one
    const wrapper = (raw: ReactNode) => raw === null ? <NullValue /> : <pre className="overflow-x-auto rounded bg-gray-700 p-2 font-mono text-xs text-wrap">{raw}</pre>;
    return (
        <FieldRow label="Raw JSON">
            {rawOld !== null && rawNew !== null
                ? <DiffBeforeAfter before={rawOld} after={rawNew} wrapper={wrapper} />
                : <BeforeAfter before={wrapper(rawOld)} after={wrapper(rawNew)} />}
        </FieldRow>
    );
}
