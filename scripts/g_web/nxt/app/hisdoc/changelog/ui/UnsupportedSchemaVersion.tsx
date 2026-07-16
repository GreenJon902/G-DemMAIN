import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { diffWordsWithSpace } from "diff";

/** Renders a word-level diff over raw text, same styling as TextDiff's word diff. */
function renderRawDiff(before: string, after: string) {
    const parts = diffWordsWithSpace(before, after);
    return parts.map((part, i) => {
        if (part.added) return <ins key={i} className="bg-green-900/60 text-green-200 no-underline">{part.value}</ins>;
        if (part.removed) return <del key={i} className="bg-red-900/60 text-red-200 line-through">{part.value}</del>;
        return <span key={i}>{part.value}</span>;
    });
}

/**
 * Fallback shown when a changelog entry's schema_version has no registered field table/parser, or
 * when old_values/new_values fails to parse (malformed JSON or a shape mismatch) — forward/legacy
 * compatibility per doc/Databases.md ("Shape is determined by schema_version"). Since the shape is
 * unknown, no structured field diff is possible — but when both sides are present, a raw word-level
 * text diff over the two JSON strings is still shown as a best-effort comparison, in addition to
 * (not instead of) dumping each side's full JSON for reference.
 */
export default function UnsupportedSchemaVersion({ reason, rawOld, rawNew }: {
    reason: string;
    rawOld: string | null;
    rawNew: string | null;
}) {
    return (
        <div className="flex flex-col gap-2">
            <p className="my-2 flex items-center gap-2 border border-amber-600 bg-amber-100 pl-1 whitespace-pre-wrap text-amber-900">
                <ExclamationTriangleIcon className="size-5 shrink-0 text-amber-700" />
                Could not render a diff for this entry ({reason}). Showing the raw stored data instead.
            </p>

            {rawOld !== null && rawNew !== null && (
                <div>
                    <p className="text-sm text-gray-400">Raw diff (best-effort, not schema-aware)</p>
                    <pre className="overflow-x-auto rounded bg-gray-800 p-2 text-xs text-wrap text-gray-200">{renderRawDiff(rawOld, rawNew)}</pre>
                </div>
            )}

            <div className="flex flex-col gap-2">
                <div>
                    <p className="text-sm text-gray-400">Before</p>
                    <pre className="overflow-x-auto rounded bg-gray-800 p-2 text-xs text-wrap text-gray-200">{rawOld ?? "(null)"}</pre>
                </div>
                <div>
                    <p className="text-sm text-gray-400">After</p>
                    <pre className="overflow-x-auto rounded bg-gray-800 p-2 text-xs text-wrap text-gray-200">{rawNew ?? "(null)"}</pre>
                </div>
            </div>
        </div>
    );
}
