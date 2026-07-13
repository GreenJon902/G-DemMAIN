import "server-only";
import prisma from "@g/com/lib/prisma/client";
import { notFound } from "next/navigation";
import { hd_person_type } from "@g/com/prisma/enums";
import PageSection from "../../../ui/PageSection";
import PersonRenderer from "../../ui/PersonRenderer";
import SmallEvent from "../../ui/SmallEvent";
import { BarGraph } from "../../ui/BarGraph";
import { getMinecraftUsername } from "../../lib/minecraft";

const EVENT_SELECT = {
    id: true,
    name: true,
    event_date_type: true,
    event_date1: true,
    event_date_time_offset: true,
    event_date_units: true,
    event_date_diff: true,
    event_date2: true
} as const;

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

    const person = await prisma().hd_person.findUnique({
        where: { id, soft_deleted: false },
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
    });

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

    // >>> 0 coerces color to unsigned 32-bit so negative signed integers produce a valid hex string
    const bars = Array.from(tagCounts.values()).map(({ name, color, count }) => ({
        label: name,
        value: count,
        color: "#" + (color >>> 0).toString(16).padStart(6, "0")
    }));

    const recentEvents = person.hd_event_person.map(({ hd_event }) => hd_event).slice(0, 10);
    const posts = person.user?.hd_event ?? [];
    const recentPosts = posts.slice(0, 10);

    return (
        <>
            <PageSection title={displayName}>
                <div className="flex flex-col-reverse gap-8 lg:flex-row">
                    <div className="flex flex-1 flex-col">
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
                    </div>

                    <div className="flex h-fit w-fit shrink-0 flex-row gap-2 lg:w-fit lg:flex-col">
                        {person.type === hd_person_type.MINECRAFT && (
                            <div className="flex flex-col rounded bg-gray-700 p-2 items-center">
                                <PersonRenderer playerdata={person.data} interactive={true} />
                                <a
                                    href={`https://namemc.com/profile/${person.data}`}
                                    target="_blank"
                                    className="text-nowrap text-indigo-400 hover:text-indigo-300"
                                >
                                    See on NameMC
                                </a>
                            </div>
                        )}
                        <div className="flex w-full flex-col text-nowrap rounded bg-gray-700 p-2 text-sm text-gray-400">
                            <span>PID: {person.id}</span>
                            {person.type === hd_person_type.MINECRAFT && <span>UUID: {person.data}</span>}
                            <span>Event Count: {person.hd_event_person.length}</span>
                            {person.user && <span>Post Count: {posts.length}</span>}
                        </div>
                    </div>
                </div>
            </PageSection>
        </>
    );
}
