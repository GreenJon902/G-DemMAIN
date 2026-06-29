import "server-only";
import prisma from "@g/com/lib/prisma";
import { NS } from "@/lib/session";
import { notFound } from "next/navigation";
import Link from "next/link";
import { FlexiDateDisplay } from "../../ui/FlexiDateDisplay";
import { TagChip } from "../../ui/TagChip";
import { PersonAvatar } from "../../ui/PersonAvatar";
import { LinkButton, BUTTON_INDIGO } from "@/app/ui/Button";
import { getMinecraftUsername } from "../../lib/minecraft";


/**
 * Detail page for a single HisDoc event. Displays the event's date, description, optional
 * details section, associated tags and persons, related events, and the full audit changelog.
 * The Edit button is shown only when the viewer has hisdoc access.
 *
 * @param params - Next.js 15 route params Promise; contains `id` as a decimal string.
 */
export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) notFound();

    const [event, canEdit] = await Promise.all([
        prisma().hisdoc_event.findUnique({
            where: { id },
            include: {
                tags: { include: { tag: true } },
                persons: { include: { person: true } },
                related_events_a: { include: { event_b: { select: { id: true, name: true } } } },
                related_events_b: { include: { event_a: { select: { id: true, name: true } } } },
                changelog: {
                    orderBy: { created_at: "desc" },
                    include: { author_user: { select: { username: true } } }
                },
                posted_by_user: { select: { username: true } }
            }
        }),
        NS.optimisticCheckUser("hisdoc")
    ]);

    if (!event) notFound();

    // Resolve all person display names concurrently; MINECRAFT type uses UUID→username lookup
    const personNames = await Promise.all(
        event.persons.map(({ person }) =>
            person.type === "MINECRAFT"
                ? getMinecraftUsername(person.data)
                : Promise.resolve(person.data)
        )
    );

    // Merge both sides of the self-referential relation into one flat list
    const relatedEvents = [
        ...event.related_events_a.map(r => r.event_b),
        ...event.related_events_b.map(r => r.event_a)
    ];

    return (
        <article className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
            <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-4">
                    <h1 className="text-3xl font-bold text-white">{event.name}</h1>
                    {canEdit && (
                        <LinkButton href={"/hisdoc/event/" + id + "/edit"} color={BUTTON_INDIGO}>Edit</LinkButton>
                    )}
                </div>
                <FlexiDateDisplay {...event} />
                {event.posted_by_user && (
                    <p className="text-sm text-gray-400">Posted by {event.posted_by_user.username}</p>
                )}
            </div>

            <p className="whitespace-pre-wrap text-gray-200">{event.description}</p>

            {event.details && (
                <section className="flex flex-col gap-2">
                    <h2 className="text-xl font-semibold text-white">Details</h2>
                    <p className="whitespace-pre-wrap text-gray-200">{event.details}</p>
                </section>
            )}

            {event.tags.length > 0 && (
                <section className="flex flex-col gap-2">
                    <h2 className="text-xl font-semibold text-white">Tags</h2>
                    <div className="flex flex-wrap gap-2">
                        {event.tags.map(({ tag }) => (
                            <TagChip key={tag.id} id={tag.id} name={tag.name} color={tag.color} />
                        ))}
                    </div>
                </section>
            )}

            {event.persons.length > 0 && (
                <section className="flex flex-col gap-2">
                    <h2 className="text-xl font-semibold text-white">Persons</h2>
                    <div className="flex flex-wrap gap-4">
                        {event.persons.map(({ person }, i) => (
                            <Link
                                key={person.id}
                                href={"/hisdoc/person/" + person.id}
                                className="flex flex-col items-center gap-2"
                            >
                                <PersonAvatar />
                                <span className="text-sm text-gray-300">{personNames[i]}</span>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {relatedEvents.length > 0 && (
                <section className="flex flex-col gap-2">
                    <h2 className="text-xl font-semibold text-white">Related Events</h2>
                    <ul className="flex flex-col gap-1">
                        {relatedEvents.map(e => (
                            <li key={e.id}>
                                <Link
                                    href={"/hisdoc/event/" + e.id}
                                    className="text-indigo-400 hover:text-indigo-300"
                                >
                                    {e.name}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {event.changelog.length > 0 && (
                <section className="flex flex-col gap-3">
                    <h2 className="text-xl font-semibold text-white">Changelog</h2>
                    <ul className="flex flex-col gap-4">
                        {event.changelog.map(entry => (
                            <li key={entry.id} className="flex flex-col gap-1">
                                <p className="text-sm text-gray-400">
                                    {entry.author_user.username} · {entry.created_at.toLocaleDateString()}
                                </p>
                                <p className="whitespace-pre-wrap text-gray-200">{entry.description}</p>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </article>
    );
}
