import "server-only";
import prisma from "@g/com/lib/prisma/client";
import { getMinecraftUsername } from "../lib/minecraft";
import PageSection from "../../ui/PageSection";
import SmallPerson from "../ui/SmallPerson";
import LargePerson from "../ui/LargePerson";
import { PERSON_GAP } from "../ui/personSizing";

// TODO: replace with a real rule (e.g. a "featured"/"notable" flag on hd_person) once one exists
/** Decides whether a person is prominent enough to render large rather than small. */
function isLargePerson(personId: number): boolean {
    return personId % 9 === 0;
}

/** Lists all persons ordered by their resolved display name, with names resolved in parallel. */
export default async function PersonsPage() {
    const persons = await prisma().hd_person.findMany({ where: { soft_deleted: false } });

    // Resolve all display names concurrently rather than sequentially
    const displayNames = await Promise.all(
        persons.map(p =>
            p.type === "MINECRAFT" ? getMinecraftUsername(p.data) : Promise.resolve(p.data)
        )
    );

    // Names aren't known until resolved above, so sorting has to happen here rather than via the query
    const sorted = persons
        .map((person, i) => ({ person, name: displayNames[i] }))
        .sort((a, b) => a.name.localeCompare(b.name));

    return (
        <PageSection title="Persons">
            <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5" style={{ columnGap: PERSON_GAP }}>
                {sorted.map(({ person, name }) =>
                    // NPCs have no skin to render, so they always render small
                    person.type === "MINECRAFT" && isLargePerson(person.id) ? (
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
