import { ReactNode } from "react";
import _RefreshingPageClient from "./_RefreshingPageClient";

export type TimeStamped = { timestamp: number };  // Seconds since the epoch

/**
 * A page who's content comes from a server action and is updated by that server action.
 * This runs on the server. The given component must be explicitly a client component.
 * This appends a note at the end indicating how out of date the data is.
 * @param loadNewDataAction - The function which gets the data that is used for rendering.
 * @param refreshRate - How often to reload the data, in ms.
 * @param component - The component who's data is refreshing. This must be a client component (be marked with "use client").
 */
export default async function RefreshingPage<T extends TimeStamped>({
    loadNewDataAction,
    refreshRate,
    Component
}: {
    loadNewDataAction: () => Promise<T>,
    refreshRate: number,
    Component: (props: { data: T }) => ReactNode
}) {
    const initialData = await loadNewDataAction();  // Load the data on the server initially, so the client recieves the full page
    return (
        <_RefreshingPageClient
            initialData={initialData}
            loadNewDataAction={loadNewDataAction}
            refreshRate={refreshRate}
            Component={Component}
        />
    )
}
