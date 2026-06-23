import { ReactNode } from "react";
import RefreshingPageClient from "./_RefreshingPageClient";

export type TimeStamped = { timestamp?: number };  // Ms since the epoch

/**
 * A page who's content comes from a server action and is updated by that server action.
 * This runs on the server. The given component must be explicitly a client component.
 * This appends a note at the end indicating how out of date the data is.
 *     - This indicates both when it was last synced with the data, and - if the data has a timestamp - when the data was generated.
 * The loadNewDataAction can take an optional parameter that can be set using the setParam function. This defaults to undefined.
 * This will re-render if the action, or parameter, or refresh-cate change.
 * @param loadNewDataAction - The function which gets the data that is used for rendering.
 * @param refreshRate - How often to reload the data, in ms.
 * @param component - The component who's data is refreshing. This must be a client component (be marked with "use client").
 */
export default async function RefreshingPage<T extends TimeStamped, U>({
    loadNewDataAction,
    refreshRate,
    Component
}: {
    loadNewDataAction: (param: U | undefined) => Promise<T>,
    refreshRate: number,
    Component: (props: {
        data: T,
        setParam: (param: U) => void 
    }) => ReactNode
}) {
    const initialData = await loadNewDataAction(undefined);  // Load the data on the server initially, so the client recieves the full page
    return (
        <RefreshingPageClient
            initialData={initialData}
            loadNewDataAction={loadNewDataAction}
            refreshRate={refreshRate}
            Component={Component}
        />
    );
}
