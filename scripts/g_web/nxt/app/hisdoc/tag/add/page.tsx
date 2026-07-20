import "server-only";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/session";
import TextLink, { TEXT_LINK_GRAY } from "../../../ui/TextLink";
import TagForm from "../../form/ui/TagForm";
import { addTag } from "../../form/actions";

export const metadata: Metadata = { title: "Add Tag" };

/** Page for adding a new HisDoc tag. Requires hisdoc admin access. */
export default async function AddTagPage() {
    await requirePermission("hisdoc", "admin");

    return (
        <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
            <TextLink href="/hisdoc/tags" color={TEXT_LINK_GRAY} className="self-start">
                Return to tags...
            </TextLink>
            <h1 className="text-3xl font-bold text-white">Add Tag</h1>
            <TagForm action={addTag} submitLabel="Add Tag" />
        </main>
    );
}
