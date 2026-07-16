import { ReactNode } from "react";
import { ResolvedRefs } from "../lib/resolveRefs";
import { FieldRow, BeforeAfter, NotRecorded, NullValue } from "./common";

/** Resolves a g_web user id to its current username, falling back to "user #N" if the row is gone. */
function resolveUsername(id: number | null, users: Map<number, string>): ReactNode {
    if (id === null) return <NullValue />;
    return users.get(id) ?? `user #${id}`;
}

/**
 * Diffs a nullable g_web user-id foreign key (hd_event.posted_by_user_id, hd_person.linked_user_id),
 * resolved to a username via the page's batched {@link ResolvedRefs} lookup.
 */
export default function UserRefDiff({ label, before, after, refs }: {
    label: string;
    before: number | null | undefined;
    after: number | null | undefined;
    refs: ResolvedRefs;
}) {
    if (before === undefined && after === undefined) return null;

    if (before !== undefined && after !== undefined && before === after) {
        return <FieldRow label={label} unchanged>{resolveUsername(after, refs.users)}</FieldRow>;
    }

    return (
        <FieldRow label={label}>
            <BeforeAfter
                before={before === undefined ? <NotRecorded /> : resolveUsername(before, refs.users)}
                after={after === undefined ? <NotRecorded /> : resolveUsername(after, refs.users)}
            />
        </FieldRow>
    );
}
