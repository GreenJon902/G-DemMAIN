import { ReactNode } from "react";

/**
 * A section is the highest (below separate pages) group of related controls / information on a page.
 * This component just gives a standardised way of creating them.
 *
 * @param pretitle - Optional text to add before the title, of the same size but without an underline.
 * @param title - The title of the component. This will be set as the ID and key (so should be unique), and will be rendered as a title.
 * @param children - The children to render inside the component.
 */
export default function PageSection({
    title, children, pretitle
}: {
    title: string, children: ReactNode, pretitle?: string
}) {
    return (
        <div id={title}>
            <h1 className="text-3xl font-bold">
                {pretitle && <span> {pretitle} </span>}
                <span className="underline decoration-4"> {title} </span>
            </h1>
            <div className="m-4">
                {children}
            </div>
        </div>
    );


}
