import "server-only";
import { getMinecraftUsername } from "./minecraft";
import { hd_person_type } from "@g/com/prisma/enums";

export type EventPerson = { id: number; type: hd_person_type; data: string; name: string };

/**
 * Resolves display names for one event's hd_event_person relations, dropping any whose person
 * has been soft-deleted. Minecraft uuids are resolved to their current username via
 * getMinecraftUsername (cached); NPC persons use their data field as-is.
 *
 * @param relations - The event's hd_event_person rows, each including its hd_person.
 */
export async function resolveEventPersons(
    relations: { hd_person: { id: number; type: hd_person_type; data: string; soft_deleted: boolean } }[]
): Promise<EventPerson[]> {
    const active = relations.filter(r => !r.hd_person.soft_deleted);
    const names = await Promise.all(
        active.map(r => r.hd_person.type === hd_person_type.MINECRAFT
            ? getMinecraftUsername(r.hd_person.data)
            : Promise.resolve(r.hd_person.data))
    );
    return active.map((r, i) => ({ id: r.hd_person.id, type: r.hd_person.type, data: r.hd_person.data, name: names[i] }));
}
