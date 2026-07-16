import Link from "next/link";
import { SMALL_PERSON_HEIGHT } from "./personSizing";

/**
 * A small inline rendering of a hisdoc event: just a name pill, rendered identically to an NPC
 * {@link SmallPerson} (no playerhead, since events have no skin). When `isLink` is true, the pill
 * links to the event's hisdoc page; when false, nothing is clickable.
 *
 * @param id - The event's hisdoc id, used to build the `/hisdoc/event/[id]` link.
 * @param name - The event's name, shown as the pill text.
 * @param isLink - Whether the pill should link out. Defaults to true.
 * @param bgColor - Tailwind background class for the pill, e.g. "bg-green-600". At most one of
 *                  `bgColor`/`bgColorCSS` may be given; if neither is given, defaults to gray-700.
 * @param bgColorCSS - CSS color for the pill's background, e.g. "#3366ff". Use this for colors
 *                      that come from the database rather than a fixed Tailwind palette.
 */
export default function SmallerEvent({
    id,
    name,
    isLink = true,
    bgColor,
    bgColorCSS
}: {
    id: number,
    name: string,
    isLink?: boolean,
    bgColor?: string,
    bgColorCSS?: string
}) {
    if (bgColor !== undefined && bgColorCSS !== undefined) {
        throw new Error("SmallerEvent: at most one of bgColor or bgColorCSS may be given");
    }

    const containerClassName = `group flex items-center space-x-1 rounded px-2 py-1 ${bgColor ?? (bgColorCSS ? "" : "bg-gray-700")}`;
    const containerStyle = {
        height: SMALL_PERSON_HEIGHT,
        ...(bgColorCSS ? { backgroundColor: bgColorCSS } : {})
    };

    const contents = (
        <span className={`text-sm text-white ${isLink ? "underline decoration-dotted group-hover:decoration-solid" : ""}`}>{name}</span>
    );

    return (
        isLink ?
            <Link className={`${containerClassName} hover:brightness-75`} style={containerStyle} href={`/hisdoc/event/${id}`}>{contents}</Link> :
            <div className={containerClassName} style={containerStyle}>{contents}</div>
    );
}
