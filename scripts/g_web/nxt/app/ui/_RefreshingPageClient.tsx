"use client";

import { useState, useEffect, ReactNode, useRef } from "react";
import { TimeStamped } from "./RefreshingPage";
import LabelSinceLastRefresh from "./LabelSinceLastRefresh";
import { text } from "node:stream/consumers";


/**
 * The client-side code for {@link RefreshingPage}.
 * @param initialData - The initial state of the data.
 * @param loadNewDataAction - The function which gets the data that is used for rendering.
 * @param refreshRate - How often to reload the data, in ms.
 * @param Component - The component who's data is refreshing.
 */
export default function RefreshingPageClient<T extends TimeStamped, U>({
    initialData,
    loadNewDataAction,
    refreshRate,
    Component
}: {
    initialData: T,
    loadNewDataAction: (param: U | undefined) => Promise<T>,
    refreshRate: number,
    Component: (props: {
        data: T,
        setParam: (param: U) => void 
    }) => ReactNode
}) {
    const [param, setParam] = useState<U | undefined>(undefined);
    const isFirstRender = useRef(true);  // Is this the first render

    const updateCurrentTimestampRef = useRef<() => void>(null);
    const [lastSyncTime, setLastSyncTime] = useState(Date.now());

    // Routinely refresh the data from the serveraction
    const [data, setData] = useState(initialData);
    useEffect(() => {
        // Use a timeout for this so we don't get behind if the internet is bad
        let timeout: ReturnType<typeof setTimeout>;
        let cancelled = false;  // If pullData is running when it get's cancelled, then we would clear the wrong timeout id. This handles that case

        const pullData = async () => {
            if (cancelled) return;
            try {
                setData(await loadNewDataAction(param));
                setLastSyncTime(Date.now());
                if (updateCurrentTimestampRef.current !== null) {
                    updateCurrentTimestampRef.current();  // Refresh here too as otherwise data.timestamp will be larger than currentTimestamp
                }
            } catch (e) {
                console.error(e);
            }
            timeout = setTimeout(pullData, refreshRate);
        };
        timeout = setTimeout(pullData, (isFirstRender.current) ? refreshRate : 0);  // If this is the first render then we want to wait the refreshRate. If this isn't the first render then this was called because some property/state changed, in which case data should be refreshed now
        isFirstRender.current = false;

        return () => {
            clearTimeout(timeout);
            cancelled = true;
        };
    }, [refreshRate, loadNewDataAction, param]);

    // Render component and time-indicator(s)
    return (
        <>
            <Component data={data} setParam={setParam} />
            {
                (data.timestamp !== undefined) ?
                    <div className="grid">  {/* grid for stack vertical */}
                        <LabelSinceLastRefresh 
                            timestamp={lastSyncTime}
                            updateCurrentTimestampRef={updateCurrentTimestampRef}
                        />
                        <LabelSinceLastRefresh 
                            timestamp={data.timestamp} 
                            updateCurrentTimestampRef={updateCurrentTimestampRef}
                            text="Data from"
                        />
                    </div>
                :
                    <LabelSinceLastRefresh timestamp={lastSyncTime} />
            }
        </>
    );
}
