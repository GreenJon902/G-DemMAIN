import "server-only";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/session";
import TextLink, { TEXT_LINK_GRAY } from "../../../ui/TextLink";
import PersonForm from "../../form/ui/PersonForm";
import { addPerson } from "../../form/actions";

export const metadata: Metadata = { title: "Add Person" };

/** Page for adding a new HisDoc person. Requires hisdoc admin access. */
export default async function AddPersonPage() {
    await requirePermission("hisdoc", "admin");

    return (
        <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
            <TextLink href="/hisdoc/persons" color={TEXT_LINK_GRAY} className="self-start">
                Return to persons...
            </TextLink>
            <h1 className="text-3xl font-bold text-white">Add Person</h1>
            <PersonForm action={addPerson} submitLabel="Add Person" />
        </main>
    );
}
