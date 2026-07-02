/**
 * Shared internals for the hisdoc gateway modules (tag.ts, person.ts, event.ts): writing
 * hd_changelog rows and building the hd_event snapshot shape documented as schema_version 1 in
 * doc/Databases.md.
 */

import type { Prisma, hd_changelog_action, hd_changelog_what } from "../../../generated/prisma/client";

export const CURRENT_SCHEMA_VERSION = 1;  // hd_changelog.schema_version written by every entry below; bump alongside doc/Databases.md if the snapshot shape changes

/** Identifies who triggered a hisdoc change, for attribution in hd_changelog.user_id. */
export type Actor = { userId: number };

// JSON has no BigInt representation, so event_date1/event_date_diff/event_date2 need converting before JSON.stringify
function toChangelogJson(value: unknown): string {
    return JSON.stringify(value, (_key, val) => typeof val === "bigint" ? Number(val) : val);
}

/** Appends one row to hd_changelog inside the given transaction. */
export async function writeChangelog(
    tx: Prisma.TransactionClient,
    actor: Actor,
    message: string,
    what: hd_changelog_what,
    entityId: number,
    action: hd_changelog_action,
    oldValues: unknown,
    newValues: unknown
): Promise<void> {
    await tx.hd_changelog.create({
        data: {
            user_id: actor.userId,
            message,
            what,
            entity_id: entityId,
            old_values: oldValues === null ? null : toChangelogJson(oldValues),
            new_values: newValues === null ? null : toChangelogJson(newValues),
            action,
            schema_version: CURRENT_SCHEMA_VERSION
        }
    });
}

/**
 * Builds the schema_version 1 snapshot of an event for hd_changelog, including its currently
 * active (non-soft-deleted, and whose tag/person/related event is itself not soft-deleted)
 * relations. Returns null if the event does not exist.
 */
export async function buildEventSnapshot(tx: Prisma.TransactionClient, eventId: number) {
    const event = await tx.hd_event.findUnique({
        where: { id: eventId },
        include: {
            hd_event_tag: { where: { soft_deleted: false }, include: { hd_tag: true } },
            hd_event_person: { where: { soft_deleted: false }, include: { hd_person: true } }
        }
    });
    if (event === null) return null;

    // hd_event_event_rea is a view, so MariaDB reports soft_deleted as TINYINT rather than the source
    // BOOLEAN — Prisma types (and returns) it as a number here, not a boolean
    const relatedRows = await tx.hd_event_event_rea.findMany({ where: { event_id: eventId, soft_deleted: 0 } });
    const relatedEvents = await tx.hd_event.findMany({
        where: { id: { in: relatedRows.map((row) => row.related_event_id) }, soft_deleted: false },
        select: { id: true, name: true }
    });

    return {
        id: event.id,
        name: event.name,
        description: event.description,
        details: event.details,
        posted_by_user_id: event.posted_by_user_id,
        posted_at: event.posted_at,
        event_date_type: event.event_date_type,
        event_date1: event.event_date1,
        event_date_time_offset: event.event_date_time_offset,
        event_date_units: event.event_date_units,
        event_date_diff: event.event_date_diff,
        event_date2: event.event_date2,
        soft_deleted: event.soft_deleted,
        tags: event.hd_event_tag
            .filter((rel) => !rel.hd_tag.soft_deleted)
            .map((rel) => ({ id: rel.hd_tag.id, name: rel.hd_tag.name, color: rel.hd_tag.color })),
        persons: event.hd_event_person
            .filter((rel) => !rel.hd_person.soft_deleted)
            .map((rel) => ({ id: rel.hd_person.id, type: rel.hd_person.type, data: rel.hd_person.data })),
        relatedEvents: relatedEvents.map((related) => ({ id: related.id, name: related.name }))
    };
}
