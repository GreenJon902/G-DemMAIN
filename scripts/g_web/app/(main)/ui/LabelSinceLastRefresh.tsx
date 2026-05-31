"use client";

import { RefObject, useEffect, useState } from "react";

/**
 * A label which indicates the time since the data was last updated.
 * @param timestamp - The timestamp on which the data was generated.
 * @param updateCurrentTimestampRef - A reference to a function which refreshes the current timestamp (this happens automatically too).
 */
export default function LabelSinceLastRefresh({
    timestamp,
    updateCurrentTimestampRef
}: {
    timestamp: number,
    updateCurrentTimestampRef?: RefObject<(() => void) | null>
}) {
    // Keep track of the current timestamp so we can indicate how out of data data is
    const [currentTimestamp, setCurrentTimestamp] = useState(timestamp);  
    const updateCurrentTimestamp = () => setCurrentTimestamp(Date.now());
    if (updateCurrentTimestampRef) updateCurrentTimestampRef.current = updateCurrentTimestamp;
    useEffect(() => {
        const interval = setInterval(async () => {
            updateCurrentTimestamp();
        }, 1000);
        return () => clearInterval(interval);
    });
    
    return (
        <span className="text-gray-600">
            Last updated {Math.floor((currentTimestamp - timestamp) / 1000)} seconds ago
        </span>
    );
}
