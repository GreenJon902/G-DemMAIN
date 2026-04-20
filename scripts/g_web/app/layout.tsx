"use client";

import "@/app/globals.css";
import { useEffect, useState } from "react";
import { getNotFoundBackground } from "./not-found";

export default function Layout({
    children
}: {
    children: React.ReactNode,
}) {
    // If this is the not-found page, then we want to render the missing texture pattern
    // This needs to be done here so it goes above the notch on an iPhone
    // We check if we're on the not found page by looking for any ellement with [data-is-not-found] set
    const [extraClass, setExtraClass] = useState("");   
    const [extraStyle, setExtraStyle] = useState({});   
    useEffect(() => {
        // If we find [data-is-not-found] then replace the background with the not-found background
        if (document.querySelector("[data-is-not-found]")) {
            const bgStyle = getNotFoundBackground();
            setExtraStyle(bgStyle);
        }
    }, []);

    return (
        <html>
            <body className={`bg-gray-900 p-4 text-white ${extraClass}`} style={extraStyle}>
                {children}
            </body>
        </html>
    );
}
