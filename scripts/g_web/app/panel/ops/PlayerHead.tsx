"use client";

import Image from "next/image";
import { Account } from "./page";


/**
 * This will fill to the size of it's parent, so the parent will need relative or absolute-sizing.
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
    if (typeof account !== "string") account = account.uuid;  // If it's an account then use the uuid

    return (
        <Image 
            src={`https://api.mcheads.org/head/${account}/64/hat`} 
            alt={`Player head for ${name}`} 
            fill 
            unoptimized
            onLoad={() => onUpdate(true) }
            onError={() => onUpdate(false) }
        />
    );
}
