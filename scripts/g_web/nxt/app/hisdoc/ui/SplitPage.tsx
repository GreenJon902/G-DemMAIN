import { ReactNode } from "react";
import PageSection from "../../ui/PageSection";

/** Default no-op passthrough for sidebarBUnfoldedWrapper — a stable reference so it doesn't get
 * remounted every render (a default value defined inline in the destructuring below would be a
 * fresh function, and thus a "different" component, on every render). */
function PassthroughWrapper({ children }: { children: ReactNode }) {
    return children;
}

/**
 * Two-column profile-style page layout: a flex-1 main column on the left and a shrink-to-fit
 * sidebar column on the right. Wraps everything in a top-level PageSection for `title`/`icon`.
 * Used by the person, tag, event and changelog-entry pages.
 *
 * Below the `lg` breakpoint the columns stack. `sidebarA` folds above main (the usual case —
 * pills, actions, etc.) while `sidebarB` folds below it instead, separated from main's own content
 * by a gap; at `lg` both sit in the same sidebar column, stacked in that order (A above B), with
 * `sidebarB` passed through `sidebarBUnfoldedWrapper` there (defaults to a no-op passthrough) so a
 * caller can match it to sidebarA's pills, e.g. by passing StatsPill itself. `sidebarB` is rendered
 * twice (once per breakpoint, the other hidden via CSS) since a single fixed DOM position can't
 * satisfy both placements.
 *
 * @param main - The left column's content (typically nested PageSections).
 * @param mainClassName - The extra className to apply to main.
 * @param sidebarA - The right column's content that folds above main (typically one or more pills, e.g. StatsPill).
 * @param sidebarB - Optional right column's content that folds below main instead of above it.
 * @param sidebarBUnfoldedWrapper - Component wrapping `sidebarB` for its non-folded (next to main) placement only, e.g. StatsPill; defaults to a passthrough.
 * @param title - The plain-text title. Exactly one of `title`/`titleNode` must be given.
 * @param titleNode - Richer title content (e.g. containing a link), rendered instead of plain text. Exactly one of `title`/`titleNode` must be given.
 */
export default function SplitPage({
    title, icon, main, sidebarA, sidebarB, sidebarBUnfoldedWrapper = PassthroughWrapper, titleNode, mainClassName=""
}: {
    title?: string, icon?: ReactNode, main: ReactNode, sidebarA: ReactNode, sidebarB?: ReactNode,
    sidebarBUnfoldedWrapper?: (props: { children: ReactNode }) => ReactNode, titleNode?: ReactNode, mainClassName?: string
}) {
    const SidebarBUnfoldedWrapper = sidebarBUnfoldedWrapper;
    return (
        <PageSection title={title} titleNode={titleNode} icon={icon}>
            <div className="flex flex-col-reverse gap-2 lg:flex-row lg:gap-8">
                <div className={`flex flex-1 flex-col ${mainClassName}`}>
                    {main}
                    {sidebarB && <div className="mt-2 lg:hidden">{sidebarB}</div>}
                </div>
                <div className="flex h-fit w-fit shrink-0 flex-row gap-2 lg:w-fit lg:flex-col">
                    {sidebarA}
                    {sidebarB && <div className="hidden lg:block"><SidebarBUnfoldedWrapper>{sidebarB}</SidebarBUnfoldedWrapper></div>}
                </div>
            </div>
        </PageSection>
    );
}
