import { ReactNode } from "react";

/**
 * A section is the highest (below separate pages) group of related controls / information on a page.
 * This component just gives a standardised way of creating them.
 *
 * @param pretitle - Optional text to add before the title, of the same size but without an underline.
 * @param icon - Optional element (e.g. a colour swatch) rendered directly before the title text.
 * @param title - The plain-text title. Exactly one of `title`/`titleNode` must be given.
 * @param titleNode - Richer title content (e.g. containing a link), rendered instead of plain text. Exactly one of `title`/`titleNode` must be given.
 * @param children - The children to render inside the component.
 * @param sub - Is this a subtitle? If yes then it's rendered smaller and with no vertical margin.
 */
export default function PageSection({
    title, children, pretitle, icon, titleNode, sub
}: {
    title?: string, children: ReactNode, pretitle?: string, icon?: ReactNode, titleNode?: ReactNode, sub?: boolean
}) {
    if ((title === undefined) === (titleNode === undefined)) {
        throw new Error("PageSection: exactly one of title or titleNode must be given");
    }

    return (
        <div>
            <h1 className={`${sub ? "text-xl" : "text-3xl"} font-bold`}>
                {pretitle && <span> {pretitle} </span>}
                {icon && <span className="mr-2 inline-flex align-middle">{icon}</span>}
                <span className={`underline ${sub ? "decoration-1" : "decoration-4"}`}> {titleNode ?? title} </span>
            </h1>
            <div className={`m-4 mr-0 ${sub ? "my-0" : ""}`}>
                {children}
            </div>
        </div>
    );


}
