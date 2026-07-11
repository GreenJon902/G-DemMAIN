"use client";

import Image from "next/image";


/**
 * This will fill to the size of it's parent, so the parent will need relative or absolute-sizing.
 * When `isLink` is true, clicking opens a new tab on the player's namemc page.
 *
 * @param name - The minecraft account's uuid or name, used to look up the head image and namemc link.
 * @param isLink - Whether the head should link out to the player's namemc page. Defaults to true.
 * @param onUpdate - Called whenever the image loads or fails to load. The parameter is true if it loaded, false if it failed.
 */
export default function PlayerHead({
    name,
    isLink = true,
    onUpdate = (() => {})
}: {
    name: string,
    isLink?: boolean,
    onUpdate?: (success: boolean) => void
}) {
    const image = (
        <Image
            src={`https://api.mcheads.org/head/${name}/64/hat`}
            alt={`Player head for ${name}`}
            fill
            unoptimized
            className={isLink ? "group-hover:brightness-60 group-focus-visible:brightness-60" : undefined}
            onLoad={() => onUpdate(true)}
            onError={() => onUpdate(false)}
        />
    );

    if (!isLink) {
        return <div className="absolute size-full">{image}</div>;
    }

    return (
        // Target blank opens in a new tab
        <a target="_blank" href={`https://namemc.com/profile/${name}`} className="group absolute size-full">
            {image}
        </a>
    );
}
