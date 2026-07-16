import { hd_changelog_what } from "@g/com/prisma/enums";
import { TagSnapshotV1, PersonSnapshotV1, EventSnapshotV1 } from "./snapshot";

export type ReferencedIds = {
    userIds: Set<number>;
    tagIds: Set<number>;
    personIds: Set<number>;
    eventIds: Set<number>;
};

/**
 * Walks both snapshot sides of a changelog entry and collects every id that needs a live lookup
 * to render the diff: referenced users (the entry's own attribution, an EVENT's posted_by_user_id,
 * a PERSON's linked_user_id), and the tags/persons/relatedEvents embedded in an EVENT snapshot.
 *
 * @param entryUserId - hd_changelog.user_id (who made this change), or null if automated/imported.
 */
export function collectReferencedIds(
    what: hd_changelog_what,
    before: TagSnapshotV1 | PersonSnapshotV1 | EventSnapshotV1 | null,
    after: TagSnapshotV1 | PersonSnapshotV1 | EventSnapshotV1 | null,
    entryUserId: number | null
): ReferencedIds {
    const userIds = new Set<number>();
    const tagIds = new Set<number>();
    const personIds = new Set<number>();
    const eventIds = new Set<number>();

    if (entryUserId !== null) userIds.add(entryUserId);

    for (const snapshot of [before, after]) {
        if (snapshot === null) continue;

        if (what === hd_changelog_what.PERSON) {
            const person = snapshot as PersonSnapshotV1;
            if (person.linked_user_id !== null) userIds.add(person.linked_user_id);
        }

        if (what === hd_changelog_what.EVENT) {
            const event = snapshot as EventSnapshotV1;
            userIds.add(event.posted_by_user_id);
            for (const tag of event.tags) tagIds.add(tag.id);
            for (const person of event.persons) personIds.add(person.id);
            for (const related of event.relatedEvents) eventIds.add(related.id);
        }
    }

    return { userIds, tagIds, personIds, eventIds };
}
