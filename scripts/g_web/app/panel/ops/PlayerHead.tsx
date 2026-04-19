"use client";

import Image from "next/image";
import { Account } from "./page";


/**
 * This will fill to the size of it's parent, so the parent will need relative or absolute-sizing.
 * When clicked, this will open a new tab on the given user's name-mc page.
 *
 * @param account - Either an {@link Account} or a uuid or username as a string.
 * @param onUpdate - A function called whenever the image loads or fails to load. The parameter is true for it loaded and false if it failed to load.
 */
export default function PlayerHead({
    account, 
    onUpdate = (() => {}) 
}: {
    account: Account | string, 
    onUpdate?: (success: boolean) => void 
}) {

    const name = (typeof account === "string") ? account : account.name;
    const uuidOrName = (typeof account === "string") ? account : account.uuid;  // Use an account if we can, otherwise take the uuid

    return (
        <a target="_blank" href={`https://namemc.com/profile/${uuidOrName}`} className="group">  { /* Target blank opens in a new tab */ }
            <Image 
                src={`https://api.mcheads.org/head/${uuidOrName}/64/hat`} 
                alt={`Player head for ${name}`} 
                fill 
                unoptimized
                className="group-hover:brightness-60 group-focus-visible:brightness-60"
                onLoad={() => onUpdate(true) }
                onError={() => onUpdate(false) }
            />
        </a>
    );
}
