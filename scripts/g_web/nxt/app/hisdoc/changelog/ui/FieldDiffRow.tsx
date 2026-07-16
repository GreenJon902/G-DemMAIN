import { hd_person_type } from "@g/com/prisma/enums";
import { FieldDescriptor } from "../lib/fields";
import { EventSnapshotV1 } from "../lib/snapshot";
import { ResolvedRefs } from "../lib/resolveRefs";
import TextDiff from "./TextDiff";
import ScalarDiff from "./ScalarDiff";
import DateTimeDiff from "./DateTimeDiff";
import FlexiDateDiff from "./FlexiDateDiff";
import UserRefDiff from "./UserRefDiff";
import { TagsRelationDiff, PersonsRelationDiff, RelatedEventsRelationDiff } from "./RelationDiff";

/**
 * Renders one field of a changelog diff by dispatching on `descriptor.kind` to the matching
 * kind-specific renderer. The casts below are safe by construction, not by the type system: each
 * `FieldDescriptor<T>` in fields.ts hand-pairs a `kind` with a `key` whose actual field type
 * matches that kind (e.g. a "color" descriptor is only ever pointed at an `int` column) — but
 * that correlation isn't something `keyof T` indexing can express, so TypeScript sees `T[keyof T]`
 * rather than the narrower type each renderer expects.
 */
export default function FieldDiffRow<T extends object>({ descriptor, before, after, refs }: {
    descriptor: FieldDescriptor<T>;
    before: T | null;
    after: T | null;
    refs: ResolvedRefs;
}) {
    if (descriptor.kind === "flexidate") {
        // Only ever used by EVENT_FIELDS_V1, where T = EventSnapshotV1
        return (
            <FlexiDateDiff
                label={descriptor.label}
                before={(before as EventSnapshotV1 | null) ?? undefined}
                after={(after as EventSnapshotV1 | null) ?? undefined}
            />
        );
    }

    const beforeValue = before === null ? undefined : before[descriptor.key];
    const afterValue = after === null ? undefined : after[descriptor.key];

    switch (descriptor.kind) {
    case "text":
    case "longtext":
    case "nullableLongtext":
        return (
            <TextDiff
                label={descriptor.label}
                before={beforeValue as string | null | undefined}
                after={afterValue as string | null | undefined}
                longtext={descriptor.kind !== "text"}
            />
        );

    case "boolean":
    case "color":
    case "personType":
        return (
            <ScalarDiff
                label={descriptor.label}
                kind={descriptor.kind}
                before={beforeValue as boolean | number | hd_person_type | undefined}
                after={afterValue as boolean | number | hd_person_type | undefined}
            />
        );

    case "datetime":
        return (
            <DateTimeDiff
                label={descriptor.label}
                before={beforeValue as string | undefined}
                after={afterValue as string | undefined}
            />
        );

    case "userRef":
        return (
            <UserRefDiff
                label={descriptor.label}
                before={beforeValue as number | null | undefined}
                after={afterValue as number | null | undefined}
                refs={refs}
            />
        );

    case "tags":
        return (
            <TagsRelationDiff
                label={descriptor.label}
                before={beforeValue as EventSnapshotV1["tags"] | undefined}
                after={afterValue as EventSnapshotV1["tags"] | undefined}
                refs={refs}
            />
        );

    case "persons":
        return (
            <PersonsRelationDiff
                label={descriptor.label}
                before={beforeValue as EventSnapshotV1["persons"] | undefined}
                after={afterValue as EventSnapshotV1["persons"] | undefined}
                refs={refs}
            />
        );

    case "relatedEvents":
        return (
            <RelatedEventsRelationDiff
                label={descriptor.label}
                before={beforeValue as EventSnapshotV1["relatedEvents"] | undefined}
                after={afterValue as EventSnapshotV1["relatedEvents"] | undefined}
                refs={refs}
            />
        );
    }
}
