"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { SimpleButton, BUTTON_RED } from "@/app/ui/Button";
import ModalShell from "@/app/ui/ModalShell";
// Not part of the public "next/navigation" API, so this path could shift on a Next.js upgrade
import { getAccessFallbackErrorTypeByStatus, getAccessFallbackHTTPStatus, isHTTPAccessFallbackError } from "next/dist/client/components/http-access-fallback/http-access-fallback";  // TODO: Find a proper API for this

export type ErrorContextType = {
    /** Logs the error (with its stack trace) to the console and opens the error modal with a human-readable message. */
    showError: (error: unknown) => void;
};

const ErrorCtx = createContext<ErrorContextType | null>(null);

/**
 * Turns a thrown value into a human-readable message.
 * Recognises the digest that next/navigation's forbidden()/unauthorized()/notFound() attach to their errors,
 * since those otherwise surface as an opaque "NEXT_HTTP_ERROR_FALLBACK;<status>" string.
 * Returns null for redirect errors (which are internal Next.js navigation, not real errors).
 */
function describeError(error: unknown): string | null {
    // Redirect errors from Server Actions are internal navigation, not errors to display
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
        return null;
    }
    // Check if it's a next-navigation error
    if (isHTTPAccessFallbackError(error)) {
        const type = getAccessFallbackErrorTypeByStatus(getAccessFallbackHTTPStatus(error));
        if (type) {
            const readable = type.replace("-", " ");
            return readable.charAt(0).toUpperCase() + readable.slice(1);
        }
    }
    // Unkown error so just render
    return error instanceof Error ? error.message : String(error);
}

/** 
 * Provides an "An error occurred" modal to the component tree. 
 * This error will also be logged to the console.
 */
export function ErrorContextProvider({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");

    const showError = (error: unknown) => {
        console.error(error);
        const message = describeError(error);
        if (message === null) return; // Suppress redirect errors
        setMessage(message);
        setOpen(true);
    };

    const dismiss = () => setOpen(false);

    return (
        <ErrorCtx.Provider value={{ showError }}>
            {children}
            <ErrorModal open={open} message={message} onDismiss={dismiss} />
        </ErrorCtx.Provider>
    );
}

export function useErrorContext(): ErrorContextType {
    const ctx = useContext(ErrorCtx);
    if (ctx === null) throw new Error("useErrorContext must be used within ErrorContextProvider");
    return ctx;
}

function ErrorModal({
    open,
    message,
    onDismiss
}: {
    open: boolean;
    message: string;
    onDismiss: () => void;
}) {
    return (
        <ModalShell open={open} onDismiss={onDismiss} title="An Error Occurred" description={message}>
            <SimpleButton callback={onDismiss} color={BUTTON_RED}>
                Dismiss
            </SimpleButton>
        </ModalShell>
    );
}
