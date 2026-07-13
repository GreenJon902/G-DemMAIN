import Link from "next/link";


/**
 * A pill-shaped chip filled with a background color, with a hole punched near the left edge and
 * the tag name. The punch sits the same distance from the left edge as from the top and bottom,
 * so it reads as a hole through the pill rather than an off-centre dot. Hovering reveals
 * `description` as a tooltip. Clicking runs `onClick` if given, otherwise the chip links to the
 * tag's page.
 *
 * @param id - The tag's id, used to build the link target when `onClick` is not given.
 * @param name - The tag's display name.
 * @param description - Extra text shown on hover.
 * @param bgColor - Tailwind background class for the chip, e.g. "bg-green-600". Exactly one of
 *                  `bgColor`/`bgColorCSS` must be given.
 * @param bgColorCSS - CSS color for the chip's background, e.g. "#3366ff". Use this for colors
 *                      that come from the database rather than a fixed Tailwind palette.
 * @param holeColor - Tailwind background class for the punched circle. Exactly one of
 *                     `holeColor`/`holeColorCSS` must be given.
 * @param holeColorCSS - CSS color for the punched circle. Pass the colour of whatever surface the
 *                        chip sits on (e.g. "#111827" on the plain page, "#1f2937" inside a card)
 *                        so the punch reads correctly regardless of background.
 * @param onClick - Optional click handler. When given, the chip renders as a button instead of a link.
 */
export function TagChip({ id, name, description, bgColor, bgColorCSS, holeColor, holeColorCSS, onClick }: {
    id: string | number;
    name: string;
    description: string;
    bgColor?: string;
    bgColorCSS?: string;
    holeColor?: string;
    holeColorCSS?: string;
    onClick?: () => void;
}) {
    if ((bgColor === undefined) === (bgColorCSS === undefined)) {
        throw new Error("TagChip: exactly one of bgColor or bgColorCSS must be given");
    }
    if ((holeColor === undefined) === (holeColorCSS === undefined)) {
        throw new Error("TagChip: exactly one of holeColor or holeColorCSS must be given");
    }

    // z-0 gives the chip its own stacking context so its z-10 tooltip (below) is scoped to it, and
    // hover:z-20 raises that whole context above sibling chips so the tooltip isn't painted under them
    const className = `group relative z-0 inline-flex h-6 flex-row flex-nowrap items-center gap-2 rounded-full pl-1.5 pr-3 text-sm text-white whitespace-nowrap cursor-pointer hover:z-20 hover:brightness-75 ${bgColor ?? ""}`;

    const content = (
        <>
            <div className={`size-4 shrink-0 rounded-full ${holeColor ?? ""}`} style={holeColorCSS ? { backgroundColor: holeColorCSS } : undefined} />
            <span className={onClick ? "" : "underline decoration-dotted group-hover:decoration-solid"}>{name}</span>
            {description && (
                <span className="pointer-events-none absolute top-full right-0 left-0 z-10 mt-1 rounded-md bg-gray-950 px-2 py-1 text-xs text-wrap text-white opacity-0 group-hover:opacity-100 group-hover:delay-300">
                    {description}
                </span>
            )}
        </>
    );

    if (onClick) {
        return (
            <button type="button" onClick={onClick} className={className} style={bgColorCSS ? { backgroundColor: bgColorCSS } : undefined}>
                {content}
            </button>
        );
    }

    return (
        <Link href={"/hisdoc/tag/" + id} className={className} style={bgColorCSS ? { backgroundColor: bgColorCSS } : undefined}>
            {content}
        </Link>
    );
}
