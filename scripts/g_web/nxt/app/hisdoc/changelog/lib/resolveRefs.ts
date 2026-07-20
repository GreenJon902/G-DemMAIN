import "server-only";
import prisma from "@g/com/lib/prisma/client";
import { hd_person_type } from "@g/com/prisma/enums";
import { ReferencedIds } from "./collectRefs";

export type ResolvedRefs = {
    users: Map<number, string>;
    tags: Map<number, { name: string; color: number; soft_deleted: boolean }>;
    persons: Map<number, { type: hd_person_type; data: string; soft_deleted: boolean }>;
    events: Map<number, { name: string; soft_deleted: boolean }>;
};

/**
 * Batch-fetches the current (live) row for every id in `ids`, regardless of soft_deleted state —
 * the diff renderer needs to know either way, to distinguish "still exists but soft-deleted" from
 * "row is gone entirely" (see {@link isEntityGone}).
 */
export async function resolveRefs(ids: ReferencedIds): Promise<ResolvedRefs> {
    const [users, tags, persons, events] = await Promise.all([
        ids.userIds.size === 0 ? [] : prisma().user.findMany({
            where: { id: { in: [...ids.userIds] } },
            select: { id: true, username: true }
        }),
        ids.tagIds.size === 0 ? [] : prisma().hd_tag.findMany({
            where: { id: { in: [...ids.tagIds] } },
            select: { id: true, name: true, color: true, soft_deleted: true }
        }),
        ids.personIds.size === 0 ? [] : prisma().hd_person.findMany({
            where: { id: { in: [...ids.personIds] } },
            select: { id: true, type: true, data: true, soft_deleted: true }
        }),
        ids.eventIds.size === 0 ? [] : prisma().hd_event.findMany({
            where: { id: { in: [...ids.eventIds] } },
            select: { id: true, name: true, soft_deleted: true }
        })
    ]);

    return {
        users: new Map(users.map((u) => [u.id, u.username])),
        tags: new Map(tags.map((t) => [t.id, { name: t.name, color: t.color, soft_deleted: t.soft_deleted }])),
        persons: new Map(persons.map((p) => [p.id, { type: p.type, data: p.data, soft_deleted: p.soft_deleted }])),
        events: new Map(events.map((e) => [e.id, { name: e.name, soft_deleted: e.soft_deleted }]))
    };
}

/**
 * True if `id` has no live row in `map` at all. A soft-deleted row still counts as existing here —
 * its page still renders (with its own warning) — see {@link isEntitySoftDeleted} for that case.
 */
export function isEntityGone<T>(id: number, map: Map<number, T>): boolean {
    return !map.has(id);
}

/** True if `id` has a live row in `map` that is soft-deleted. */
export function isEntitySoftDeleted<T extends { soft_deleted: boolean }>(id: number, map: Map<number, T>): boolean {
    return map.get(id)?.soft_deleted === true;
}
