import Link from "next/link";
import PlayerHead from "@/app/ui/PlayerHead";
import { hd_person_type } from "@g/com/prisma/enums";
import { SMALL_PERSON_HEIGHT } from "./personSizing";

/**
 * A small inline rendering of a hisdoc person: a playerhead (only for {@link hd_person_type.MINECRAFT}
 * persons) followed by their name. When `isLink` is true, the name links to the person's hisdoc page
 * and the playerhead links to the player's namemc profile; when false, nothing is clickable.
 *
 * @param id - The person's hisdoc id, used to build the `/hisdoc/person/[id]` link.
 * @param type - Whether this is a real minecraft account (playerhead shown) or an NPC (no playerhead).
 * @param playerdata - The person's raw `hd_person.data` value (a minecraft uuid for {@link hd_person_type.MINECRAFT}
 *                      persons). Used to look up the playerhead image — not shown as text.
 * @param name - The resolved display name shown as text.
 * @param isLink - Whether the name should link out. Defaults to true.
 * @param bgColor - CSS color for the pill's background, e.g. "#3366ff". Defaults to gray-700.
 */
export default function SmallPerson({
    id,
    type,
    playerdata,
    name,
    isLink = true,
    bgColor
}: {
    id: number,
    type: hd_person_type,
    playerdata: string,
    name: string,
    isLink?: boolean,
    bgColor?: string
}) {
    const containerClassName = "flex items-center space-x-1 rounded bg-gray-700 px-2 py-1";
    const containerStyle = { 
        height: SMALL_PERSON_HEIGHT, 
        ...(bgColor ? { backgroundColor: bgColor } : {}) 
    };

    const contents = (
        <>
            {type === hd_person_type.MINECRAFT && (
                <div className="relative size-6 shrink-0 overflow-hidden rounded-md">
                    <PlayerHead name={playerdata} isLink={false} />
                </div>
            )}
            <span className="text-sm text-white">{name}</span>
        </>
    );

    return (
        isLink ? 
            <Link className={containerClassName} style={containerStyle} href={`/hisdoc/person/${id}`}>{contents}</Link> : 
            <div className={containerClassName} style={containerStyle}>{contents}</div>
    );
}
