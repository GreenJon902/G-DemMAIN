import "server-only";
import type { Metadata } from "next";
import prisma from "@g/com/lib/prisma/client";
import { requirePermission } from "@/lib/session";
import { notFound } from "next/navigation";
import TextLink, { TEXT_LINK_GRAY } from "../../../../ui/TextLink";
import TagForm from "../../../form/ui/TagForm";
import { editTag } from "../../../form/actions";

/** Sets the page title to "Edit <tag name>". */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) return {};
    const tag = await prisma().hd_tag.findUnique({ where: { id }, select: { name: true } });
    return { title: tag ? `Edit ${tag.name}` : "Edit Tag" };
}

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
        return await editTag(id, formData);
    }

    return (
        <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
            <TextLink href={"/hisdoc/tag/" + id} color={TEXT_LINK_GRAY} className="self-start">
                Return to tag...
            </TextLink>
            <h1 className="text-3xl font-bold text-white">Edit Tag</h1>
            <TagForm action={handleEdit} submitLabel="Save Changes" isEdit defaults={tag} />
        </main>
    );
}
