"use client";

import Link from "next/link";
import PersonRenderer from "./PersonRenderer";
import { LARGE_PERSON_HEIGHT } from "./personSizing";

/**
 * A large rendering of a hisdoc person: an interactive 3D minecraft skin viewer with their name
 * underneath. Unlike {@link SmallPerson}, this is only meaningful for MINECRAFT persons — NPCs
 * have no skin to render. Sized to exactly LARGE_PERSON_HEIGHT (see personSizing.ts) so it packs
 * flush against a run of stacked SmallPerson tiles in a brick-wall layout.
 *
 * @param id - The person's hisdoc id, used to build the `/hisdoc/person/[id]` link.
 * @param playerdata - The person's raw `hd_person.data` value (a minecraft uuid), used to look up the skin texture.
 * @param name - The resolved display name shown underneath the model.
 * @param isLink - Whether the whole tile should link out to the person's hisdoc page. Defaults to true.
 */
export default function LargePerson({
    id,
    playerdata,
    name,
    isLink = true
}: {
    id: number,
    playerdata: string,
    name: string,
    isLink?: boolean
}) {
    const containerClassName = "group flex flex-col items-center gap-1 rounded bg-gray-700 px-2 py-1";
    const containerStyle = { height: LARGE_PERSON_HEIGHT };

    const contents = (
        <>
            <PersonRenderer playerdata={playerdata} interactive={!isLink} />
            <span className={`text-sm text-white ${isLink ? "underline decoration-dotted group-hover:decoration-solid" : ""}`}>{name}</span>
        </>
    );

    return (
        isLink ?
            <Link className={`${containerClassName} hover:brightness-75`} style={containerStyle} href={`/hisdoc/person/${id}`}>{contents}</Link> :
            <div className={containerClassName} style={containerStyle}>{contents}</div>
    );
}
