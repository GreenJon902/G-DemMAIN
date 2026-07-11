import Link from "next/link";


/**
 * A pill-shaped chip filled with `bgColor`, with a `holeColor` circle punched near the left edge
 * and the tag name. The punch sits the same distance from the left edge as from the top and
 * bottom, so it reads as a hole through the pill rather than an off-centre dot. Hovering reveals
 * `description` as a tooltip. Clicking runs `onClick` if given, otherwise the chip links to the
 * tag's page.
 *
 * @param id - The tag's id, used to build the link target when `onClick` is not given.
 * @param name - The tag's display name.
 * @param description - Extra text shown on hover.
 * @param bgColor - CSS color for the chip's background, e.g. "#3366ff".
 * @param holeColor - CSS color for the punched circle. Pass the colour of whatever surface the
 *                     chip sits on (e.g. "#111827" on the plain page, "#1f2937" inside a card) so
 *                     the punch reads correctly regardless of background.
 * @param onClick - Optional click handler. When given, the chip renders as a button instead of a link.
 */
export function TagChip({ id, name, description, bgColor, holeColor, onClick }: {
    id: string | number;
    name: string;
    description: string;
    bgColor: string;
    holeColor: string;
    onClick?: () => void;
}) {
    const className = "group relative inline-flex h-6 flex-row flex-nowrap items-center gap-2 rounded-full pl-1.5 pr-3 text-sm text-white whitespace-nowrap";

    const content = (
        <>
            <div className="size-4 shrink-0 rounded-full" style={{ backgroundColor: holeColor }} />
            {name}
            {description && (
                <span className="pointer-events-none absolute top-full left-1/2 z-10 mt-1 -translate-x-1/2 rounded-md bg-gray-950 px-2 py-1 text-xs whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100">
                    {description}
                </span>
            )}
        </>
    );

    if (onClick) {
        return (
            <button type="button" onClick={onClick} className={className} style={{ backgroundColor: bgColor }}>
                {content}
            </button>
        );
    }

    return (
        <Link href={"/hisdoc/tag/" + id} className={className} style={{ backgroundColor: bgColor }}>
            {content}
        </Link>
    );
}
