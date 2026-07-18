import "server-only";
import { requirePermission } from "@/lib/session";
import EntityForm from "../../form/ui/EntityForm";
import { buildTagFormFields } from "../../form/lib/formFields";
import { addTag } from "../../actions";

/** Page for adding a new HisDoc tag. Requires hisdoc admin access. */
export default async function AddTagPage() {
    await requirePermission("hisdoc", "admin");

    return (
        <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
            <h1 className="text-3xl font-bold text-white">Add Tag</h1>
            <EntityForm
                fields={buildTagFormFields(undefined)}
                action={addTag}
                submitLabel="Add Tag"
                minLevel="admin"
            />
        </main>
    );
}
