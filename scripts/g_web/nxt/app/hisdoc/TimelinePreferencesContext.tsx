"use client";

import { createContext, useContext, useState, ReactNode } from "react";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // ~1 year

/** Writes a "1"/"0" boolean cookie scoped to the hisdoc timeline. */
function setPreferenceCookie(name: string, value: boolean) {
    // At the time of writing, this is apparently the "right" way to set a cookie... I have very little faith in humanity
    document.cookie = `${name}=${value ? "1" : "0"}; path=/hisdoc; max-age=${COOKIE_MAX_AGE}`;
}

export type TimelinePreferencesContextType = {
    showTags: boolean;
    showPersons: boolean;
    setShowTags: (value: boolean) => void;
    setShowPersons: (value: boolean) => void;
};

const TimelinePreferencesCtx = createContext<TimelinePreferencesContextType | null>(null);

/**
 * Provides the timeline's "Show tags"/"Show persons" display toggles, persisted as cookies
 * (hd_timeline_show_tags/hd_timeline_show_persons) so they survive a fresh visit to /hisdoc
 * rather than resetting each time, the way URL-only state would.
 *
 * @param initialShowTags - Starting value, resolved server-side from the cookie (page.tsx).
 * @param initialShowPersons - Starting value, resolved server-side from the cookie (page.tsx).
 */
export function TimelinePreferencesProvider({
    initialShowTags,
    initialShowPersons,
    children
}: {
    initialShowTags: boolean;
    initialShowPersons: boolean;
    children: ReactNode;
}) {
    const [showTags, setShowTagsState] = useState(initialShowTags);
    const [showPersons, setShowPersonsState] = useState(initialShowPersons);

    const setShowTags = (value: boolean) => {
        setShowTagsState(value);
        setPreferenceCookie("hd_timeline_show_tags", value);
    };
    const setShowPersons = (value: boolean) => {
        setShowPersonsState(value);
        setPreferenceCookie("hd_timeline_show_persons", value);
    };

    return (
        <TimelinePreferencesCtx.Provider value={{ showTags, showPersons, setShowTags, setShowPersons }}>
            {children}
        </TimelinePreferencesCtx.Provider>
    );
}

/** Reads the current timeline display-preference state and setters. Must be used within a TimelinePreferencesProvider. */
export function useTimelinePreferences(): TimelinePreferencesContextType {
    const ctx = useContext(TimelinePreferencesCtx);
    if (ctx === null) throw new Error("useTimelinePreferences must be used within a TimelinePreferencesProvider");
    return ctx;
}
