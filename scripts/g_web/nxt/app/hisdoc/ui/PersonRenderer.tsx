"use client";

import { useEffect, useRef } from "react";
import { Render, IdleAnimation } from "skin3d";
import { SKIN_WIDTH, SKIN_HEIGHT } from "./personSizing";
import { getCheckeredTextureDataUri } from "@/lib/checkeredTexture";

// skin3d doesn't expose WebGL's native antialias flag, so render at a multiple of the device's
// actual pixel ratio and let the browser downscale it back to the canvas's CSS size — cheap
// supersampling that smooths the model's edges
const SUPERSAMPLE = 2;
const SKIN_LOAD_TIMEOUT = 5000; // ms

/**
 * The interactive 3D minecraft skin viewer canvas, shared by {@link LargePerson} (as a tile) and
 * full person profile pages (standalone). Only meaningful for MINECRAFT persons — NPCs have no
 * skin to render.
 * Shows a checkered fallback texture if the skin fails to load.
 *
 * @param playerdata - The person's raw `hd_person.data` value (a minecraft uuid), used to look up the skin texture.
 * @param interactive - Whether the user can manually rotate the model by dragging. Defaults to false (auto-rotates only).
 */
export default function PersonRenderer({
    playerdata,
    interactive = false
}: {
    playerdata: string,
    interactive?: boolean
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        let timeoutId: NodeJS.Timeout;

        try {
            const viewer = new Render({
                canvas: canvasRef.current,
                width: SKIN_WIDTH,
                height: SKIN_HEIGHT,
                pixelRatio: window.devicePixelRatio * SUPERSAMPLE,
                skin: `https://api.mcheads.org/skin/${playerdata}`
            });
            viewer.autoRotate = true;
            viewer.autoRotateSpeed = 0.25;
            viewer.controls.enableRotate = interactive;
            viewer.controls.enableZoom = false;
            viewer.controls.enablePan = false;
            viewer.animation = new IdleAnimation();

            // Load fallback texture if skin fails to load within timeout
            timeoutId = setTimeout(() => {
                viewer.loadSkin(getCheckeredTextureDataUri(64));
            }, SKIN_LOAD_TIMEOUT);

            return () => {
                clearTimeout(timeoutId);
                viewer.dispose();
            };
        } catch (error) {
            // If skin3d initialization fails, we can't render anything
            return () => clearTimeout(timeoutId);
        }
    }, [playerdata, interactive]);

    return (
        // Width/height set directly (rather than left to skin3d's own effect) so the canvas
        // is already the right size on first paint, before skin3d attaches to it
        <canvas ref={canvasRef} width={SKIN_WIDTH} height={SKIN_HEIGHT} style={{ width: SKIN_WIDTH, height: SKIN_HEIGHT }} />
    );
}
