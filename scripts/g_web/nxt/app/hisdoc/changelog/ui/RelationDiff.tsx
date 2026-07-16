import { TagChip } from "../../ui/TagChip";
import SmallPerson from "../../ui/SmallPerson";
import SmallerEvent from "../../ui/SmallerEvent";
import { TagRelationItem, PersonRelationItem, EventRelationItem } from "../lib/fieldDiffs";
import { resolvePersonDisplayName } from "../lib/personDisplayName";
import { ResolvedRefs, isEntityGone, isEntitySoftDeleted } from "../lib/resolveRefs";
import { FieldRow, Note, personTypeLabel } from "./common";
import { colorToHex } from "../../lib/color";

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

/** The stacked list of warning notes below a relation's chip row (empty renders nothing). */
function NoteList({ notes }: { notes: string[] }) {
    if (notes.length === 0) return null;
    return (
        <ul className="mt-1 flex flex-col gap-0.5">
            {notes.map((note, i) => <li key={i}><Note>{note}</Note></li>)}
        </ul>
    );
}

/**
 * Diffs an EVENT snapshot's embedded `tags` array. Each chip always shows the *saved* (snapshot)
 * name/color, never the live tag's — with a note below the whole chip row if the live tag has
 * since changed, been soft-deleted, or no longer exists, and a separate note if the before/after
 * embedded data itself disagrees for an id present on both sides (the tag was edited between two
 * unrelated event changes). A soft-deleted tag still counts as existing (its page still renders),
 * so it still links; only a fully-missing row disables the link.
 */
export function TagsRelationDiff({ label, before, after, refs }: {
    label: string;
    before: TagRelationItem[] | undefined;
    after: TagRelationItem[] | undefined;
    refs: ResolvedRefs;
}) {
    const items = classify(before, after);
    if (items.length === 0) return null;

    const notes: string[] = [];
    const chips = items.map(({ id, status, beforeItem, afterItem }) => {
        const embedded = afterItem ?? beforeItem!;
        const missing = isEntityGone(id, refs.tags);
        const live = refs.tags.get(id);

        if (missing) {
            notes.push(`"${embedded.name}" (#${id}) no longer exists.`);
        } else {
            if (isEntitySoftDeleted(id, refs.tags)) notes.push(`"${embedded.name}" (#${id}) has since been soft-deleted.`);
            if (live!.name !== embedded.name) notes.push(`Name of "${embedded.name}" (#${id}) has changed since (now "${live!.name}").`);
            if (live!.color !== embedded.color) notes.push(`Color of "${embedded.name}" (#${id}) has changed since.`);
        }
        if (status === "unchanged" && beforeItem !== undefined && afterItem !== undefined) {
            if (beforeItem.name !== afterItem.name) notes.push(`Before/after data for #${id} disagrees on name ("${beforeItem.name}" vs. "${afterItem.name}").`);
            if (beforeItem.color !== afterItem.color) notes.push(`Before/after data for "${embedded.name}" (#${id}) disagrees on color ("${colorToHex(beforeItem.color)}" vs. "${colorToHex(afterItem.color)}").`);
        }

        return <TagChip key={id} id={id} name={embedded.name} description="" bgColor={RELATION_BG[status]} holeColorCSS={colorToHex(embedded.color)} isLink={!missing} />;
    });

    return (
        <FieldRow label={label}>
            <div className="flex flex-wrap gap-2">{chips}</div>
            <NoteList notes={notes} />
        </FieldRow>
    );
}

/** Same as {@link TagsRelationDiff}, for an EVENT snapshot's embedded `persons` array. */
export async function PersonsRelationDiff({ label, before, after, refs }: {
    label: string;
    before: PersonRelationItem[] | undefined;
    after: PersonRelationItem[] | undefined;
    refs: ResolvedRefs;
}) {
    const items = classify(before, after);
    if (items.length === 0) return null;

    // Resolve display names for the saved (embedded) data on both sides — not the live person, a
    // renamed NPC or reassigned Minecraft account should still show what this event actually
    // recorded — both sides are needed (not just the chosen "embedded" one) to word a before/after
    // embedded-data-disagrees note using resolved names rather than a raw uuid
    const rows = await Promise.all(items.map(async ({ id, status, beforeItem, afterItem }) => {
        const embedded = afterItem ?? beforeItem!;
        const embeddedName = await resolvePersonDisplayName(embedded);
        const beforeName = beforeItem === undefined ? undefined : await resolvePersonDisplayName(beforeItem);
        const afterName = afterItem === undefined ? undefined : await resolvePersonDisplayName(afterItem);
        return { id, status, beforeItem, afterItem, embedded, embeddedName, beforeName, afterName };
    }));

    const notes: string[] = [];
    const chips = rows.map(({ id, status, beforeItem, afterItem, embedded, embeddedName, beforeName, afterName }) => {
        const missing = isEntityGone(id, refs.persons);
        const live = refs.persons.get(id);

        if (missing) {
            notes.push(`"${embeddedName}" (#${id}) no longer exists.`);
        } else {
            if (isEntitySoftDeleted(id, refs.persons)) notes.push(`"${embeddedName}" (#${id}) has since been soft-deleted.`);
            if (live!.type !== embedded.type) notes.push(`Person type for "${embeddedName}" (#${id}) has changed since.`);
            if (live!.data !== embedded.data) notes.push(`Person data for "${embeddedName}" (#${id}) has changed since.`);
        }
        if (status === "unchanged" && beforeItem !== undefined && afterItem !== undefined) {
            if (beforeItem.type !== afterItem.type) notes.push(`Before/after data for "${embeddedName}" (#${id}) disagrees on type ("${personTypeLabel(beforeItem.type)}" vs. "${personTypeLabel(afterItem.type)}").`);
            if (beforeItem.data !== afterItem.data) notes.push(`Before/after data for "${embeddedName}" (#${id}) disagrees on data ("${beforeName}" vs. "${afterName}").`);
        }

        return <SmallPerson key={id} id={id} type={embedded.type} playerdata={embedded.data} name={embeddedName} isLink={!missing} bgColor={RELATION_BG[status]} />;
    });

    return (
        <FieldRow label={label}>
            <div className="flex flex-wrap gap-4">{chips}</div>
            <NoteList notes={notes} />
        </FieldRow>
    );
}

/** Same as {@link TagsRelationDiff}, for an EVENT snapshot's embedded `relatedEvents` array. */
export function RelatedEventsRelationDiff({ label, before, after, refs }: {
    label: string;
    before: EventRelationItem[] | undefined;
    after: EventRelationItem[] | undefined;
    refs: ResolvedRefs;
}) {
    const items = classify(before, after);
    if (items.length === 0) return null;

    const notes: string[] = [];
    const chips = items.map(({ id, status, beforeItem, afterItem }) => {
        const embedded = afterItem ?? beforeItem!;
        const missing = isEntityGone(id, refs.events);
        const live = refs.events.get(id);

        if (missing) {
            notes.push(`"${embedded.name}" (#${id}) no longer exists.`);
        } else {
            if (isEntitySoftDeleted(id, refs.events)) notes.push(`"${embedded.name}" (#${id}) has since been soft-deleted.`);
            if (live!.name !== embedded.name) notes.push(`Name of "${embedded.name}" (#${id}) has changed since (now "${live!.name}").`);
        }
        if (status === "unchanged" && beforeItem !== undefined && afterItem !== undefined && beforeItem.name !== afterItem.name) {
            notes.push(`Before/after data for #${id} disagrees on name ("${beforeItem.name}" vs. "${afterItem.name}").`);
        }

        return <SmallerEvent key={id} id={id} name={embedded.name} isLink={!missing} bgColor={RELATION_BG[status]} />;
    });

    return (
        <FieldRow label={label}>
            <div className="flex flex-wrap gap-2">{chips}</div>
            <NoteList notes={notes} />
        </FieldRow>
    );
}
