import "server-only";
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
import { LinkButton, BUTTON_INDIGO } from "@/app/ui/Button";
import { EVENT_SELECT } from "../../lib/eventSelect";
import { getMinecraftUsername } from "../../lib/minecraft";
import { colorToHex } from "../../lib/color";


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
    console.log(id, event.hd_event_person);
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

    return (
        <SplitPage
            title={event.name}
            main={
                <>
                    {event.soft_deleted && <WarningBanner>This event has been deleted.</WarningBanner>}
                    {event.details && <WarningBanner>{event.details}</WarningBanner>}

                    <p className="whitespace-pre-wrap text-gray-200">{event.description}</p>

                    {tags.length > 0 && (
                        <PageSection pretitle={"• "} title="Tags">
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
                    )}

                    {persons.length > 0 && (
                        <PageSection pretitle={"• "} title="Persons">
                            <div className="flex flex-wrap gap-4">
                                {persons.map((person, i) =>
                                    person.type === hd_person_type.MINECRAFT ? (
                                        <LargePerson key={person.id} id={person.id} playerdata={person.data} name={personNames[i]} />
                                    ) : (
                                        <SmallPerson key={person.id} id={person.id} type={person.type} playerdata={person.data} name={personNames[i]} />
                                    )
                                )}
                            </div>
                        </PageSection>
                    )}

                    {relatedEvents.length > 0 && (
                        <PageSection pretitle={"• "} title="Related Events">
                            <ul>
                                {relatedEvents.map(e => <SmallEvent key={e.id} {...e} />)}
                            </ul>
                        </PageSection>
                    )}

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
                    <LinkButton href={"/hisdoc/event/" + id + "/edit"} color={BUTTON_INDIGO} disabled={{ area: "hisdoc", minLevel: "editor" }}>Edit</LinkButton>
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
