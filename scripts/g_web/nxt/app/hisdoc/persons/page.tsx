import "server-only";
import prisma from "@g/com/lib/prisma/client";
import { getMinecraftUsername } from "../lib/minecraft";
import PageSection from "../../ui/PageSection";
import SmallPerson from "../ui/SmallPerson";
import LargePerson from "../ui/LargePerson";
import { PERSON_GAP } from "../ui/personSizing";

/** Fraction of minecraft persons, by event count, that are rendered large */
const LARGE_PERSON_FRACTION = 0.1;

/** Lists all persons ordered by their resolved display name, with names resolved in parallel. */
export default async function PersonsPage() {
    const persons = await prisma().hd_person.findMany({
        where: { soft_deleted: false },
        include: {
            _count: {
                // Determine who renders as a large player
                select: {
                    hd_event_person: { where: { soft_deleted: false, hd_event: { soft_deleted: false } } }
                }
            }
        }
    });
    const minecraftPersons = persons.filter(p => p.type === "MINECRAFT");  // Only MC can be LargePerson
    const largePersonIds = new Set(
        minecraftPersons
            // Sort based off who's in more events, any tie is broken by IDs
            .toSorted((a, b) => b._count.hd_event_person - a._count.hd_event_person || a.id - b.id)
            .slice(0, Math.ceil(minecraftPersons.length * LARGE_PERSON_FRACTION))
            .map(p => p.id)
    );

    // Resolve all display names concurrently rather than sequentially
    const resolvedPersons = await Promise.all(
        persons.map(async p => ({ 
            person: p, 
            name: p.type === "MINECRAFT" ? await getMinecraftUsername(p.data) : p.data 
        }))
    );
    resolvedPersons.sort((a, b) => a.name.localeCompare(b.name));  // Sort off display name

    return (
        <PageSection title="Persons">
            <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5" style={{ columnGap: PERSON_GAP }}>
                {resolvedPersons.map(({ person, name }) =>
                    largePersonIds.has(person.id) ? (
                        <div key={person.id} className="break-inside-avoid" style={{ paddingBottom: PERSON_GAP }}>
                            <LargePerson id={person.id} playerdata={person.data} name={name} />
                        </div>
                    ) : (
                        <div key={person.id} className="break-inside-avoid" style={{ paddingBottom: PERSON_GAP }}>
                            <SmallPerson id={person.id} type={person.type} playerdata={person.data} name={name} />
                        </div>
                    )
                )}
            </div>
        </PageSection>
    );
}
