import "server-only";
import prisma from "@g/com/lib/prisma/client";
import { hd_changelog_what } from "@g/com/prisma/client";
import { notFound } from "next/navigation";
import { hd_person_type } from "@g/com/prisma/enums";
import PageSection from "../../../ui/PageSection";
import SplitPage from "../../ui/SplitPage";
import StatsPill from "../../ui/StatsPill";
import WarningBanner from "../../ui/WarningBanner";
import SmallEvent from "../../ui/SmallEvent";
import SmallChangelog from "../../ui/SmallChangelog";
import EntityActions from "../../ui/EntityActions";
import { BarGraph } from "../../ui/BarGraph";
import { EVENT_SELECT } from "../../lib/eventSelect";
import { getMinecraftUsername } from "../../lib/minecraft";
import { colorToHex } from "../../lib/color";
import { deleteTag } from "../../actions";

const PLAYER_BAR_COLOR = "#818cf8"; // indigo-400, matching the app's link colour

/** Detail page for a single HisDoc tag: description, its recent events, and a bar chart of the players involved in those events. */
export default async function TagPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) notFound();

    const [tag, changelog] = await Promise.all([
        prisma().hd_tag.findUnique({
            where: { id },
            include: {
                hd_event_tag: {
                    where: { soft_deleted: false, hd_event: { soft_deleted: false } },
                    include: {
                        hd_event: {
                            select: {
                                ...EVENT_SELECT,
                                hd_event_person: {
                                    where: { soft_deleted: false, hd_person: { soft_deleted: false } },
                                    select: {
                                        hd_person: { select: { id: true, type: true, data: true } }
                                    }
                                }
                            }
                        }
                    },
                    orderBy: { hd_event: { sort_key: "desc" } }
                }
            }
        }),
        // hd_changelog is polymorphic (keyed by what/entity_id, no FK), so it can't be included
        // as a direct Prisma relation on hd_tag and must be queried separately
        prisma().hd_changelog.findMany({
            where: { what: hd_changelog_what.TAG, entity_id: id, soft_deleted: false },
            orderBy: { created_at: "desc" },
            include: { user: { select: { username: true } } }
        })
    ]);

    if (!tag) notFound();

    const hexColor = colorToHex(tag.color);

    // Tally how many of this tag's events each (non-soft-deleted) person appears in
    const personCounts = new Map<number, { type: hd_person_type; data: string; count: number }>();
    for (const { hd_event } of tag.hd_event_tag) {
        for (const { hd_person } of hd_event.hd_event_person) {
            const existing = personCounts.get(hd_person.id);
            if (existing) {
                existing.count++;
            } else {
                personCounts.set(hd_person.id, { type: hd_person.type, data: hd_person.data, count: 1 });
            }
        }
    }

    const bars = await Promise.all(
        Array.from(personCounts.values()).map(async ({ type, data, count }) => ({
            label: type === hd_person_type.MINECRAFT ? await getMinecraftUsername(data) : data,
            value: count,
            color: PLAYER_BAR_COLOR
        }))
    );

    const recentEvents = tag.hd_event_tag.map(({ hd_event }) => hd_event).slice(0, 10);

    // Thin server action wrapper that binds the tag id for deleteTag
    async function handleDelete(note: string) {
        "use server";
        return await deleteTag(id, note);
    }

    return (
        <SplitPage
            title={tag.name}
            icon={<span className="inline-block size-5 rounded-sm" style={{ backgroundColor: hexColor }} />}
            mainClassName="gap-4"
            main={
                <>
                    {tag.soft_deleted && <WarningBanner>This tag has been deleted.</WarningBanner>}
                    {tag.description && <p className="text-gray-400">{tag.description}</p>}

                    <PageSection title="Recent Events" sub>
                        {recentEvents.length > 0 ? (
                            <ul>
                                {recentEvents.map(event => <SmallEvent key={event.id} {...event} />)}
                            </ul>
                        ) : (
                            <p className="text-gray-400">No events</p>
                        )}
                    </PageSection>

                    <PageSection title="Player Distribution" sub>
                        <BarGraph bars={bars} graphClassName="h-48" />
                    </PageSection>

                    {changelog.length > 0 && (
                        <PageSection title="Changelog" sub>
                            <ul className="flex flex-col">
                                {changelog.map(entry => (
                                    <SmallChangelog
                                        key={entry.id}
                                        id={entry.id}
                                        username={entry.user?.username ?? null}
                                        created_at={entry.created_at}
                                        message={entry.message}
                                    />
                                ))}
                            </ul>
                        </PageSection>
                    )}
                </>
            }
            sidebar={
                <>
                    {!tag.soft_deleted && (
                        <EntityActions
                            entityLabel="tag"
                            minLevel="admin"
                            editHref={"/hisdoc/tag/" + id + "/edit"}
                            deleteAction={handleDelete}
                        />
                    )}
                    <StatsPill>
                        <span>TID: {tag.id}</span>
                        <span>Event Count: {tag.hd_event_tag.length}</span>
                    </StatsPill>
                </>
            }
        />
    );
}
