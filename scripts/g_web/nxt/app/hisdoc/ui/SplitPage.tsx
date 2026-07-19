import { ReactNode } from "react";
import PageSection from "../../ui/PageSection";

/**
 * Two-column profile-style page layout: a flex-1 main column on the left and a shrink-to-fit
 * sidebar column on the right, stacking (sidebar on top) below the `lg` breakpoint. Wraps
 * everything in a top-level PageSection for `title`/`icon`. Used by the person and tag pages.
 *
 * @param main - The left column's content (typically nested PageSections).
 * @param mainClassName - The extra className to apply to main.
 * @param sidebar - The right column's content (typically one or more pills, e.g. StatsPill).
 * @param title - The plain-text title. Exactly one of `title`/`titleNode` must be given.
 * @param titleNode - Richer title content (e.g. containing a link), rendered instead of plain text. Exactly one of `title`/`titleNode` must be given.
 */
export default function SplitPage({
    title, icon, main, sidebar, titleNode, mainClassName=""
}: {
    title?: string, icon?: ReactNode, main: ReactNode, sidebar: ReactNode, titleNode?: ReactNode, mainClassName?: string
}) {
    return (
        <PageSection title={title} titleNode={titleNode} icon={icon}>
            <div className="flex flex-col-reverse gap-2 lg:flex-row lg:gap-8">
                <div className={`flex flex-1 flex-col ${mainClassName}`}>
                    {main}
                </div>
                <div className="flex h-fit w-fit shrink-0 flex-row gap-2 lg:w-fit lg:flex-col">
                    {sidebar}
                </div>
            </div>
        </PageSection>
    );
}
