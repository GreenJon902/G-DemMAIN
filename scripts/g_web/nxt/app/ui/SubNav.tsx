import { ReactNode } from "react";
import { Url } from "next/dist/shared/lib/router/router";
import { LinkButton, ButtonColor, BUTTON_INDIGO, BUTTON_CYAN, BUTTON_GREEN, BUTTON_YELLOW, BUTTON_RED } from "./Button";

// Cycled through for each link in this order
const AUTO_LINK_COLORS: ButtonColor[] = [BUTTON_INDIGO, BUTTON_CYAN, BUTTON_GREEN, BUTTON_YELLOW, BUTTON_RED];  // Basically a rainbow

export type SubNavLink = {
    href: Url,
    children: ReactNode,
    disabled?: boolean
};

/**
 * The nav bar shown at the top of a page section (e.g. Panel, HisDoc).
 * Renders `logo` on the left and, `links` (auto-coloured by cycling through
 * {@link AUTO_LINK_COLORS}) on the right.
 *
 * @param logo - The area's logo/title, e.g. a `<Link>` wrapping an {@link AreaIndicator}.
 * @param links - The nav's own links; colours are assigned automatically in order and loop if there
 *                are more links than colours, logging a console error when that happens since it
 *                likely means two links end up sharing a colour unintentionally.
 */
export default function SubNav({ logo, links }: { logo: ReactNode, links: SubNavLink[] }) {
    if (links.length > AUTO_LINK_COLORS.length) {
        console.error(`SubNav: ${links.length} links but only ${AUTO_LINK_COLORS.length} auto colors, colors will repeat`);
    }

    return (
        <header className="flex w-full flex-wrap items-center gap-2 border-t border-t-gray-500 bg-gray-700 p-2">
            {/* We give the text a very large flex so only it scales, however we still give the buttons flex so that they fill the entire width if they go on the newline */}
            <div className="flex w-full flex-nowrap items-center gap-3 sm:flex-100">
                {logo}
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-2 sm:flex-nowrap">
                {links.map((link, i) => (
                    <LinkButton
                        key={link.href.toString()}
                        href={link.href}
                        className="h-min flex-1"
                        color={AUTO_LINK_COLORS[i % AUTO_LINK_COLORS.length]}
                        disabled={link.disabled}
                    >
                        {link.children}
                    </LinkButton>
                ))}
            </div>
        </header>
    );
}
