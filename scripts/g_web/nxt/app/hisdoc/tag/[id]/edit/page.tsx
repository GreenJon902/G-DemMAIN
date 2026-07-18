import "server-only";
import prisma from "@g/com/lib/prisma/client";
import { requirePermission } from "@/lib/session";
import { notFound } from "next/navigation";
import EntityForm from "../../../form/ui/EntityForm";
import { buildTagFormFields } from "../../../form/lib/formFields";
import { editTag } from "../../../actions";

/**
 * Page for editing an existing HisDoc tag. Requires hisdoc admin access.
 * Calls notFound() if the id is not a valid integer or the tag does not exist.
 *
 * @param params - Next.js 15 route params Promise; contains `id` as a decimal string.
 */
export default async function EditTagPage({ params }: { params: Promise<{ id: string }> }) {
    await requirePermission("hisdoc", "admin");

    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) notFound();

    const tag = await prisma().hd_tag.findUnique({ where: { id, soft_deleted: false } });
    if (!tag) notFound();

    // Thin server action wrapper that binds the tag id for editTag
    async function handleEdit(formData: FormData) {
        "use server";
        await editTag(id, formData);
    }

    return (
        <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
            <h1 className="text-3xl font-bold text-white">Edit Tag</h1>
            <EntityForm
                fields={buildTagFormFields(tag)}
                action={handleEdit}
                submitLabel="Save Changes"
                minLevel="admin"
                isEdit
            />
        </main>
    );
}
