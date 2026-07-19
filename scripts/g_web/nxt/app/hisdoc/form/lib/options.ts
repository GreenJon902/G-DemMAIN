import "server-only";
import prisma from "@g/com/lib/prisma/client";
import { hd_person_type } from "@g/com/prisma/enums";
import { getMinecraftUsername } from "../../lib/minecraft";
import type { TagOption, PersonOption } from "./optionTypes";

/** Fetches all active tags as selector options for the event form, ordered alphabetically. */
export async function fetchTagOptions(): Promise<Array<TagOption>> {
    return prisma().hd_tag.findMany({
        where: { soft_deleted: false },
        orderBy: { name: "asc" },
        select: { id: true, name: true, description: true, color: true }
    });
}

/**
 * Fetches active persons as selector options with resolved display names (MINECRAFT persons need
 * a UUID→username lookup), ordered by name. Used with `ids` by the event edit page to seed the
 * persons selector with the event's current persons, and without by searchPersons to match
 * against display names — they aren't stored, so there's nothing to search in SQL.
 *
 * @param ids - Restricts the fetch to these person ids; omit for all active persons.
 */
export async function fetchPersonOptions(ids?: Array<number>): Promise<Array<PersonOption>> {
    const rawPersons = await prisma().hd_person.findMany({
        where: { soft_deleted: false, ...(ids !== undefined && { id: { in: ids } }) },
        select: { id: true, type: true, data: true }
    });
    const persons = await Promise.all(
        rawPersons.map(async (p) => ({
            ...p,
            displayName: p.type === hd_person_type.MINECRAFT
                ? await getMinecraftUsername(p.data)
                : p.data
        }))
    );
    return persons.sort((a, b) => a.displayName.localeCompare(b.displayName));
}
