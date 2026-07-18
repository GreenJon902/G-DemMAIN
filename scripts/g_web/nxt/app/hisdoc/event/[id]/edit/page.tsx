import "server-only";
import prisma from "@g/com/lib/prisma/client";
import { requirePermission } from "@/lib/session";
import { notFound } from "next/navigation";
import EntityForm from "../../../form/ui/EntityForm";
import { buildEventFormFields } from "../../../form/lib/formFields";
import { fetchEventFormOptions } from "../../../form/lib/options";
import { editEvent } from "../../../actions";

/**
 * Page for editing an existing HisDoc event. Requires hisdoc editor access.
 * Fetches the event (with its tag, person, and related-event associations) plus the relation
 * selector options in parallel. Calls notFound() if the id is not a valid integer or the event
 * does not exist. The event itself is excluded from the related-events list so it cannot be
 * linked to itself.
 *
 * @param params - Next.js 15 route params Promise; contains `id` as a decimal string.
 */
export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
    await requirePermission("hisdoc", "editor");

    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) notFound();

    const [event, options, relatedRows] = await Promise.all([
        prisma().hd_event.findUnique({
            where: { id, soft_deleted: false },
            include: {
                hd_event_tag: { where: { soft_deleted: false }, select: { tag_id: true } },
                hd_event_person: { where: { soft_deleted: false }, select: { person_id: true } }
            }
        }),
        fetchEventFormOptions(),
        // hd_event_event_rea is a view exposing both directions of the relation; the write table
        // (hd_event_event_wri) must never be read directly outside the gateway
        prisma().hd_event_event_rea.findMany({ where: { event_id: id, soft_deleted: 0 } })
    ]);

    if (!event) notFound();

    // Exclude this event from its own related-events selector
    const events = options.events.filter(e => e.id !== id);
    const activeEventIds = new Set(events.map(e => e.id));

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
        tag_ids: event.hd_event_tag.map(t => t.tag_id),
        person_ids: event.hd_event_person.map(p => p.person_id),
        // The view already exposes both directions, and soft-deleted related events are dropped
        // since they wouldn't appear (and so couldn't be re-selected) in the selector below
        related_event_ids: relatedRows
            .map(r => r.related_event_id)
            .filter(rid => activeEventIds.has(rid))
    };

    // Thin server action wrapper that binds the event id for editEvent
    async function handleEdit(formData: FormData) {
        "use server";
        await editEvent(id, formData);
    }

    return (
        <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
            <h1 className="text-3xl font-bold text-white">Edit Event</h1>
            <EntityForm
                fields={buildEventFormFields(defaults, { ...options, events })}
                action={handleEdit}
                submitLabel="Save Changes"
                minLevel="editor"
                isEdit
            />
        </main>
    );
}
