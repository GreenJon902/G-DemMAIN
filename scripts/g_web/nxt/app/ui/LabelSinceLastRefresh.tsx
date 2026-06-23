"use client";

import { RefObject, useEffect, useState } from "react";

/**
 * A label which indicates the time since the data was last updated.
 * @param timestamp - The timestamp on which the data was generated. In ms.
 * @param updateCurrentTimestampRef - A reference to a function which refreshes the current timestamp (this happens automatically too).
 * @param text - The text to show before the label. so "<text> <seconds> seconds ago"
 */
export default function LabelSinceLastRefresh({
    timestamp,
    updateCurrentTimestampRef,
    text = "Last synced"
}: {
    timestamp: number,
    updateCurrentTimestampRef?: RefObject<(() => void) | null>,
    text?: string
}) {
    // Keep track of the current timestamp so we can indicate how out of data data is
    const [currentTimestamp, setCurrentTimestamp] = useState(timestamp);  
    useEffect(() => {
        const updateCurrentTimestamp = () => setCurrentTimestamp(Date.now());
        if (updateCurrentTimestampRef) updateCurrentTimestampRef.current = updateCurrentTimestamp;


        const interval = setInterval(async () => {
            updateCurrentTimestamp();
        }, 1000);
        return () => clearInterval(interval);
    });
    
    return (
        <span className="text-gray-600">
            {text} {Math.round((currentTimestamp - timestamp) / 1000)} seconds ago
        </span>
    );
}

/**
 * A LabelSinceLastRefresh that takes the start timestamp as the time of creation.
 * This sets the text to "Data from".
 */
export function AutoLabelSinceLastRefresh() {
    const [timestamp] = useState(() => Date.now());
    return <LabelSinceLastRefresh timestamp={timestamp} text="Data from" />;
}
