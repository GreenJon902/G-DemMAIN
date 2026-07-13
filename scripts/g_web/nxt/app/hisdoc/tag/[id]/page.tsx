import "server-only";
import prisma from "@g/com/lib/prisma/client";
import { notFound } from "next/navigation";
import { hd_person_type } from "@g/com/prisma/enums";
import PageSection from "../../../ui/PageSection";
import SplitPage from "../../ui/SplitPage";
import StatsPill from "../../ui/StatsPill";
import SmallEvent from "../../ui/SmallEvent";
import { BarGraph } from "../../ui/BarGraph";
import { EVENT_SELECT } from "../../lib/eventSelect";
import { getMinecraftUsername } from "../../lib/minecraft";

const PLAYER_BAR_COLOR = "#818cf8"; // indigo-400, matching the app's link colour

/** Detail page for a single HisDoc tag: description, its recent events, and a bar chart of the players involved in those events. */
export default async function TagPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) notFound();

    const tag = await prisma().hd_tag.findUnique({
        where: { id, soft_deleted: false },
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
    });

    if (!tag) notFound();

    // >>> 0 coerces color to unsigned 32-bit so negative signed integers produce a valid hex string
    const hexColor = "#" + (tag.color >>> 0).toString(16).padStart(6, "0");

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

    return (
        <SplitPage
            title={tag.name}
            icon={<span className="inline-block size-5 rounded-sm" style={{ backgroundColor: hexColor }} />}
            main={
                <>
                    {tag.description && <p className="text-gray-400">{tag.description}</p>}

                    <PageSection pretitle={"• "} title="Recent Events">
                        {recentEvents.length > 0 ? (
                            <ul>
                                {recentEvents.map(event => <SmallEvent key={event.id} {...event} />)}
                            </ul>
                        ) : (
                            <p className="text-gray-400">No events</p>
                        )}
                    </PageSection>

                    <PageSection pretitle={"• "} title="Player Distribution">
                        <BarGraph bars={bars} graphClassName="h-48" />
                    </PageSection>
                </>
            }
            sidebar={
                <StatsPill>
                    <span>TID: {tag.id}</span>
                    <span>Event Count: {tag.hd_event_tag.length}</span>
                </StatsPill>
            }
        />
    );
}
