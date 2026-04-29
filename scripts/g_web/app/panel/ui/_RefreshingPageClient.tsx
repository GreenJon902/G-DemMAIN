"use client";

import { useState, useEffect, ReactNode } from "react";
import { TimeStamped } from "./RefreshingPage";


/**
 * The client-side code for {@link RefreshingPage}.
 * @param initialData - The initial state of the data.
 * @param loadNewDataAction - The function which gets the data that is used for rendering.
 * @param refreshRate - How often to reload the data, in ms.
 * @param Component - The component who's data is refreshing.
 */
export default function RefreshingPageClient<T extends TimeStamped>({
    initialData,
    loadNewDataAction,
    refreshRate,
    Component
}: {
    initialData: T,
    loadNewDataAction: () => Promise<T>,
    refreshRate: number,
    Component: (props: { data: T }) => ReactNode
}) {
    // Keep track of the current timestamp so we can indicate how out of data data is
    const [currentTimestamp, setCurrentTimestamp] = useState(initialData.timestamp);  
    useEffect(() => {
        const interval = setInterval(async () => {
            setCurrentTimestamp(Date.now());
        }, 1000);
        return () => clearInterval(interval);
    });

    // Routinely refresh the data from the serveraction
    const [data, setData] = useState(initialData);
    useEffect(() => {
        // Use a timeout for this so we don't get behind if the internet is bad
        let timeout: ReturnType<typeof setTimeout>;
        let cancelled = false;  // If pullData is running when it get's cancelled, then we would clear the wrong timeout id. This handles that case

        const pullData = async () => {
            if (cancelled) return;
            try {
                setData(await loadNewDataAction());
                setCurrentTimestamp(Date.now());  // Refresh here too as otherwise data.timestamp will be larger than currentTimestamp
            } catch (e) {
                console.error(e);
            }
            timeout = setTimeout(pullData, refreshRate);
        };
        timeout = setTimeout(pullData, refreshRate);

        return () => {
            clearTimeout(timeout);
            cancelled = true;
        };
    });

    // Render component and time-indicator
    return (
        <>
            <Component data={data} />
            <span className="text-gray-600">Last updated {Math.floor((currentTimestamp - data.timestamp) / 1000)} seconds ago</span>
        </>
    );
}
