import "server-only";
import prisma from "@g/com/lib/prisma";
import { TagChip } from "../ui/TagChip";

/** Lists all tags ordered alphabetically. */
export default async function TagsPage() {
    const tags = await prisma().hisdoc_tag.findMany({ orderBy: { name: "asc" } });

    return (
        <>
            <h1 className="mb-4 text-2xl font-bold text-white">Tags</h1>
            <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                    <TagChip key={tag.id} id={tag.id} name={tag.name} color={tag.color} />
                ))}
            </div>
        </>
    );
}
