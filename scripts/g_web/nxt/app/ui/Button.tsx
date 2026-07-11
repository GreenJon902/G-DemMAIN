/**
 * This file contains UI specifications for colored-rounded-clickable-ui-elements.
 * So buttons obviously, but also links and stuff.
 */

"use client";


import { ArrowPathIcon } from "@heroicons/react/20/solid";
import { Url } from "next/dist/shared/lib/router/router";
import Link from "next/link";
import { ReactNode, Ref, useState } from "react";

// Since we need to specify tailwind colors in full (including "hover:bg-green-123123"), we will use constants
// This also means colors will be fixed and must hence be consistent
type ButtonColor = { normal: string, focusVisible: string, hover: string }
const ButtonColor = (normal: string, focusVisible: string, hover: string): ButtonColor => ({ normal, focusVisible, hover });
export const BUTTON_GREEN:  ButtonColor = ButtonColor("bg-green-600",  "focus-visible:bg-green-800",  "hover:bg-green-800");
export const BUTTON_YELLOW: ButtonColor = ButtonColor("bg-yellow-600", "focus-visible:bg-yellow-800", "hover:bg-yellow-800");
export const BUTTON_RED:    ButtonColor = ButtonColor("bg-red-600",    "focus-visible:bg-red-800",    "hover:bg-red-800");
export const BUTTON_CYAN:    ButtonColor = ButtonColor("bg-cyan-600",    "focus-visible:bg-cyan-800",    "hover:bg-cyan-800");
export const BUTTON_INDIGO:    ButtonColor = ButtonColor("bg-indigo-600",    "focus-visible:bg-indigo-800",    "hover:bg-indigo-800");

/**
 * Gets the `className` that all button-like components will use.
 * @param color - The {@link ButtonColor} of this button.
 * @param className - Optional extra class names for the button, e.g. size-6.
 * @param disabled - When true, removes hover/focus colors and applies reduced opacity and a not-allowed cursor.
 */
function getButtonClass(color: ButtonColor, className: string, disabled = false) {
    const cursor = disabled ? "cursor-not-allowed" : "cursor-pointer";
    const colors = disabled
        ? `opacity-50 ${color.normal}`
        : `${color.normal} ${color.focusVisible} ${color.hover}`;
    return `relative flex ${cursor} justify-center rounded-md px-1 text-nowrap outline-none ${colors} ${className}`;
}
/**
 * A button that isn't a button at all, it's a styled Link (react.Link, not <a>) component.
 *
 * @param children - The normal content to display inside the button.
 * @param href - The page to go to when this is clicked.
 * @param color - The {@link ButtonColor} of this button.
 * @param className - Optional extra class names for the button, e.g. size-6.
 * @param newTab - Does this link open in a new tab, aka target="_blank".
 * @param disabled - When true, renders as a non-navigable span with greyed-out styling.
 */
export function LinkButton({
    children,
    href,
    color,
    className = "",
    newTab = false,
    disabled = false
}: {
    children: ReactNode,
    href: Url,
    color: ButtonColor,
    className?: string,
    newTab?: boolean,
    disabled?: boolean
}) {
    if (disabled) {
        return (
            <span className={getButtonClass(color, className, true)}>
                {children}
            </span>
        );
    }
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
 * @param confirm - an optional function to call when the button is clicked to confirm that we want to execute the action. Returns true (or a Promise resolving to true) to run the action, false to abort. Runs before the loading state is entered.
 * @param onError - an optional handler called with the thrown value if `guard` or `action` throw. If not supplied the error is rethrown instead.
 * @param color - The {@link ButtonColor} of this button.
 * @param classname - optional extra class names for the button, e.g. size-6.
 * @param ref - An optional reference to the actual button element.
 * @param disabled - When true, the button is permanently greyed out and non-interactive (e.g. user lacks permission).
 */
export function ActionButton({
    children,
    action,
    confirm = () => true,
    guard,
    onError,
    color,
    className = "",
    ref,  // defaults to undefined
    disabled = false
}: {
    children: ReactNode,
    action: () => Promise<void>,
    confirm?: () => boolean | Promise<boolean>,
    guard?: () => boolean | Promise<boolean>,
    onError?: (error: unknown) => void,
    color: ButtonColor,
    className?: string,
    ref?: Ref<HTMLButtonElement>,
    disabled?: boolean
}) {
    const [isPending, setIsPending] = useState(false);
    const buttonClicked = async () => {
        if (isPending || !await confirm()) return;
        setIsPending(true);
        try {
            if (guard && !await guard()) {
                console.log("ActionButton guard returned false, aborting action");
                return;
            }
            await action();
        } catch (error) {
            if (onError) onError(error);
            else throw error;
        } finally {
            setIsPending(false);
        }
    };

    // Create a button that shows either a the content or the spinner
    return (
        <button type="button" onClick={buttonClicked} className={getButtonClass(color, className, disabled)} disabled={isPending || disabled} ref={ref}>
            { /* Render both at same time so size remains constant, but hide the one we don't need */ }
            <ArrowPathIcon className={`size-6 animate-spin self-stretch stroke-2 text-white ${isPending ? "" : "invisible"} absolute`} />
            <div className={`${isPending ? "invisible" : ""}`}> {children} </div> 
        </button> 
    );
}

/**
 * A button that runs a function on the client.
 *
 * @param children - The normal content to display inside the button.
 * @param callback - The function to call when this is clicked.
 * @param color - The {@link ButtonColor} of this button.
 * @param className - Optional extra class names for the button, e.g. size-6.
 */
export function SimpleButton({
    children,
    callback,
    color,
    className = ""
}: {
    children: ReactNode,
    callback: () => void,
    color: ButtonColor,
    className?: string,
}) {
    return ( 
        <button onClick={callback} className={getButtonClass(color, className)} >
            {children} 
        </button> 
    );
}
