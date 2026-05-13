import Image, { StaticImageData } from "next/image";
import { ComponentProps, ReactNode } from "react";

/**
 * The standard structure of an error page.
 * This contains the full html fill. So html and body tags too.
 */
export default function AbstractErrorPage({
    ...props
}: Omit<ComponentProps<typeof AbstractErrorPageWrapper>, "children"> & ComponentProps<typeof AbstractErrorPageContent>) {
    return (
        <AbstractErrorPageWrapper {...props}>
            <AbstractErrorPageContent {...props} />
        </AbstractErrorPageWrapper>
    );
}


/**
 * The wrapper of the error page (html and body tags).
 */
export function AbstractErrorPageWrapper({
    children
}: {
    children: ReactNode
}) {
    return (
        <html>
            <body style={{
                // Draw missing-missing texture pattern in bg
                backgroundImage: "repeating-conic-gradient(black 0 25%, #ff00f6 0 50%)",
                backgroundSize: "3rem 3rem",
                backgroundColor: "black"  // Set the background color so that on devices with safe-zones, you don't see white
            }} className="flex h-dvh items-center justify-center">

                {children}

            </body>
        </html>
    );
}

/**
 * The contents of the error page.
 * @param code - The error code.
 * @param text - The description of the error.
 * @param head - The name of the player-head to display.
 */
export function AbstractErrorPageContent({
    code, text, head
}: {
    code: string,
    text: string,
    head: StaticImageData
}) {
    return (
        <div 
            className="flex h-min w-min flex-col items-center space-y-1 rounded-md bg-gray-800 p-2 shadow-[0_0_10rem_8rem_rgba(0,0,0,0.7)]"
        >
            <Image 
                src={head}
                alt="PLayerhead"
                loading="eager"
                className="relative h-24 w-full rounded-t-xl" 
            /> { /* This image is intentionally stretched. It helps fill the space, and it looks even more goofy */ }
            <span className="flex items-center text-nowrap text-gray-200"> 
                <span className="mr-2 border-r-2 border-r-gray-700 pr-2 text-4xl font-bold">
                    {code}
                </span>
                {text}
            </span>
        </div>
    );
}
