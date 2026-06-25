"use client";

import Image from "next/image";
import { ListItem } from "@gcom/lib/panelUtils";


/**
 * This will fill to the size of it's parent, so the parent will need relative or absolute-sizing.
 * When clicked, this will open a new tab on the given user's name-mc page.
 *
 * @param item - Optional {@link ListItem} who's uniquename should correspond to a minecraft account. Either this or {@param name} should be given, but not both.
 * @param name - Optional name of minecraft player. Either this or {@param item} should be given, but not both.
 * @param onUpdate - A function called whenever the image loads or fails to load. The parameter is true for it loaded and false if it failed to load.
 */
export default function PlayerHead({
    item,
    name,
    onUpdate = (() => {}) 
}: {
    item?: ListItem,
    name?: string,
    onUpdate?: (success: boolean) => void 
}) {
    // Validate inputs
    if (!((item === undefined) !== (name === undefined))) {
        throw "Expected exactly one of item/name to be given";
    }
    // Extract data from whichever input was given
    let uniquename, altname;
    if (item !== undefined) {
        uniquename = item.uniquename;
        altname = item.rendername;
    } else if (name !== undefined) {
        uniquename = name;
        altname = name;
    }

    return (
        <a target="_blank" href={`https://namemc.com/profile/${uniquename}`} className="group absolute size-full">  { /* Target blank opens in a new tab */ }
            <Image 
                src={`https://api.mcheads.org/head/${uniquename}/64/hat`} 
                alt={`Player head for ${altname}`} 
                fill 
                unoptimized
                className="group-hover:brightness-60 group-focus-visible:brightness-60"
                onLoad={() => onUpdate(true) }
                onError={() => onUpdate(false) }
            />
        </a>
    );
}
