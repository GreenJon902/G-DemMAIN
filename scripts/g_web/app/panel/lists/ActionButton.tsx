import { ArrowPathIcon } from "@heroicons/react/20/solid";
import { ReactNode, useTransition } from "react";

/**
 * A button that runs a server action.
 * This shows a loading action icon and is un-clickable while it is running.
 * This is rounded, has a hover and tab-navigation effect.
 *
 * @param content - The normal content to display inside the button.
 * @param action - The server-action to run when the button is pressed.
 * @param confirm - An optional function to call when the button is clicked to confirm that we want to execute the action. This returns true to run the action, and false otherwise.
 * @param normalColor - The background-color of the button.
 * @param effectColor - The background-color of the button when hovered or tab-selected.
 * @param className - Optional extra class names for the button, e.g. size-6.
 */ 
export default function ActionButton({
    children,
    action,
    confirm = () => true,
    normalColor,
    effectColor,
    className = ""
}: {
    children: ReactNode,
    action: () => Promise<void>,
    confirm?: () => boolean,
    normalColor: string,
    effectColor: string,
    className?: string
}) {
    // Function to make change on server 
    const [isPending, startTransition] = useTransition();  // Is pending is true when we've sent the change to the server and are waiting for a response
    const buttonClicked = () => {
        if (confirm()) {
            startTransition(async () => {
                await action();
            });
        }
    };
    
    // Create a button that shows either a the content or the spinner
    return (  // TODO: We can't split the hover: from the actual color, cause now it doesn't work
        <button type="button" onClick={buttonClicked} className={`relative flex cursor-pointer justify-center rounded-md ${normalColor} hover:${effectColor} px-1 text-nowrap outline-none focus-visible:${effectColor} ${className}`} disabled={isPending}>
            { /* Render both at same time so size remains constant, but hide the one we don't need */ }
            <ArrowPathIcon className={`size-6 animate-spin self-stretch stroke-2 text-white ${isPending ? "" : "invisible"} absolute`} />
            <div className={`${isPending ? "invisible" : ""}`}> {children} </div> 
        </button> 
    );
}
