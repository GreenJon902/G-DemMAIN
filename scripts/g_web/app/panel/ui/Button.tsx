/**
 * This file contains UI specifications for colored-rounded-clickable-ui-elements.
 * So buttons obviously, but also links and stuff.
 */

"use client";


import { ArrowPathIcon } from "@heroicons/react/20/solid";
import { Url } from "next/dist/shared/lib/router/router";
import Link from "next/link";
import { ReactNode, useTransition } from "react";

// Since we need to specify tailwind colors in full (including "hover:bg-green-123123"), we will use constants
// This also means colors will be fixed and must hence be consistent
type ButtonColor = { normal: string, focusVisible: string, hover: string }
const ButtonColor = (normal: string, focusVisible: string, hover: string): ButtonColor => ({ normal, focusVisible, hover });
export const BUTTON_GREEN:  ButtonColor = ButtonColor("bg-green-600",  "focus-visible:bg-green-800",  "hover:bg-green-800");
export const BUTTON_YELLOW: ButtonColor = ButtonColor("bg-yellow-600", "focus-visible:bg-yellow-800", "hover:bg-yellow-800");
export const BUTTON_RED:    ButtonColor = ButtonColor("bg-red-600",    "focus-visible:bg-red-800",    "hover:bg-red-800");
export const BUTTON_CYAN:    ButtonColor = ButtonColor("bg-cyan-600",    "focus-visible:bg-cyan-800",    "hover:bg-cyan-800");

/**
 *  Gets the `className` that all button-like components will use.
 * @param color - The {@link ButtonColor} of this button.
 * @param className - Optional extra class names for the button, e.g. size-6.
 */
function getButtonClass(color: ButtonColor, className: string) {
    return `relative flex cursor-pointer justify-center rounded-md px-1 text-nowrap outline-none ${color.normal} ${color.focusVisible} ${color.hover} ${className}`;
}
/**
 * A button that isn't a button at all, it's a styled Link (react.Link, not <a>) component.
 *
 * @param children - The normal content to display inside the button.
 * @param href - The page to go to when this is clicked.
 * @param color - The {@link ButtonColor} of this button.
 * @param className - Optional extra class names for the button, e.g. size-6.
 * @param newTab - Does this link open in a new tab, aka target="_blank".
 */
export function LinkButton({
    children,
    href,
    color,
    className = "",
    newTab = false
}: {
    children: ReactNode,
    href: Url,
    color: ButtonColor,
    className?: string,
    newTab?: boolean
}) {
    return ( 
        <Link href={href} className={getButtonClass(color, className)} target={newTab ? "_blank" : "_self"}>
            {children} 
        </Link> 
    );
}

/**
 * A button that runs a server action.
 * This shows a loading action icon and is un-clickable while it is running.
 *
 * @param children - the normal content to display inside the button.
 * @param action - the server-action to run when the button is pressed.
 * @param confirm - an optional function to call when the button is clicked to confirm that we want to execute the action. this returns true to run the action, and false otherwise.
 * @param color - The {@link ButtonColor} of this button.
 * @param classname - optional extra class names for the button, e.g. size-6.
 */ 
export function ActionButton({
    children,
    action,
    confirm = () => true,
    color,
    className = ""
}: {
    children: ReactNode,
    action: () => Promise<void>,
    confirm?: () => boolean,
    color: ButtonColor,
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
    return ( 
        <button type="button" onClick={buttonClicked} className={getButtonClass(color, className)} disabled={isPending}>
            { /* Render both at same time so size remains constant, but hide the one we don't need */ }
            <ArrowPathIcon className={`size-6 animate-spin self-stretch stroke-2 text-white ${isPending ? "" : "invisible"} absolute`} />
            <div className={`${isPending ? "invisible" : ""}`}> {children} </div> 
        </button> 
    );
}
