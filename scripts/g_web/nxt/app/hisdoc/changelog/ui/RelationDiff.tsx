import { hd_person_type } from "@g/com/prisma/enums";
import { TagChip } from "../../ui/TagChip";
import SmallPerson from "../../ui/SmallPerson";
import SmallerEvent from "../../ui/SmallerEvent";
import { getMinecraftUsername } from "../../lib/minecraft";
import { ResolvedRefs, isEntityGone } from "../lib/resolveRefs";
import { FieldRow, Note } from "./common";

type RelationStatus = "added" | "removed" | "unchanged";

// Tailwind bg classes forced onto the chip/pill in place of the entity's real color, so the chip
// communicates diff status (added/removed/unchanged) rather than its true tag color
const RELATION_BG: Record<RelationStatus, string> = {
    added: "bg-green-700",
    removed: "bg-red-700",
    unchanged: "bg-gray-700"
};

type Classified<T> = { id: number; status: RelationStatus; beforeItem: T | undefined; afterItem: T | undefined };

/**
 * Classifies the union of `before`/`after` relation-array ids: present in both = unchanged,
 * before-only = removed, after-only = added. Nothing outside this union is included.
 */
function classify<T extends { id: number }>(before: T[] | undefined, after: T[] | undefined): Array<Classified<T>> {
    const beforeMap = new Map((before ?? []).map((item) => [item.id, item]));
    const afterMap = new Map((after ?? []).map((item) => [item.id, item]));
    const ids = new Set([...beforeMap.keys(), ...afterMap.keys()]);
    return [...ids].map((id) => {
        const beforeItem = beforeMap.get(id);
        const afterItem = afterMap.get(id);
        const status: RelationStatus = beforeItem !== undefined && afterItem !== undefined ? "unchanged" : beforeItem !== undefined ? "removed" : "added";
        return { id, status, beforeItem, afterItem };
    });
}

/**
 * Diffs an EVENT snapshot's embedded `tags` array. Each chip always shows the *saved* (snapshot)
 * name/color, never the live tag's — with a note if the live tag has since changed or no longer
 * exists, and a separate note if the before/after embedded data itself disagrees for an id present
 * on both sides (the tag was edited between two unrelated event changes).
 */
export function TagsRelationDiff({ label, before, after, refs }: {
    label: string;
    before: Array<{ id: number; name: string; color: number }> | undefined;
    after: Array<{ id: number; name: string; color: number }> | undefined;
    refs: ResolvedRefs;
}) {
    const items = classify(before, after);
    if (items.length === 0) return null;

    return (
        <FieldRow label={label}>
            <div className="flex flex-wrap gap-2">
                {items.map(({ id, status, beforeItem, afterItem }) => {
                    const embedded = afterItem ?? beforeItem!;
                    const gone = isEntityGone(id, refs.tags);
                    const live = refs.tags.get(id);
                    const driftedLive = !gone && live !== undefined && (live.name !== embedded.name || live.color !== embedded.color);
                    const driftedEmbedded = status === "unchanged" && beforeItem !== undefined && afterItem !== undefined
                        && (beforeItem.name !== afterItem.name || beforeItem.color !== afterItem.color);

                    return (
                        <div key={id} className="flex flex-col items-start gap-0.5">
                            <TagChip id={id} name={embedded.name} description="" bgColor={RELATION_BG[status]} holeColor="bg-gray-900" isLink={!gone} />
                            {gone && <Note>No longer exists</Note>}
                            {driftedLive && <Note>Name/color has changed since (now &quot;{live!.name}&quot;)</Note>}
                            {driftedEmbedded && <Note>Before/after embedded data disagrees</Note>}
                        </div>
                    );
                })}
            </div>
        </FieldRow>
    );
}

/** Same as {@link TagsRelationDiff}, for an EVENT snapshot's embedded `persons` array. */
export async function PersonsRelationDiff({ label, before, after, refs }: {
    label: string;
    before: Array<{ id: number; type: hd_person_type; data: string }> | undefined;
    after: Array<{ id: number; type: hd_person_type; data: string }> | undefined;
    refs: ResolvedRefs;
}) {
    const items = classify(before, after);
    if (items.length === 0) return null;

    // Resolve display names for the saved (embedded) data, not the live person — a renamed NPC or
    // reassigned Minecraft account should still show what this event actually recorded
    const rows = await Promise.all(items.map(async ({ id, status, beforeItem, afterItem }) => {
        const embedded = afterItem ?? beforeItem!;
        const displayName = embedded.type === hd_person_type.MINECRAFT ? await getMinecraftUsername(embedded.data) : embedded.data;
        return { id, status, beforeItem, afterItem, embedded, displayName };
    }));

    return (
        <FieldRow label={label}>
            <div className="flex flex-wrap gap-4">
                {rows.map(({ id, status, beforeItem, afterItem, embedded, displayName }) => {
                    const gone = isEntityGone(id, refs.persons);
                    const live = refs.persons.get(id);
                    const driftedLive = !gone && live !== undefined && (live.type !== embedded.type || live.data !== embedded.data);
                    const driftedEmbedded = status === "unchanged" && beforeItem !== undefined && afterItem !== undefined
                        && (beforeItem.type !== afterItem.type || beforeItem.data !== afterItem.data);

                    return (
                        <div key={id} className="flex flex-col items-start gap-0.5">
                            <SmallPerson id={id} type={embedded.type} playerdata={embedded.data} name={displayName} isLink={!gone} bgColor={RELATION_BG[status]} />
                            {gone && <Note>No longer exists</Note>}
                            {driftedLive && <Note>Data has changed since</Note>}
                            {driftedEmbedded && <Note>Before/after embedded data disagrees</Note>}
                        </div>
                    );
                })}
            </div>
        </FieldRow>
    );
}

/** Same as {@link TagsRelationDiff}, for an EVENT snapshot's embedded `relatedEvents` array. */
export function RelatedEventsRelationDiff({ label, before, after, refs }: {
    label: string;
    before: Array<{ id: number; name: string }> | undefined;
    after: Array<{ id: number; name: string }> | undefined;
    refs: ResolvedRefs;
}) {
    const items = classify(before, after);
    if (items.length === 0) return null;

    return (
        <FieldRow label={label}>
            <div className="flex flex-wrap gap-2">
                {items.map(({ id, status, beforeItem, afterItem }) => {
                    const embedded = afterItem ?? beforeItem!;
                    const gone = isEntityGone(id, refs.events);
                    const live = refs.events.get(id);
                    const driftedLive = !gone && live !== undefined && live.name !== embedded.name;
                    const driftedEmbedded = status === "unchanged" && beforeItem !== undefined && afterItem !== undefined && beforeItem.name !== afterItem.name;

                    return (
                        <div key={id} className="flex flex-col items-start gap-0.5">
                            <SmallerEvent id={id} name={embedded.name} isLink={!gone} bgColor={RELATION_BG[status]} />
                            {gone && <Note>No longer exists</Note>}
                            {driftedLive && <Note>Name has changed since (now &quot;{live!.name}&quot;)</Note>}
                            {driftedEmbedded && <Note>Before/after embedded data disagrees</Note>}
                        </div>
                    );
                })}
            </div>
        </FieldRow>
    );
}
