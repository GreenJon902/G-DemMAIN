import { FieldDiff } from "../lib/fieldDiffs";
import { ResolvedRefs } from "../lib/resolveRefs";
import FieldDiffRow from "./FieldDiffRow";

/** Renders one diff row per field, in table order. */
export default function ChangelogDiff({ fields, refs }: { fields: FieldDiff[]; refs: ResolvedRefs }) {
    return (
        <div className="flex flex-col gap-4">
            {fields.map((field) => (
                <FieldDiffRow key={field.label} field={field} refs={refs} />
            ))}
        </div>
    );
}
