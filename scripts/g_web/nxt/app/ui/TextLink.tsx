import Link from "next/link";
import { ComponentProps } from "react";

// Since we need to specify tailwind colors in full (including "hover:bg-green-123123"), we will use constants
// This also means colors will be fixed and must hence be consistent
export type TextLinkColor = { text: string, decoration: string, hoverText: string, hoverDecoration: string }
const TextLinkColor = (text: string, decoration: string, hoverText: string, hoverDecoration: string): TextLinkColor => ({ text, decoration, hoverText, hoverDecoration });
export const TEXT_LINK_WHITE: TextLinkColor = TextLinkColor("text-white", "decoration-white", "hover:text-gray-400", "hover:decoration-gray-400");
export const TEXT_LINK_GRAY: TextLinkColor = TextLinkColor("text-gray-300", "decoration-gray-300", "hover:text-white", "hover:decoration-white");

/**
 * A dotted-underline link, less visually heavy than {@link LinkButton}, for places a full button
 * pill would be too obtrusive (e.g. dense lists).
 *
 * @param color - The {@link TextLinkColor}. The underline switches from dotted to solid and
 *                darkens on hover, matching the button hover convention.
 * @param solid - When true, the underline is always solid instead of dotted.
 * @param constantColor - When true, `color` doesn't change on hover — for places that already have
 *                         their own hover effect (e.g. a background highlight) and don't need a second one.
 */
export default function TextLink({ className = "", color, solid = false, constantColor = false, ...props }: Omit<ComponentProps<typeof Link>, "color"> & { color: TextLinkColor, solid?: boolean, constantColor?: boolean }) {
    const colorClassName = constantColor
        ? `${color.text} ${color.decoration}`
        : `${color.text} ${color.decoration} ${color.hoverText} ${color.hoverDecoration}`;
    return (
        <Link
            className={`${className} underline ${solid ? "decoration-solid" : "decoration-dotted hover:decoration-solid"} ${colorClassName}`}
            {...props}
        />
    );
}
