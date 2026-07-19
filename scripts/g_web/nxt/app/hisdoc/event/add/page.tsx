import "server-only";
import { requirePermission } from "@/lib/session";
import TextLink, { TEXT_LINK_GRAY } from "../../../ui/TextLink";
import EventForm from "../../form/ui/EventForm";
import { fetchTagOptions } from "../../form/lib/options";
import { addEvent } from "../../form/actions";

/**
 * Page for adding a new HisDoc event. Requires hisdoc editor access.
 * Fetches the tag selector options and renders the event form in add mode; persons and related
 * events are searched server-side by their selectors instead of being preloaded.
 */
export default async function AddEventPage() {
    await requirePermission("hisdoc", "editor");
    const tags = await fetchTagOptions();

    return (
        <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
            <TextLink href="/hisdoc" color={TEXT_LINK_GRAY} className="self-start">
                Return to timeline...
            </TextLink>
            <h1 className="text-3xl font-bold text-white">Add Event</h1>
            <EventForm
                action={addEvent}
                submitLabel="Add Event"
                tagOptions={tags}
                defaultPersons={[]}
                defaultRelatedEvents={[]}
            />
        </main>
    );
}
