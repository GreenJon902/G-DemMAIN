import "server-only";
import prisma from "@g/com/lib/prisma";
import { requireArea } from "@/lib/session";
import { notFound } from "next/navigation";
import EventForm from "../../../ui/EventForm";
import { editEvent } from "../../../actions";
import { getMinecraftUsername } from "../../../lib/minecraft";

/**
 * Page for editing an existing HisDoc event. Requires hisdoc area access.
 * Fetches the event (with its tag, person, and related-event associations),
 * plus the full tag, person, and event lists for the form selectors — all
 * in parallel. Calls notFound() if the id is not a valid integer or the
 * event does not exist. The event itself is excluded from the related-events
 * list so it cannot be linked to itself.
 *
 * @param params - Next.js 15 route params Promise; contains `id` as a decimal string.
 */
export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
    await requireArea("hisdoc");

    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) notFound();

    const [event, rawTags, rawPersons, rawEvents] = await Promise.all([
        prisma().hisdoc_event.findUnique({
            where: { id },
            include: {
                tags: { select: { tag_id: true } },
                persons: { select: { person_id: true } },
                related_events_a: { select: { event_b_id: true } },
                related_events_b: { select: { event_a_id: true } }
            }
        }),
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

    if (!event) notFound();

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

    // Exclude this event from its own related-events selector
    const allEvents = rawEvents.filter(e => e.id !== id);

    const defaultValues = {
        name: event.name,
        description: event.description,
        details: event.details,
        event_date_type: event.event_date_type,
        event_date1: event.event_date1,
        event_date_time_offset: event.event_date_time_offset,
        event_date_units: event.event_date_units,
        event_date_diff: event.event_date_diff,
        event_date2: event.event_date2,
        tag_ids: event.tags.map(t => t.tag_id),
        person_ids: event.persons.map(p => p.person_id),
        // Merge both sides of the self-referential relation into one flat list
        related_event_ids: [
            ...event.related_events_a.map(r => r.event_b_id),
            ...event.related_events_b.map(r => r.event_a_id)
        ]
    };

    // Thin server action wrapper that binds the event id for editEvent
    async function handleEdit(formData: FormData) {
        "use server";
        await editEvent(id, formData);
    }

    return (
        <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
            <h1 className="text-3xl font-bold text-white">Edit Event</h1>
            <EventForm
                action={handleEdit}
                tags={rawTags}
                persons={persons}
                events={allEvents}
                defaultValues={defaultValues}
                isEdit
            />
        </main>
    );
}
