"use client";

import { useEffect, useRef } from "react";
import { useAuthContext } from "@/app/AuthContext";

/**
 * The contents of the error page.
 * @param code - The error code.
 * @param children - The description of the error.
 * @param head - The image of the player head to display.
 * @param reloadOnPermission - When true, reloads the page if the user's logged-in state changes
 *                              (e.g. they log in via another tab), so a stale 401/403 can resolve
 *                              itself instead of staying frozen until a manual refresh.
 */
export default function AbstractErrorPageContent({
    code, head, children, reloadOnPermission = false
}: {
    code: string,
    head: string,
    children: React.ReactNode,
    reloadOnPermission?: boolean
}) {
    const { isLoggedIn } = useAuthContext();
    const isFirstRender = useRef(true);
    useEffect(() => {
        if (!reloadOnPermission) return;
        // Skip the mount — only reload on a subsequent, genuine change
        if (isFirstRender.current) { isFirstRender.current = false; return; }
        window.location.reload();
    }, [isLoggedIn, reloadOnPermission]);

    return (
        <div
            style={{
                // Draw missing-missing texture pattern in bg
                backgroundImage: "repeating-conic-gradient(black 0 25%, #ff00f6 0 50%)",
                backgroundSize: "3rem 3rem",
                backgroundColor: "black"  // Set the background color so that on devices with safe-zones, you don't see white
            }}
            className="flex flex-1 items-center justify-center"
        >
            <div
                className="flex h-min w-min flex-col items-center space-y-1 rounded-md bg-gray-800 p-2 shadow-[0_0_10rem_8rem_rgba(0,0,0,0.7)]"
            >
                <img
                    src={head}
                    alt="PLayerhead"
                    loading="eager"
                    className="relative h-24 w-full rounded-t-xl"
                /> { /* This image is intentionally stretched. It helps fill the space, and it looks even more goofy */ }
                <span className="flex items-center text-nowrap text-gray-200">
                    <span className="mr-2 border-r-2 border-r-gray-700 pr-2 text-4xl font-bold">
                        {code}
                    </span>
                    <div>
                        {children}
                    </div>
                </span>
            </div>
        </div>
    );
}
