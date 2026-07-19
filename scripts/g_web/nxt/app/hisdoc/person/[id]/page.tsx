import "server-only";
import prisma from "@g/com/lib/prisma/client";
import { hd_changelog_what } from "@g/com/prisma/client";
import { notFound } from "next/navigation";
import { hd_person_type } from "@g/com/prisma/enums";
import PageSection from "../../../ui/PageSection";
import SplitPage from "../../ui/SplitPage";
import StatsPill from "../../ui/StatsPill";
import WarningBanner from "../../ui/WarningBanner";
import TextLink, { TEXT_LINK_GRAY } from "../../../ui/TextLink";
import EntityActions from "../../ui/EntityActions";
import PersonRenderer from "../../ui/PersonRenderer";
import SmallEvent from "../../ui/SmallEvent";
import SmallChangelog from "../../ui/SmallChangelog";
import { BarGraph } from "../../ui/BarGraph";
import { EVENT_SELECT } from "../../lib/eventSelect";
import { getMinecraftUsername } from "../../lib/minecraft";
import { colorToHex } from "../../lib/color";
import { deletePerson } from "../../actions";

/**
 * Profile page for a single HisDoc person (Minecraft player or NPC). Shows the person's
 * skin render (Minecraft only), display name, PID, the events they were involved in, the
 * events they posted (if their hisdoc account is linked to a user), and a bar chart of tag
 * frequency across those events.
 *
 * @param params - Next.js 15 route params Promise; contains `id` as a decimal string.
 */
export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) notFound();

    const [person, changelog] = await Promise.all([
        prisma().hd_person.findUnique({
            where: { id },
            include: {
                hd_event_person: {
                    where: { soft_deleted: false, hd_event: { soft_deleted: false } },
                    include: {
                        hd_event: {
                            select: {
                                ...EVENT_SELECT,
                                hd_event_tag: {
                                    where: { soft_deleted: false },
                                    select: {
                                        hd_tag: { select: { id: true, name: true, color: true, soft_deleted: true } }
                                    }
                                }
                            }
                        }
                    },
                    orderBy: { hd_event: { sort_key: "desc" } }
                },
                user: {
                    select: {
                        username: true,
                        hd_event: {
                            where: { soft_deleted: false },
                            select: EVENT_SELECT,
                            orderBy: { sort_key: "desc" }
                        }
                    }
                }
            }
        }),
        // hd_changelog is polymorphic (keyed by what/entity_id, no FK), so it can't be included
        // as a direct Prisma relation on hd_person and must be queried separately
        prisma().hd_changelog.findMany({
            where: { what: hd_changelog_what.PERSON, entity_id: id, soft_deleted: false },
            orderBy: { created_at: "desc" },
            include: { user: { select: { username: true } } }
        })
    ]);

    if (!person) notFound();

    const displayName = person.type === hd_person_type.MINECRAFT
        ? await getMinecraftUsername(person.data)
        : person.data;

    // Tally how many of this person's events share each (non-soft-deleted) tag
    const tagCounts = new Map<number, { name: string; color: number; count: number }>();
    for (const { hd_event } of person.hd_event_person) {
        for (const { hd_tag } of hd_event.hd_event_tag) {
            if (hd_tag.soft_deleted) continue;
            const existing = tagCounts.get(hd_tag.id);
            if (existing) {
                existing.count++;
            } else {
                tagCounts.set(hd_tag.id, { name: hd_tag.name, color: hd_tag.color, count: 1 });
            }
        }
    }

    const bars = Array.from(tagCounts.values()).map(({ name, color, count }) => ({
        label: name,
        value: count,
        color: colorToHex(color)
    }));

    const recentEvents = person.hd_event_person.map(({ hd_event }) => hd_event).slice(0, 10);
    const posts = person.user?.hd_event ?? [];
    const recentPosts = posts.slice(0, 10);

    // Thin server action wrapper that binds the person id for deletePerson
    async function handleDelete(note: string) {
        "use server";
        return await deletePerson(id, note);
    }

    return (
        <SplitPage
            title={displayName}
            main={
                <>
                    {person.soft_deleted && <WarningBanner>This person has been deleted.</WarningBanner>}

                    <PageSection pretitle={"• "} title="Recent Events">
                        {recentEvents.length > 0 ? (
                            <ul>
                                {recentEvents.map(event => <SmallEvent key={event.id} {...event} />)}
                            </ul>
                        ) : (
                            <p className="text-gray-400">No events</p>
                        )}
                    </PageSection>

                    {person.user && (
                        <PageSection pretitle={"• "} title="Recent Posts">
                            {recentPosts.length > 0 ? (
                                <ul>
                                    {recentPosts.map(event => <SmallEvent key={event.id} {...event} />)}
                                </ul>
                            ) : (
                                <p className="text-gray-400">No posts</p>
                            )}
                        </PageSection>
                    )}

                    <PageSection pretitle={"• "} title="Tag Distribution">
                        <BarGraph bars={bars} graphClassName="h-48" />
                    </PageSection>

                    {changelog.length > 0 && (
                        <PageSection pretitle={"• "} title="Changelog">
                            <ul className="flex flex-col gap-4">
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
                    {!person.soft_deleted && (
                        <EntityActions
                            entityLabel="person"
                            minLevel="admin"
                            editHref={"/hisdoc/person/" + id + "/edit"}
                            deleteAction={handleDelete}
                        />
                    )}
                    {person.type === hd_person_type.MINECRAFT && (
                        <div className="flex flex-col items-center rounded bg-gray-700 p-2">
                            <PersonRenderer playerdata={person.data} interactive={true} />
                            <TextLink
                                href={`https://namemc.com/profile/${person.data}`}
                                target="_blank"
                                color={TEXT_LINK_GRAY}
                                className="text-nowrap"
                            >
                                See on NameMC
                            </TextLink>
                        </div>
                    )}
                    <StatsPill>
                        <span>PID: {person.id}</span>
                        {person.type === hd_person_type.MINECRAFT && <span>UUID: {person.data}</span>}
                        <span>Event Count: {person.hd_event_person.length}</span>
                        {person.user && <span>Post Count: {posts.length}</span>}
                    </StatsPill>
                </>
            }
        />
    );
}
