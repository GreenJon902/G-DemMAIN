import { CSSProperties } from "react";

/*
 * Returns the classes and style array for setting the background for this page.
 * This allows layout.tsx to apply it directly to the body, so it fills the entire viewport.
 */
export function getNotFoundBackground(): CSSProperties {
    return {
        // Draw missing-missing texture pattern in bg
        // We use --bg-opacity to fade the background in as it is applied in post. This is set by the bg-opacity-fade-in class
        backgroundImage: 
            "repeating-conic-gradient(" + 
            "rgba(0, 0, 0, var(--bg-opacity, 1)) 0 25%," +   // --bg-opacity falls back on one in the instance that it does not load correctly
            "rgba(255, 0, 246, var(--bg-opacity, 1)) 0 50%)", 
        backgroundSize: "3rem 3rem",
        animation: "2s bgFadeIn forwards",
        backgroundPosition: "absolute"
    };
}

export default function NotFound() {
    return (
        <div className="flex h-dvh items-center justify-center" data-is-not-found>
            <div className="flex h-min w-min flex-col items-center space-y-1 rounded-md bg-gray-800 p-2 shadow-[0_0_10rem_8rem_rgba(0,0,0,0.7)]">
                <img src="https://api.mcheads.org/head/Omegadestroy400/256/hat" className="relative h-24 w-full rounded-t-xl" />  { /* This image is intentionally stretched. It helps fill the space, and it looks even more goofy */ }
                <span className="flex items-center text-nowrap text-gray-200"> 
                    <span className="mr-2 border-r-2 border-r-gray-700 pr-2 text-4xl font-bold">
                        404
                    </span>
                    This page could not be found.
                </span>
            </div>
        </div>
    );
}
