import "server-only";
import { requirePermission } from "@/lib/session";
import EntityForm from "../../form/ui/EntityForm";
import { buildPersonFormFields } from "../../form/lib/formFields";
import { addPerson } from "../../actions";

/** Page for adding a new HisDoc person. Requires hisdoc admin access. */
export default async function AddPersonPage() {
    await requirePermission("hisdoc", "admin");

    return (
        <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
            <h1 className="text-3xl font-bold text-white">Add Person</h1>
            <EntityForm
                fields={buildPersonFormFields(undefined)}
                action={addPerson}
                submitLabel="Add Person"
                minLevel="admin"
            />
        </main>
    );
}
