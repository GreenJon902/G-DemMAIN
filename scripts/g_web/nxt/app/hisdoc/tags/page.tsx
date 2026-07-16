import "server-only";
import prisma from "@g/com/lib/prisma/client";
import { TagChip } from "../ui/TagChip";
import PageSection from "../../ui/PageSection";
import { colorToHex } from "../lib/color";

/** Lists all tags ordered alphabetically. */
export default async function TagsPage() {
    const tags = await prisma().hd_tag.findMany({ where: { soft_deleted: false }, orderBy: { name: "asc" } });

    return (
        <PageSection title="Tags">
            <div className="flex flex-wrap gap-2">
                {tags.map(tag => {
                    const hexColor = colorToHex(tag.color);
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
