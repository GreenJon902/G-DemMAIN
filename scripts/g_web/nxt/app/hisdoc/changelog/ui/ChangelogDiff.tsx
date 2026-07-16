import { FieldDescriptor } from "../lib/fields";
import { ResolvedRefs } from "../lib/resolveRefs";
import FieldDiffRow from "./FieldDiffRow";

/** Renders one diff row per field descriptor, in table order. */
export default function ChangelogDiff<T extends object>({ fields, before, after, refs }: {
    fields: Array<FieldDescriptor<T>>;
    before: T | null;
    after: T | null;
    refs: ResolvedRefs;
}) {
    return (
        <div className="flex flex-col gap-4">
            {fields.map((descriptor) => (
                <FieldDiffRow key={descriptor.label} descriptor={descriptor} before={before} after={after} refs={refs} />
            ))}
        </div>
    );
}
