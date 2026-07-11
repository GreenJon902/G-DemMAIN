import "server-only";
import prisma from "@g/com/lib/prisma/client";
import { hd_changelog_what } from "@g/com/prisma/client";
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

    const [event, canEdit, relatedRows, changelog] = await Promise.all([
        prisma().hd_event.findUnique({
            where: { id, soft_deleted: false },
            include: {
                hd_event_tag: { where: { soft_deleted: false }, include: { hd_tag: true } },
                hd_event_person: { where: { soft_deleted: false }, include: { hd_person: true } },
                user: { select: { username: true } }
            }
        }),
        NS.optimisticCheckPermission("hisdoc", "editor"),
        // hd_event_event_rea is a view exposing both directions of the relation; the write table
        // (hd_event_event_wri) must never be read directly outside the gateway
        prisma().hd_event_event_rea.findMany({ where: { event_id: id, soft_deleted: 0 } }),
        // hd_changelog is polymorphic (keyed by what/entity_id, no FK), so it can't be included
        // as a direct Prisma relation on hd_event and must be queried separately
        prisma().hd_changelog.findMany({
            where: { what: hd_changelog_what.EVENT, entity_id: id, soft_deleted: false },
            orderBy: { created_at: "desc" },
            include: { user: { select: { username: true } } }
        })
    ]);

    if (!event) notFound();

    // Drop tag/person applications whose tag or person has itself been soft-deleted
    const tags = event.hd_event_tag.filter(({ hd_tag }) => !hd_tag.soft_deleted).map(({ hd_tag }) => hd_tag);
    const persons = event.hd_event_person.filter(({ hd_person }) => !hd_person.soft_deleted).map(({ hd_person }) => hd_person);

    // Resolve all person display names concurrently; MINECRAFT type uses UUID→username lookup
    const personNames = await Promise.all(
        persons.map(person =>
            person.type === "MINECRAFT"
                ? getMinecraftUsername(person.data)
                : Promise.resolve(person.data)
        )
    );

    const relatedEvents = await prisma().hd_event.findMany({
        where: { id: { in: relatedRows.map(r => r.related_event_id) }, soft_deleted: false },
        select: { id: true, name: true }
    });

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
                <p className="text-sm text-gray-400">Posted by {event.user.username}</p>
            </div>

            <p className="whitespace-pre-wrap text-gray-200">{event.description}</p>

            {event.details && (
                <section className="flex flex-col gap-2">
                    <h2 className="text-xl font-semibold text-white">Details</h2>
                    <p className="whitespace-pre-wrap text-gray-200">{event.details}</p>
                </section>
            )}

            {tags.length > 0 && (
                <section className="flex flex-col gap-2">
                    <h2 className="text-xl font-semibold text-white">Tags</h2>
                    <div className="flex flex-wrap gap-2">
                        {tags.map(tag => (
                            <TagChip key={tag.id} id={tag.id} name={tag.name} color={tag.color} />
                        ))}
                    </div>
                </section>
            )}

            {persons.length > 0 && (
                <section className="flex flex-col gap-2">
                    <h2 className="text-xl font-semibold text-white">Persons</h2>
                    <div className="flex flex-wrap gap-4">
                        {persons.map((person, i) => (
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

            {changelog.length > 0 && (
                <section className="flex flex-col gap-3">
                    <h2 className="text-xl font-semibold text-white">Changelog</h2>
                    <ul className="flex flex-col gap-4">
                        {changelog.map(entry => (
                            <li key={entry.id} className="flex flex-col gap-1">
                                <p className="text-sm text-gray-400">
                                    {entry.user?.username ?? "System"} · {entry.created_at.toLocaleDateString()}
                                </p>
                                <p className="whitespace-pre-wrap text-gray-200">{entry.message}</p>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </article>
    );
}
