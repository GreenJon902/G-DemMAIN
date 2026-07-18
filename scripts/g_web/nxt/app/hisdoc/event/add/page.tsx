import "server-only";
import { requirePermission } from "@/lib/session";
import EntityForm from "../../form/ui/EntityForm";
import { buildEventFormFields } from "../../form/lib/formFields";
import { fetchEventFormOptions } from "../../form/lib/options";
import { addEvent } from "../../actions";

/**
 * Page for adding a new HisDoc event. Requires hisdoc editor access.
 * Fetches the relation selector options and renders the generic EntityForm in add mode.
 */
export default async function AddEventPage() {
    await requirePermission("hisdoc", "editor");
    const options = await fetchEventFormOptions();

    return (
        <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
            <h1 className="text-3xl font-bold text-white">Add Event</h1>
            <EntityForm
                fields={buildEventFormFields(undefined, options)}
                action={addEvent}
                submitLabel="Add Event"
                minLevel="editor"
            />
        </main>
    );
}
