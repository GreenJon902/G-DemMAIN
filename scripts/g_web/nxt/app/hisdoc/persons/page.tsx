import "server-only";
import prisma from "@g/com/lib/prisma";
import Link from "next/link";
import { getMinecraftUsername } from "../lib/minecraft";

/** Lists all persons ordered by their data field, with display names resolved in parallel. */
export default async function PersonsPage() {
    const persons = await prisma().hisdoc_person.findMany({ orderBy: { data: "asc" } });

    // Resolve all display names concurrently rather than sequentially
    const displayNames = await Promise.all(
        persons.map(p =>
            p.type === "MINECRAFT" ? getMinecraftUsername(p.data) : Promise.resolve(p.data)
        )
    );

    return (
        <>
            <h1 className="mb-4 text-2xl font-bold text-white">Persons</h1>
            <ul className="space-y-2">
                {persons.map((person, i) => (
                    <li key={person.id}>
                        <Link
                            href={"/hisdoc/person/" + person.id}
                            className="text-indigo-400 hover:text-indigo-300"
                        >
                            {displayNames[i]}
                        </Link>
                        <span className="ml-2 text-gray-400">
                            {person.type === "MINECRAFT" ? "(Minecraft)" : "(NPC)"}
                        </span>
                    </li>
                ))}
            </ul>
        </>
    );
}
