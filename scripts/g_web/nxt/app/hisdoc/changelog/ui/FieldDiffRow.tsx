import { FieldDiff } from "../lib/fieldDiffs";
import { ResolvedRefs } from "../lib/resolveRefs";
import TextDiff from "./TextDiff";
import ScalarDiff from "./ScalarDiff";
import DateTimeDiff from "./DateTimeDiff";
import FlexiDateDiff from "./FlexiDateDiff";
import UserRefDiff from "./UserRefDiff";
import { TagsRelationDiff, PersonsRelationDiff, RelatedEventsRelationDiff } from "./RelationDiff";

/** Renders one field of a changelog diff by dispatching on `field.kind` to the matching kind-specific renderer. */
export default function FieldDiffRow({ field, refs }: { field: FieldDiff; refs: ResolvedRefs }) {
    switch (field.kind) {
    case "text":
    case "longtext":
    case "nullableLongtext":
    case "rawText":
        return <TextDiff label={field.label} before={field.old_value} after={field.new_value} longtext={field.kind === "longtext" || field.kind === "nullableLongtext"} wordDiff={field.kind !== "rawText"} />;

    case "boolean":
    case "color":
    case "personType":
        return <ScalarDiff label={field.label} kind={field.kind} before={field.old_value} after={field.new_value} />;

    case "datetime":
        return <DateTimeDiff label={field.label} before={field.old_value} after={field.new_value} />;

    case "userRef":
        return <UserRefDiff label={field.label} before={field.old_value} after={field.new_value} refs={refs} />;

    case "flexidate":
        return <FlexiDateDiff label={field.label} before={field.old} after={field.new} />;

    case "tags":
        return <TagsRelationDiff label={field.label} before={field.old} after={field.new} refs={refs} />;

    case "persons":
        return <PersonsRelationDiff label={field.label} before={field.old} after={field.new} refs={refs} />;

    case "relatedEvents":
        return <RelatedEventsRelationDiff label={field.label} before={field.old} after={field.new} refs={refs} />;
    }
}
