import "server-only";
import prisma from "@g/com/lib/prisma";
import { requireArea } from "@/lib/session";
import EventForm from "../../ui/EventForm";
import { addEvent } from "../../actions";
import { getMinecraftUsername } from "../../lib/minecraft";

/**
 * Page for adding a new HisDoc event. Requires hisdoc area access.
 * Fetches tags, persons (with resolved display names), and all events
 * in parallel, then renders the EventForm in add mode.
 */
export default async function AddEventPage() {
    await requireArea("hisdoc");

    const [rawTags, rawPersons, rawEvents] = await Promise.all([
        prisma().hisdoc_tag.findMany({
            orderBy: { name: "asc" },
            select: { id: true, name: true, color: true }
        }),
        prisma().hisdoc_person.findMany({
            orderBy: { data: "asc" },
            select: { id: true, type: true, data: true }
        }),
        prisma().hisdoc_event.findMany({
            orderBy: { name: "asc" },
            select: { id: true, name: true }
        })
    ]);

    // Resolve display names — MINECRAFT persons need a UUID→username lookup
    const persons = await Promise.all(
        rawPersons.map(async (p) => ({
            id: p.id,
            type: p.type,
            displayName: p.type === "MINECRAFT"
                ? await getMinecraftUsername(p.data)
                : p.data
        }))
    );

    return (
        <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
            <h1 className="text-3xl font-bold text-white">Add Event</h1>
            <EventForm
                action={addEvent}
                tags={rawTags}
                persons={persons}
                events={rawEvents}
            />
        </main>
    );
}
