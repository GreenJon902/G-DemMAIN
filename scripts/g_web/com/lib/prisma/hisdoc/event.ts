/**
 * The only sanctioned way to mutate hd_event, hd_event_tag, hd_event_person and
 * hd_event_event_wri. They're managed together here (rather than one gateway per table) so that
 * an event's own fields and its tag/person/related-event relations can be changed as a single
 * atomic "change" with one hd_changelog row for the event itself.
 *
 * There's no EVENT_TAG/EVENT_PERSON/EVENT_EVENT changelog "what" — relation changes are folded
 * into the EVENT snapshot (see doc/Databases.md, hd_changelog schema version 1). A related-event
 * change also touches the *other* event's snapshot, so that side gets its own separate
 * hd_changelog row in the same transaction.
 */

import prisma from "../client";
import type { hd_event, Prisma } from "../../../generated/prisma/client";
import { hd_changelog_action, hd_changelog_what, hd_event_event_date_type } from "../../../generated/prisma/client";
import type { hd_event_event_date_units } from "../../../generated/prisma/client";
import { type Actor, writeChangelog, buildEventSnapshot } from "./changelog";

// Structurally overlaps app/hisdoc/lib/date/flexidate.ts's `FlexiDate` type (same 6 underlying
// hd_event date columns) but is kept separate: this is a strict discriminated union for the Prisma
// write payload (compile-time centered/ranged narrowing, Prisma enum literals, no offset field),
// whereas FlexiDate is a flat type for display/computation
export type EventDateFields =
    | {
        event_date_type: typeof hd_event_event_date_type.centered,
        event_date1: bigint,
        event_date_units: hd_event_event_date_units,
        event_date_diff: bigint,
        event_date2: null
    }
    | {
        event_date_type: typeof hd_event_event_date_type.ranged,
        event_date1: bigint,
        event_date2: bigint,
        event_date_units: null,
        event_date_diff: null
    };

// The full desired set of active relations for one side — omitting a key leaves that relation type untouched
export type EventRelationsInput = {
    tagIds?: Array<number>,
    personIds?: Array<number>,
    relatedEventIds?: Array<number>
};

export type EventInput = EventDateFields & {
    name: string,
    description: string,
    details?: string | null,
    event_date_time_offset: number
} & EventRelationsInput;

// posted_by_user_id is set once at creation (see createEvent) and cannot be changed afterward
export type EventUpdateInput = Partial<{
    name: string,
    description: string,
    details: string | null,
    event_date_type: hd_event_event_date_type,
    event_date1: bigint,
    event_date_time_offset: number,
    event_date_units: hd_event_event_date_units | null,
    event_date_diff: bigint | null,
    event_date2: bigint | null
}> & EventRelationsInput;

/**
 * Mirrors the chk_flexidate_* CHECK constraints on hd_event (doc/Databases.md), so a bad
 * centered/ranged combination fails here with a clear message instead of a generic DB error.
 */
function validateEventDates(fields: {
    event_date_type: hd_event_event_date_type,
    event_date1: bigint,
    event_date_units: hd_event_event_date_units | null,
    event_date_diff: bigint | null,
    event_date2: bigint | null
}): void {
    if (fields.event_date_type === hd_event_event_date_type.centered) {
        if (fields.event_date_units === null) throw new Error("centered events require event_date_units");
        if (fields.event_date_diff === null) throw new Error("centered events require event_date_diff");
        if (fields.event_date2 !== null) throw new Error("centered events must not set event_date2");
    } else {
        if (fields.event_date_units !== null) throw new Error("ranged events must not set event_date_units");
        if (fields.event_date_diff !== null) throw new Error("ranged events must not set event_date_diff");
        if (fields.event_date2 === null) throw new Error("ranged events require event_date2");
        if (fields.event_date1 > fields.event_date2) throw new Error("ranged events require event_date1 <= event_date2");
    }
}

/**
 * Throws a human-readable error if another event already uses `name`. Pre-checks the
 * uq_hd_event_name constraint, which spans soft-deleted rows too — so no soft_deleted filter here.
 *
 * @param excludeId - The event being updated, exempt from the clash check.
 */
async function assertEventNameFree(tx: Prisma.TransactionClient, name: string, excludeId?: number): Promise<void> {
    const clash = await tx.hd_event.findFirst({ where: { name, ...(excludeId !== undefined && { id: { not: excludeId } }) } });
    if (clash) throw new Error(`An event named "${name}" already exists (possibly deleted)`);
}

/** Calls add()/remove() for exactly the ids that differ between the current and desired sets. */
async function syncIds(
    current: Array<number>,
    desired: Array<number>,
    add: (id: number) => Promise<void>,
    remove: (id: number) => Promise<void>
): Promise<void> {
    const currentSet = new Set(current);
    const desiredSet = new Set(desired);
    for (const id of desired) if (!currentSet.has(id)) await add(id);
    for (const id of current) if (!desiredSet.has(id)) await remove(id);
}

// hd_event_event_wri always stores the lesser id as event_id (enforced DB-side by trg_hd_event_event_sort
// on INSERT), so callers here must pre-sort to look up the correct primary key
function canonicalOrder(eventIdA: number, eventIdB: number): [number, number] {
    if (eventIdA === eventIdB) throw new Error("An event cannot be related to itself");
    return eventIdA < eventIdB ? [eventIdA, eventIdB] : [eventIdB, eventIdA];
}

// hd_event_event_rea is a view, so MariaDB reports soft_deleted as TINYINT rather than the source
// BOOLEAN — Prisma types (and returns) it as a number here, not a boolean
async function currentRelatedEventIds(client: Prisma.TransactionClient, eventId: number): Promise<Array<number>> {
    const rows = await client.hd_event_event_rea.findMany({ where: { event_id: eventId, soft_deleted: 0 } });
    return rows.map((row) => row.related_event_id);
}

/** Lists the ids of events actively (non-soft-deleted) related to the given event, in either direction. */
export async function listEventRelations(eventId: number): Promise<Array<number>> {
    return currentRelatedEventIds(prisma(), eventId);
}

/**
 * Applies a tagIds/personIds/relatedEventIds diff for `eventId` within `tx`. 
 * For relatedEventIds we additionally record, for each other event whose relation changes: 
 *    the other's snapshot from just before that change — the caller uses these to write that event's own changelog row.
 */
async function applyRelationChanges(
    tx: Prisma.TransactionClient,
    eventId: number,
    relations: EventRelationsInput,
    isNewEvent: boolean
): Promise<Map<number, { before: unknown, action: "added" | "removed" }>> {
    const { tagIds, personIds, relatedEventIds } = relations;

    // Related tags -------
    if (tagIds !== undefined) {
        const currentTagIds = isNewEvent ? [] : (await tx.hd_event_tag.findMany({ where: { event_id: eventId, soft_deleted: false } })).map((row) => row.tag_id);
        await syncIds(currentTagIds, tagIds,
            async (tagId) => { await tx.hd_event_tag.upsert({ where: { event_id_tag_id: { event_id: eventId, tag_id: tagId } }, create: { event_id: eventId, tag_id: tagId }, update: { soft_deleted: false } }); },
            async (tagId) => { await tx.hd_event_tag.update({ where: { event_id_tag_id: { event_id: eventId, tag_id: tagId } }, data: { soft_deleted: true } }); }
        );
    }

    // Related persons ----
    if (personIds !== undefined) {
        const currentPersonIds = isNewEvent ? [] : (await tx.hd_event_person.findMany({ where: { event_id: eventId, soft_deleted: false } })).map((row) => row.person_id);
        await syncIds(currentPersonIds, personIds,
            async (personId) => { await tx.hd_event_person.upsert({ where: { event_id_person_id: { event_id: eventId, person_id: personId } }, create: { event_id: eventId, person_id: personId }, update: { soft_deleted: false } }); },
            async (personId) => { await tx.hd_event_person.update({ where: { event_id_person_id: { event_id: eventId, person_id: personId } }, data: { soft_deleted: true } }); }
        );
    }

    // Related events (these need their own changelog rows) ---------
    const otherEventChanges = new Map<number, { before: unknown, action: "added" | "removed" }>();  // Stores other events who's relation status to this one changed
    if (relatedEventIds !== undefined) {
        const currentRelatedIds = isNewEvent ? [] : await currentRelatedEventIds(tx, eventId);
        await syncIds(currentRelatedIds, relatedEventIds,
            async (otherId) => {
                otherEventChanges.set(otherId, { before: await buildEventSnapshot(tx, otherId), action: "added" });

                const [event_id, related_event_id] = canonicalOrder(eventId, otherId);
                await tx.hd_event_event_wri.upsert({ where: { event_id_related_event_id: { event_id, related_event_id } }, create: { event_id, related_event_id }, update: { soft_deleted: false } });
            },
            async (otherId) => {
                otherEventChanges.set(otherId, { before: await buildEventSnapshot(tx, otherId), action: "removed" });

                const [event_id, related_event_id] = canonicalOrder(eventId, otherId);
                await tx.hd_event_event_wri.update({ where: { event_id_related_event_id: { event_id, related_event_id } }, data: { soft_deleted: true } });
            }
        );
    }

    return otherEventChanges;
}

/**
 * Writes the changelog rows for the "other side" of any related-event changes applied above.
 * These get their own auto-generated message rather than the caller's `message`, since that
 * message describes the change from the main event's perspective, not the other event's.
 */
async function logOtherSides(
    tx: Prisma.TransactionClient,
    actor: Actor,
    mainEvent: { id: number, name: string },
    isCreate: boolean,
    otherEventChanges: Map<number, { before: unknown, action: "added" | "removed" }>
): Promise<void> {
    const verb = isCreate ? "creation" : "update";
    for (const [otherId, { before, action }] of otherEventChanges) {
        const after = await buildEventSnapshot(tx, otherId);
        const message = `Event relation ${action} during ${verb} of "${mainEvent.name}" (#${mainEvent.id})`;
        await writeChangelog(tx, actor, message, hd_changelog_what.EVENT, otherId, hd_changelog_action.UPDATE, before, after);
    }
}

/**
 * Creates a new event (attributed to the actor), optionally with initial tag/person/related-event
 * relations, and records the whole thing as one creation in the changelog.
 */
export async function createEvent(actor: Actor, message: string, data: EventInput): Promise<hd_event> {
    validateEventDates(data);
    const { tagIds, personIds, relatedEventIds, ...eventFields } = data;

    return prisma().$transaction(async (tx) => {
        await assertEventNameFree(tx, eventFields.name);

        // Create the new event row
        const event = await tx.hd_event.create({
            data: { ...eventFields, posted_by_user_id: actor.userId }
        });
        
        // Create relationship rows
        const otherEventChanges = await applyRelationChanges(tx, event.id, { tagIds, personIds, relatedEventIds }, true);

        // Save in changelog
        const snapshot = await buildEventSnapshot(tx, event.id);
        await writeChangelog(tx, actor, message, hd_changelog_what.EVENT, event.id, hd_changelog_action.INSERT, null, snapshot);
        await logOtherSides(tx, actor, { id: event.id, name: event.name }, true, otherEventChanges);

        return event;
    });
}

/**
 * Updates an event's own fields and/or its tag/person/related-event relations, and records the
 * whole thing as a single change in the changelog.
 */
export async function updateEvent(actor: Actor, message: string, id: number, data: EventUpdateInput): Promise<hd_event> {
    const { tagIds, personIds, relatedEventIds, ...eventFields } = data;

    return prisma().$transaction(async (tx) => {
        // Get state beforehand
        const before = await tx.hd_event.findUniqueOrThrow({ where: { id } });
        if (before.soft_deleted) throw new Error(`Cannot update soft-deleted hd_event ${id}`);
        if (eventFields.name !== undefined) await assertEventNameFree(tx, eventFields.name, id);
        const beforeSnapshot = await buildEventSnapshot(tx, id);

        // Date fields are only meaningful together, so validate the merged (existing + patched) result whenever any of them change
        const dateKeys = ["event_date_type", "event_date1", "event_date_units", "event_date_diff", "event_date2"] as const;
        if (dateKeys.some((key) => key in eventFields)) {
            validateEventDates({
                event_date_type: eventFields.event_date_type ?? before.event_date_type,
                event_date1: eventFields.event_date1 ?? before.event_date1,
                event_date_units: "event_date_units" in eventFields ? eventFields.event_date_units ?? null : before.event_date_units,
                event_date_diff: "event_date_diff" in eventFields ? eventFields.event_date_diff ?? null : before.event_date_diff,
                event_date2: "event_date2" in eventFields ? eventFields.event_date2 ?? null : before.event_date2
            });
        }
    
        // Update event row (if required)
        if (Object.keys(eventFields).length > 0) {
            await tx.hd_event.update({ where: { id }, data: eventFields });
        }

        // Update relations
        const otherEventChanges = await applyRelationChanges(tx, id, { tagIds, personIds, relatedEventIds }, false);

        // Save to changelog
        const after = await tx.hd_event.findUniqueOrThrow({ where: { id } });
        const afterSnapshot = await buildEventSnapshot(tx, id);
        await writeChangelog(tx, actor, message, hd_changelog_what.EVENT, id, hd_changelog_action.UPDATE, beforeSnapshot, afterSnapshot);
        await logOtherSides(tx, actor, { id, name: after.name }, false, otherEventChanges);

        return after;
    });
}

/**
 * Soft-deletes an event and records the deletion in the changelog. Does not touch its relations.
 * Rejects already soft-deleted events.
 */
export async function deleteEvent(actor: Actor, message: string, id: number): Promise<void> {
    // TODO: Log relations?
    await prisma().$transaction(async (tx) => {
        // Get state beforehand
        const before = await tx.hd_event.findUniqueOrThrow({ where: { id } });
        if (before.soft_deleted) throw new Error(`Cannot delete already soft-deleted hd_event ${id}`);
        const beforeSnapshot = await buildEventSnapshot(tx, id);

        // (Soft) delete event row
        await tx.hd_event.update({ where: { id }, data: { soft_deleted: true } });

        // Save to changelog
        const afterSnapshot = await buildEventSnapshot(tx, id);
        await writeChangelog(tx, actor, message, hd_changelog_what.EVENT, id, hd_changelog_action.DELETE, beforeSnapshot, afterSnapshot);
    });
}
