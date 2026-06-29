import "server-only";
import prisma from "@g/com/lib/prisma";
import { notFound } from "next/navigation";
import { PersonAvatar } from "../../ui/PersonAvatar";
import { TimelineItem } from "../../ui/TimelineItem";
import { BarGraph } from "../../ui/BarGraph";
import { getMinecraftUsername } from "../../lib/minecraft";


/**
 * Profile page for a single HisDoc person (Minecraft player or NPC). Shows the person's
 * avatar, display name, type badge, linked account if present, the timeline of events they
 * were involved in, and a bar chart of tag frequency across those events.
 *
 * @param params - Next.js 15 route params Promise; contains `id` as a decimal string.
 */
export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) notFound();

    const person = await prisma().hisdoc_person.findUnique({
        where: { id },
        include: {
            involved_in_events: {
                include: {
                    event: {
                        select: {
                            id: true,
                            name: true,
                            description: true,
                            event_date_type: true,
                            event_date1: true,
                            event_date_time_offset: true,
                            event_date_units: true,
                            event_date_diff: true,
                            event_date2: true,
                            tags: {
                                include: {
                                    tag: { select: { id: true, name: true, color: true } }
                                }
                            }
                        }
                    }
                },
                orderBy: { event: { sort_key: "desc" } }
            },
            linked_user: { select: { username: true } }
        }
    });

    if (!person) notFound();

    const displayName = person.type === "MINECRAFT"
        ? await getMinecraftUsername(person.data)
        : person.data;

    // Tally how many of this person's events share each tag
    const tagCounts = new Map<number, { name: string; color: number; count: number }>();
    for (const { event } of person.involved_in_events) {
        for (const { tag } of event.tags) {
            const existing = tagCounts.get(tag.id);
            if (existing) {
                existing.count++;
            } else {
                tagCounts.set(tag.id, { name: tag.name, color: tag.color, count: 1 });
            }
        }
    }

    // >>> 0 coerces color to unsigned 32-bit so negative signed integers produce a valid hex string
    const bars = Array.from(tagCounts.values()).map(({ name, color, count }) => ({
        label: name,
        value: count,
        color: "#" + (color >>> 0).toString(16).padStart(6, "0")
    }));

    return (
        <main className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
            <div className="flex flex-col gap-3">
                <div className="flex items-start gap-4">
                    <PersonAvatar />
                    <div className="flex flex-col gap-1">
                        <h1 className="text-3xl font-bold text-white">{displayName}</h1>
                        <span className="self-start rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-300">
                            {person.type}
                        </span>
                    </div>
                </div>
                {person.linked_user && (
                    <p className="text-gray-400">Linked account: {person.linked_user.username}</p>
                )}
            </div>

            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold text-white">Events</h2>
                {person.involved_in_events.length > 0 ? (
                    <div className="flex flex-col gap-3">
                        {person.involved_in_events.map(({ event }) => (
                            <TimelineItem
                                key={event.id}
                                id={event.id}
                                name={event.name}
                                description={event.description}
                                date={event}
                                tags={event.tags.map(({ tag }) => tag)}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-400">No events</p>
                )}
            </section>

            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold text-white">Tag Distribution</h2>
                <BarGraph bars={bars} graphClassName="h-48" />
            </section>
        </main>
    );
}
