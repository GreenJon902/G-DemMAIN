import { ReactNode } from "react";

/** A rounded gray-700 pill listing key stats as stacked lines, used in profile page sidebars. */
export default function StatsPill({ children }: { children: ReactNode }) {
    return (
        <div className="flex w-full flex-col text-nowrap rounded bg-gray-700 p-2 text-sm text-gray-400">
            {children}
        </div>
    );
}
