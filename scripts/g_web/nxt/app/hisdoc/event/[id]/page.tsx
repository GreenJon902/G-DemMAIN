import "server-only";
import type { Metadata } from "next";
import prisma from "@g/com/lib/prisma/client";
import { hd_changelog_what } from "@g/com/prisma/client";
import { hd_person_type } from "@g/com/prisma/enums";
import { notFound } from "next/navigation";
import PageSection from "../../../ui/PageSection";
import SplitPage from "../../ui/SplitPage";
import StatsPill from "../../ui/StatsPill";
import WarningBanner from "../../ui/WarningBanner";
import { TagChip } from "../../ui/TagChip";
import LargePerson from "../../ui/LargePerson";
import SmallPerson from "../../ui/SmallPerson";
import SmallEvent from "../../ui/SmallEvent";
import SmallChangelog from "../../ui/SmallChangelog";
import { FlexiDateDisplay } from "../../ui/FlexiDateDisplay";
import EntityActions from "../../ui/EntityActions";
import { EVENT_SELECT } from "../../lib/eventSelect";
import { getMinecraftUsername } from "../../lib/minecraft";
import { colorToHex } from "../../lib/color";
import { deleteEvent } from "../../actions";


/** Sets the page title to the event's name. Adds some OpenGraph data - used for preview where the link is sent. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) return {};
    const event = await prisma().hd_event.findUnique({ where: { id }, select: { name: true, description: true } });
    return {
        title: event?.name ?? "Event", 
        openGraph: {
            title: event?.name,
            description: event?.description.replaceAll(/\s+/g, " ")  // Fix whitespace
        }
    };
}

/**
 * Detail page for a single HisDoc event. Displays the event's date, description, optional
 * details section, associated tags and persons, related events, and the full audit changelog.
 * The Edit button is disabled unless the viewer has hisdoc editor access.
 *
 * @param params - Next.js 15 route params Promise; contains `id` as a decimal string.
 */
export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) notFound();

    const [event, relatedRows, changelog] = await Promise.all([
        prisma().hd_event.findUnique({
            where: { id },
            include: {
                hd_event_tag: { where: { soft_deleted: false }, include: { hd_tag: true } },
                hd_event_person: { where: { soft_deleted: false }, include: { hd_person: true } },
                user: { select: { username: true } }
            }
        }),
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
            person.type === hd_person_type.MINECRAFT
                ? getMinecraftUsername(person.data)
                : Promise.resolve(person.data)
        )
    );

    const relatedEvents = await prisma().hd_event.findMany({
        where: { id: { in: relatedRows.map(r => r.related_event_id) }, soft_deleted: false },
        select: EVENT_SELECT
    });

    // Thin server action wrapper that binds the event id for deleteEvent
    async function handleDelete(note: string) {
        "use server";
        return await deleteEvent(id, note);
    }

    return (
        <SplitPage
            title={event.name}
            mainClassName="gap-4"
            main={
                <>
                    {event.soft_deleted && <WarningBanner>This event has been deleted.</WarningBanner>}
                    {event.details && <WarningBanner>{event.details}</WarningBanner>}

                    <p className="whitespace-pre-wrap text-gray-200">{event.description}</p>



                    {persons.length > 0 && (
                        <div className="flex flex-wrap gap-4">
                            {persons.map((person, i) =>
                                person.type === hd_person_type.MINECRAFT ? (
                                    <LargePerson key={person.id} id={person.id} playerdata={person.data} name={personNames[i]} />
                                ) : (
                                    <SmallPerson key={person.id} id={person.id} type={person.type} playerdata={person.data} name={personNames[i]} />
                                )
                            )}
                        </div>
                    )}

                    {relatedEvents.length > 0 && (
                        <PageSection title="Related Events" sub>
                            <ul>
                                {relatedEvents.map(e => <SmallEvent key={e.id} {...e} />)}
                            </ul>
                        </PageSection>
                    )}

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
            sidebarA={
                <>
                    <div className="flex flex-col gap-2">
                        {tags.length > 0 && (
                            <div className="flex w-full flex-wrap gap-2 lg:w-96">
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
                        )}
                        {!event.soft_deleted && (
                            <EntityActions
                                entityLabel="event"
                                minLevel="editor"
                                editHref={"/hisdoc/event/" + id + "/edit"}
                                deleteAction={handleDelete}
                            />
                        )}
                    </div>
                    <StatsPill>
                        <span>EID: {event.id}</span>
                        <span>Posted by {event.user.username}</span>
                        <FlexiDateDisplay {...event} />
                    </StatsPill>
                </>
            }
        />
    );
}
