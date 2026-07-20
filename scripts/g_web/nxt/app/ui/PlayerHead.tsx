"use client";

import { useState } from "react";
import Image from "next/image";
import { getCheckeredTextureDataUri } from "@/lib/checkeredTexture";


/**
 * This will fill to the size of it's parent, so the parent will need relative or absolute-sizing.
 * When `isLink` is true, clicking opens a new tab on the player's namemc page.
 * On load failure, shows a black/pink checkered fallback pattern.
 *
 * @param name - The minecraft account's uuid or name, used to look up the head image and namemc link.
 * @param isLink - Whether the head should link out to the player's namemc page. Defaults to true.
 * @param onUpdateAction - Called whenever the image loads or fails to load. The parameter is true if it loaded, false if it failed.
 */
export default function PlayerHead({
    name,
    isLink = true,
    onUpdateAction = (() => {})
}: {
    name: string,
    isLink?: boolean,
    onUpdateAction?: (success: boolean) => void
}) {
    const [failed, setFailed] = useState(false);

    const handleError = () => {
        setFailed(true);
        onUpdateAction(false);
    };

    const image = (
        <Image
            src={`https://api.mcheads.org/head/${name}/64/hat`}
            alt={`Player head for ${name}`}
            fill
            unoptimized
            className={isLink ? "group-hover:brightness-60 group-focus-visible:brightness-60" : undefined}
            onLoad={() => onUpdateAction(true)}
            onError={handleError}
        />
    );

    const fallback = failed && (
        <img
            src={getCheckeredTextureDataUri({ size: 8, superSample: 4 })}
            alt="Fallback checkered pattern"
            className="absolute size-full"
        />
    );

    if (!isLink) {
        return (
            <div className="absolute size-full">
                {image}
                {fallback}
            </div>
        );
    }

    return (
        // Target blank opens in a new tab
        <a target="_blank" href={`https://namemc.com/profile/${name}`} className="group absolute size-full">
            {image}
            {fallback}
        </a>
    );
}
