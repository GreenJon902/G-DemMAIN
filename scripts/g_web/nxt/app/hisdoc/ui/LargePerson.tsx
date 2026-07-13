"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Render, IdleAnimation } from "skin3d";
import { LARGE_PERSON_HEIGHT, SKIN_WIDTH, SKIN_HEIGHT } from "./personSizing";

// skin3d doesn't expose WebGL's native antialias flag, so render at a multiple of the device's
// actual pixel ratio and let the browser downscale it back to the canvas's CSS size — cheap
// supersampling that smooths the model's edges
const SUPERSAMPLE = 2;

/**
 * A large rendering of a hisdoc person: an interactive 3D minecraft skin viewer with their name
 * underneath. Unlike {@link SmallPerson}, this is only meaningful for MINECRAFT persons — NPCs
 * have no skin to render. Sized to exactly LARGE_PERSON_HEIGHT (see personSizing.ts) so it packs
 * flush against a run of stacked SmallPerson tiles in a brick-wall layout.
 *
 * @param id - The person's hisdoc id, used to build the `/hisdoc/person/[id]` link.
 * @param playerdata - The person's raw `hd_person.data` value (a minecraft uuid), used to look up the skin texture.
 * @param name - The resolved display name shown underneath the model.
 * @param isLink - Whether the name should link out to the person's hisdoc page. Defaults to true.
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
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        const viewer = new Render({
            canvas: canvasRef.current,
            width: SKIN_WIDTH,
            height: SKIN_HEIGHT,
            pixelRatio: window.devicePixelRatio * SUPERSAMPLE,
            skin: `https://api.mcheads.org/skin/${playerdata}`
        });
        viewer.autoRotate = true;
        viewer.autoRotateSpeed = 0.25;
        viewer.controls.enableRotate = !isLink;
        viewer.controls.enableZoom = false;
        viewer.controls.enablePan = false;
        viewer.animation = new IdleAnimation();

        return () => viewer.dispose();
    }, [playerdata, isLink]);

    const nameEl = <span className="text-sm text-white">{name}</span>;

    return (
        <div className="flex flex-col items-center gap-1 rounded bg-gray-700 px-2 py-1" style={{ height: LARGE_PERSON_HEIGHT }}>
            {/* Width/height set directly (rather than left to skin3d's own effect) so the canvas
                is already the right size on first paint, before skin3d attaches to it */}
            <canvas ref={canvasRef} width={SKIN_WIDTH} height={SKIN_HEIGHT} style={{ width: SKIN_WIDTH, height: SKIN_HEIGHT }} />
            {isLink ? <Link href={`/hisdoc/person/${id}`}>{nameEl}</Link> : nameEl}
        </div>
    );
}
