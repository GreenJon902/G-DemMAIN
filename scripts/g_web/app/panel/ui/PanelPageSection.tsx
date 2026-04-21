import { ReactNode } from "react";

/**
 * A section is the highest (below separate pages) group of related controls / information in the panel.
 * This component just gives a standardised way of creating them.
 *
 * @param title - The title of the component. This will be set as the ID and key (so should be unique), and will be rendered as a title.
 * @param children - The children to render inside the component.
 */
export default function PanelPageSection({ 
    title, children
}: {
    title: string, children: ReactNode
}) {
    return (
        <div id={title}>
            <h1 className="text-3xl font-bold underline decoration-4">{title}</h1>
            <div className="m-4">
                {children}
            </div>
        </div>
    );


}
