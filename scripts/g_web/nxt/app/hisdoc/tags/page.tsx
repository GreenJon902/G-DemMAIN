import "server-only";
import type { Metadata } from "next";
import prisma from "@g/com/lib/prisma/client";
import { TagChip } from "../ui/TagChip";
import PageSection from "../../ui/PageSection";
import { LinkButton, BUTTON_GREEN } from "@/app/ui/Button";
import { colorToHex } from "../lib/color";

export const metadata: Metadata = { title: "Tags" };

/** Lists all tags ordered alphabetically. */
export default async function TagsPage() {
    const tags = await prisma().hd_tag.findMany({ where: { soft_deleted: false }, orderBy: { name: "asc" } });

    return (
        <PageSection title="Tags">
            <LinkButton
                href="/hisdoc/tag/add"
                color={BUTTON_GREEN}
                className="mb-4 ml-auto w-fit"
                disabled={{ area: "hisdoc", minLevel: "admin" }}
            >
                Add Tag
            </LinkButton>
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
