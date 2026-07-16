import { ReactNode } from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";

/** An amber callout for a page-level warning (e.g. hd_event.details, soft-deleted/missing entity notices). */
export default function WarningBanner({ children }: { children: ReactNode }) {
    return (
        <p className="my-2 flex items-center gap-2 border border-amber-600 bg-amber-100 pl-1 whitespace-pre-wrap text-amber-900">
            <ExclamationTriangleIcon className="size-5 shrink-0 text-amber-700" />
            {children}
        </p>
    );
}
