import { ReactNode } from "react";

/**
 * Colour treatment for an area's (e.g. Panel, HisDoc) logo/title link in its section navbar.
 * Only handles colour — the contents don't need to worry about it. Any decorative child that
 * should match (e.g. a flourish) should use `currentColor` (e.g. `bg-[currentColor]`) rather than
 * a hardcoded colour, since `color` is inherited down to descendants automatically.
 *
 * @param className - Extra classes merged onto the coloured element, e.g. `"underline"` — put it
 *                     here rather than on an ancestor so the underline is drawn using (and hover-
 *                     darkens with) this component's colour.
 */
export default function AreaIndicator({ children, className = "" }: { children: ReactNode, className?: string }) {
    return (
        <span className={`text-white hover:text-gray-400 ${className}`}>
            {children}
        </span>
    );
}
