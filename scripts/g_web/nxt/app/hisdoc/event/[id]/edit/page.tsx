import "server-only";
import type { Metadata } from "next";
import prisma from "@g/com/lib/prisma/client";
import { requirePermission } from "@/lib/session";
import { notFound } from "next/navigation";
import TextLink, { TEXT_LINK_GRAY } from "../../../../ui/TextLink";
import EventForm from "../../../form/ui/EventForm";
import { fetchTagOptions, fetchPersonOptions } from "../../../form/lib/options";
import { editEvent } from "../../../form/actions";

/** Sets the page title to "Edit <event name>". */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) return {};
    const event = await prisma().hd_event.findUnique({ where: { id }, select: { name: true } });
    return { title: event ? `Edit ${event.name}` : "Edit Event" };
}

/**
 * Page for editing an existing HisDoc event. Requires hisdoc editor access.
 * Fetches the event (with its tag, person, and related-event associations) plus the tag selector
 * options in parallel. Calls notFound() if the id is not a valid integer or the event does not
 * exist. The event itself is excluded from the related-events search so it cannot be linked to
 * itself.
 *
 * @param params - Next.js 15 route params Promise; contains `id` as a decimal string.
 */
export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
    await requirePermission("hisdoc", "editor");

    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) notFound();

    const [event, tags, relatedRows] = await Promise.all([
        prisma().hd_event.findUnique({
            where: { id, soft_deleted: false },
            include: {
                hd_event_tag: { where: { soft_deleted: false }, select: { tag_id: true } },
                hd_event_person: { where: { soft_deleted: false }, select: { person_id: true } }
            }
        }),
        fetchTagOptions(),
        // hd_event_event_rea is a view exposing both directions of the relation; the write table
        // (hd_event_event_wri) must never be read directly outside the gateway
        prisma().hd_event_event_rea.findMany({ where: { event_id: id, soft_deleted: 0 } })
    ]);

    if (!event) notFound();

    // Resolve the current persons and related events for the selectors' initial selections.
    // Soft-deleted entries are dropped — they wouldn't be searchable (so couldn't be
    // re-selected), and submitting without them clears the stale relation
    const [persons, relatedEvents] = await Promise.all([
        fetchPersonOptions(event.hd_event_person.map(p => p.person_id)),
        prisma().hd_event.findMany({
            where: { id: { in: relatedRows.map(r => r.related_event_id) }, soft_deleted: false },
            select: { id: true, name: true },
            orderBy: { name: "asc" }
        })
    ]);

    const defaults = {
        name: event.name,
        description: event.description,
        details: event.details,
        flexiDate: {
            event_date_type: event.event_date_type,
            event_date1: event.event_date1,
            event_date_time_offset: event.event_date_time_offset,
            event_date_units: event.event_date_units,
            event_date_diff: event.event_date_diff,
            event_date2: event.event_date2
        },
        tag_ids: event.hd_event_tag.map(t => t.tag_id)
    };

    // Thin server action wrapper that binds the event id for editEvent
    async function handleEdit(formData: FormData) {
        "use server";
        return await editEvent(id, formData);
    }

    return (
        <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
            <TextLink href={"/hisdoc/event/" + id} color={TEXT_LINK_GRAY} className="self-start">
                Return to event...
            </TextLink>
            <h1 className="text-3xl font-bold text-white">Edit Event</h1>
            <EventForm
                action={handleEdit}
                submitLabel="Save Changes"
                isEdit
                defaults={defaults}
                tagOptions={tags}
                defaultPersons={persons}
                defaultRelatedEvents={relatedEvents}
                excludeEventId={id}
            />
        </main>
    );
}
