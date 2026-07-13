import "server-only";
import prisma from "@g/com/lib/prisma/client";
import { TagChip } from "../ui/TagChip";
import PageSection from "../../ui/PageSection";

/** Lists all tags ordered alphabetically. */
export default async function TagsPage() {
    const tags = await prisma().hd_tag.findMany({ where: { soft_deleted: false }, orderBy: { name: "asc" } });

    return (
        <PageSection title="Tags">
            <div className="flex flex-wrap gap-2">
                {tags.map(tag => {
                    // >>> 0 coerces to unsigned 32-bit so negative signed integers produce a valid hex string
                    const hexColor = "#" + (tag.color >>> 0).toString(16).padStart(6, "0");
                    return (
                        <TagChip
                            key={tag.id}
                            id={tag.id}
                            name={tag.name}
                            description={tag.description}
                            bgColorCSS={hexColor}
                            holeColor="bg-gray-900"
                        />
                    );
                })}
            </div>
        </PageSection>
    );
}
