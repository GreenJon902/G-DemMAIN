/**
 * This file contains UI specifications for colored-rounded-clickable-ui-elements.
 * So buttons obviously, but also links and stuff.
 */

"use client";


import { ArrowPathIcon } from "@heroicons/react/20/solid";
import { Url } from "next/dist/shared/lib/router/router";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactNode, Ref, useState } from "react";
import { useAuthContext } from "@/app/AuthContext";
import type { AreaPermissionRequirement } from "@g/com/lib/authConstants";

// Since we need to specify tailwind colors in full (including "hover:bg-green-123123"), we will use constants
// This also means colors will be fixed and must hence be consistent
export type ButtonColor = { normal: string, focusVisible: string, hover: string }
const ButtonColor = (normal: string, focusVisible: string, hover: string): ButtonColor => ({ normal, focusVisible, hover });
export const BUTTON_GREEN:  ButtonColor = ButtonColor("bg-green-600",  "focus-visible:bg-green-800",  "hover:bg-green-800");
export const BUTTON_YELLOW: ButtonColor = ButtonColor("bg-yellow-600", "focus-visible:bg-yellow-800", "hover:bg-yellow-800");
export const BUTTON_RED:    ButtonColor = ButtonColor("bg-red-600",    "focus-visible:bg-red-800",    "hover:bg-red-800");
export const BUTTON_CYAN:    ButtonColor = ButtonColor("bg-cyan-600",    "focus-visible:bg-cyan-800",    "hover:bg-cyan-800");
export const BUTTON_INDIGO:    ButtonColor = ButtonColor("bg-indigo-600",    "focus-visible:bg-indigo-800",    "hover:bg-indigo-800");
export const BUTTON_GRAY:    ButtonColor = ButtonColor("bg-gray-600",    "focus-visible:bg-gray-700",    "hover:bg-gray-700");
export const BUTTON_BLUE:    ButtonColor = ButtonColor("bg-blue-600",    "focus-visible:bg-blue-800",    "hover:bg-blue-800");

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

// Props shared by every button-like component, regardless of what it actually renders as
type AbstractButtonSharedProps = {
    children: ReactNode,
    color: ButtonColor,
    className?: string,
    title?: string,
    disabled?: boolean | AreaPermissionRequirement,  // A boolean disables unconditionally; a requirement disables when the user lacks that permission
    confirm?: () => boolean | Promise<boolean>,       // Optional pre-flight check; the primary action only proceeds if this resolves true
    onError?: (error: unknown) => void                // Called with whatever confirm/onActivate throws; rethrown if not given
};

// actualType picks the rendered element and is set internally by each public wrapper below, never by their callers
type AbstractButtonProps =
    | (AbstractButtonSharedProps & { actualType: "LINK", href: Url, newTab?: boolean, ref?: Ref<HTMLAnchorElement> })
    | (AbstractButtonSharedProps & { actualType: "BUTTON", onActivate: () => Promise<void> | void, ref?: Ref<HTMLButtonElement> });

/**
 * Private base for every exported button-like component (LinkButton, ActionButton, SimpleButton).
 * Owns everything that shouldn't drift between them: colour/disabled styling, permission-aware
 * disabling, the confirm gate, error handling, and which element actually gets rendered
 * ("LINK" for a Next Link, "BUTTON" for a native button — set internally by each public wrapper,
 * not exposed to their callers). Pending/loading state is NOT handled here — that stays local to
 * ActionButton, which pre-composes its own spinner into the `children` it passes down.
 */
function AbstractButton(props: AbstractButtonProps) {
    const { children, color, className = "", title, confirm, onError } = props;
    const { checkPermission } = useAuthContext();
    const router = useRouter();

    const disabled = typeof props.disabled === "object"
        ? !checkPermission(props.disabled.area, props.disabled.minLevel)
        : (props.disabled ?? false);

    // Runs the confirm gate (if any), then `proceed`, routing any thrown error to onError
    const activate = async (proceed: () => Promise<void> | void) => {
        try {
            if (confirm && !await confirm()) return;
            await proceed();
        } catch (error) {
            if (onError) onError(error);
            else throw error;
        }
    };

    if (disabled) {
        return (
            <span className={getButtonClass(color, className, true)} title={title}>
                {children}
            </span>
        );
    }

    if (props.actualType === "LINK") {
        const { href, newTab, ref } = props;
        return (
            <Link
                href={href}
                ref={ref}
                title={title}
                className={getButtonClass(color, className)}
                target={newTab ? "_blank" : "_self"}
                onClick={confirm ? (e) => {
                    e.preventDefault();
                    // Next's App Router router.push only accepts a string, unlike Link's href
                    activate(() => router.push(href as string));
                } : undefined}
            >
                {children}
            </Link>
        );
    }

    const { onActivate, ref } = props;
    return (
        <button
            type="button"
            ref={ref}
            title={title}
            onClick={() => activate(onActivate)}
            className={getButtonClass(color, className)}
        >
            {children}
        </button>
    );
}

/**
 * A button that isn't a button at all, it's a styled Link (react.Link, not <a>) component.
 *
 * @param children - The normal content to display inside the button.
 * @param href - The page to go to when this is clicked.
 * @param color - The {@link ButtonColor} of this button.
 * @param className - Optional extra class names for the button, e.g. size-6.
 * @param title - Optional tooltip text shown on hover.
 * @param newTab - Does this link open in a new tab, aka target="_blank".
 * @param disabled - When true (or a permission the user lacks), renders as a non-navigable span with greyed-out styling.
 * @param confirm - Optional pre-flight check; navigation only proceeds if this resolves true.
 * @param onError - Called with whatever `confirm` throws; rethrown if not given.
 * @param ref - An optional reference to the underlying anchor element.
 */
export function LinkButton({
    children,
    href,
    newTab = false,
    color,
    className = "",
    title,
    disabled,
    confirm,
    onError,
    ref
}: {
    children: ReactNode,
    href: Url,
    newTab?: boolean,
    color: ButtonColor,
    className?: string,
    title?: string,
    disabled?: boolean | AreaPermissionRequirement,
    confirm?: () => boolean | Promise<boolean>,
    onError?: (error: unknown) => void,
    ref?: Ref<HTMLAnchorElement>
}) {
    return (
        <AbstractButton
            actualType="LINK"
            href={href}
            newTab={newTab}
            color={color}
            className={className}
            title={title}
            disabled={disabled}
            confirm={confirm}
            onError={onError}
            ref={ref}
        >
            {children}
        </AbstractButton>
    );
}

/**
 * A button that runs a server action.
 * This shows a loading action icon and is un-clickable while it is running.
 *
 * @param children - The normal content to display inside the button.
 * @param action - The server-action to run when the button is pressed.
 * @param guard - An optional function, checked once `confirm` has passed, that decides whether the
 *                action is actually allowed to run (e.g. a sudo check) — return false to silently abort.
 * @param color - The {@link ButtonColor} of this button.
 * @param className - Optional extra class names for the button, e.g. size-6.
 * @param title - Optional tooltip text shown on hover.
 * @param disabled - When true (or a permission the user lacks), renders as a non-interactive span with greyed-out styling.
 * @param confirm - Optional pre-flight check; `guard`/`action` only run if this resolves true.
 * @param onError - Called with whatever `confirm`, `guard`, or `action` throws; rethrown if not given.
 * @param ref - An optional reference to the actual button element.
 */
export function ActionButton({
    children,
    action,
    guard,
    ref,
    ...sharedProps
}: {
    children: ReactNode,
    action: () => Promise<void>,
    guard?: () => boolean | Promise<boolean>,
    color: ButtonColor,
    className?: string,
    title?: string,
    disabled?: boolean | AreaPermissionRequirement,
    confirm?: () => boolean | Promise<boolean>,
    onError?: (error: unknown) => void,
    ref?: Ref<HTMLButtonElement>
}) {
    const [isPending, setIsPending] = useState(false);

    // Reentrancy guard lives here (not in AbstractButton) since only ActionButton tracks pending state
    const onActivate = async () => {
        if (isPending) return;
        setIsPending(true);
        try {
            if (guard && !await guard()) {
                console.log("ActionButton guard returned false, aborting action");
                return;
            }
            await action();
        } finally {
            setIsPending(false);
        }
    };

    return (
        <AbstractButton actualType="BUTTON" onActivate={onActivate} ref={ref} {...sharedProps}>
            { /* Render both at same time so size remains constant, but hide the one we don't need */ }
            <ArrowPathIcon className={`size-6 animate-spin self-stretch stroke-2 text-white ${isPending ? "" : "invisible"} absolute`} />
            <div className={isPending ? "invisible" : ""}>{children}</div>
        </AbstractButton>
    );
}

/**
 * A button that runs a function on the client.
 *
 * @param children - The normal content to display inside the button.
 * @param callback - The function to call when this is clicked.
 * @param color - The {@link ButtonColor} of this button.
 * @param className - Optional extra class names for the button, e.g. size-6.
 * @param title - Optional tooltip text shown on hover.
 * @param disabled - When true (or a permission the user lacks), renders as a non-interactive span with greyed-out styling.
 * @param confirm - Optional pre-flight check; `callback` only runs if this resolves true.
 * @param onError - Called with whatever `confirm`/`callback` throws; rethrown if not given.
 * @param ref - An optional reference to the actual button element.
 */
export function SimpleButton({
    children,
    callback,
    ...sharedProps
}: {
    children: ReactNode,
    callback: () => void | Promise<void>,
    color: ButtonColor,
    className?: string,
    title?: string,
    disabled?: boolean | AreaPermissionRequirement,
    confirm?: () => boolean | Promise<boolean>,
    onError?: (error: unknown) => void,
    ref?: Ref<HTMLButtonElement>
}) {
    return (
        <AbstractButton actualType="BUTTON" onActivate={callback} {...sharedProps}>
            {children}
        </AbstractButton>
    );
}
