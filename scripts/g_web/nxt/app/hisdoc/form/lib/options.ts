import "server-only";
import prisma from "@g/com/lib/prisma/client";
import { hd_person_type } from "@g/com/prisma/enums";
import { getMinecraftUsername } from "../../lib/minecraft";
import type { TagOption, PersonOption, EventOption } from "./formFields";

/**
 * Fetches the option lists the event form's relation selectors need: all active tags, persons
 * (with resolved display names) and events, each ordered alphabetically. Shared by the event
 * add and edit pages.
 */
export async function fetchEventFormOptions(): Promise<{ tags: Array<TagOption>, persons: Array<PersonOption>, events: Array<EventOption> }> {
    const [tags, rawPersons, events] = await Promise.all([
        prisma().hd_tag.findMany({
            where: { soft_deleted: false },
            orderBy: { name: "asc" },
            select: { id: true, name: true, description: true, color: true }
        }),
        prisma().hd_person.findMany({
            where: { soft_deleted: false },
            orderBy: { data: "asc" },
            select: { id: true, type: true, data: true }
        }),
        prisma().hd_event.findMany({
            where: { soft_deleted: false },
            orderBy: { name: "asc" },
            select: { id: true, name: true }
        })
    ]);

    // Resolve display names — MINECRAFT persons need a UUID→username lookup
    const persons = await Promise.all(
        rawPersons.map(async (p) => ({
            id: p.id,
            type: p.type,
            displayName: p.type === hd_person_type.MINECRAFT
                ? await getMinecraftUsername(p.data)
                : p.data
        }))
    );

    return { tags, persons, events };
}
