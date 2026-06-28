"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import TextInput from "@/app/ui/TextInput";
import { ActionButton, BUTTON_GREEN, SimpleButton, BUTTON_RED } from "@/app/ui/Button";
import type { Area } from "@g/com/lib/auth";
import { SUDO_WINDOW_MS } from "@g/com/lib/authConstants";
import { getAreaSudoStatusAction, enterSudoAction } from "@/app/actions";

type SudoModalMode = "verify" | "disabled" | null;

export type AuthContextType = {
    isLoggedIn: boolean;
    sudoVerifiedAt: number | null;  // When was sudo mode entered. If this was longer ago than SUDO_WINDOW_MS then the user is not in sudo mode
    tfaEnabled: boolean;            // User has 2fa enabled
    requestSudo: () => Promise<boolean>;       // Function to request that the user is in sudo mode. This blocks until the user is in sudo mode and true is returned, or the user is not and false is returned
    showSudoUnavailable: () => Promise<void>;  // Function to display that this user is unable to enter sudo mode. This blocks until the modal is dismissed
    onSudoExited: () => void;               
};

const AuthCtx = createContext<AuthContextType | null>(null);

export function AuthContextProvider({
    initialIsLoggedIn,
    initialSudoVerifiedAt,
    initialTfaEnabled,
    children
}: {
    initialIsLoggedIn: boolean;
    initialSudoVerifiedAt: number | null;
    initialTfaEnabled: boolean;
    children: ReactNode;
}) {
    const [isLoggedIn, setIsLoggedIn] = useState(initialIsLoggedIn);
    const [sudoVerifiedAt, setSudoVerifiedAt] = useState(initialSudoVerifiedAt);
    const [tfaEnabled, setTfaEnabled] = useState(initialTfaEnabled);

    // Sync with server state on navigation (layout re-renders pass fresh initial values).
    // The set-state-in-effect rule is a false positive: this is prop→state syncing, not derived state
    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => { setIsLoggedIn(initialIsLoggedIn); }, [initialIsLoggedIn]);
    useEffect(() => { setSudoVerifiedAt(initialSudoVerifiedAt); }, [initialSudoVerifiedAt]);
    useEffect(() => { setTfaEnabled(initialTfaEnabled); }, [initialTfaEnabled]);
    /* eslint-enable react-hooks/set-state-in-effect */

    // Clear sudoVerifiedAt when the sudo window expires
    useEffect(() => {
        if (sudoVerifiedAt === null) return;
        const remaining = Math.max(0, SUDO_WINDOW_MS - (Date.now() - sudoVerifiedAt));
        const timer = setTimeout(() => setSudoVerifiedAt(null), remaining);
        return () => clearTimeout(timer);
    }, [sudoVerifiedAt]);

    const [mode, setMode] = useState<SudoModalMode>(null);
    const resolveRef = useRef<((verified: boolean) => void) | null>(null);

    const requestSudo = (): Promise<boolean> => {
        setMode("verify");
        return new Promise<boolean>((resolve) => {
            resolveRef.current = resolve;
        });
    };

    const showSudoUnavailable = (): Promise<void> => {
        setMode("disabled");
        return new Promise<void>((resolve) => {
            resolveRef.current = () => resolve();
        });
    };

    const settle = (verified: boolean) => {
        setMode(null);
        if (verified) setSudoVerifiedAt(Date.now());
        resolveRef.current?.(verified);
        resolveRef.current = null;
    };

    const onSudoExited = () => setSudoVerifiedAt(null);

    return (
        <AuthCtx.Provider value={{ isLoggedIn, sudoVerifiedAt, tfaEnabled, requestSudo, showSudoUnavailable, onSudoExited }}>
            {children}
            <SudoModal mode={mode} onVerified={() => settle(true)} onDismiss={() => settle(false)} />
        </AuthCtx.Provider>
    );
}

export function useAuthContext(): AuthContextType {
    const ctx = useContext(AuthCtx);
    if (ctx === null) throw new Error("useAuthContext must be used within AuthContextProvider");
    return ctx;
}

/**
 * Returns a guard function for use with ActionButton that checks whether sudo mode is required
 * for the given area and, if so, either opens the sudo verification modal (if 2FA is enabled on
 * the account) or an unavailability notice (if 2FA is not yet configured).
 */
export function makeAreaSudoGuard(area: Area, ctx: AuthContextType): () => Promise<boolean> {
    return async () => {
        const status = await getAreaSudoStatusAction(area);
        if (!status.requiresSudo) return true;
        if (!status.tfaEnabled) {
            await ctx.showSudoUnavailable();
            return false;
        }
        return ctx.requestSudo();
    };
}

function ModalShell({
    open,
    onDismiss,
    title,
    description,
    children
}: {
    open: boolean;
    onDismiss: () => void;
    title: string;
    description: string;
    children?: ReactNode;
}) {
    return (
        <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onDismiss(); }}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/60" />
                <Dialog.Content className="fixed top-1/2 left-1/2 flex w-72 -translate-x-1/2 -translate-y-1/2 flex-col gap-2 rounded-xl bg-gray-800 p-4">
                    <Dialog.Title className="text-xl font-bold underline decoration-2">{title}</Dialog.Title>
                    <Dialog.Description className="text-sm text-gray-400">{description}</Dialog.Description>
                    {children}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

function SudoModal({
    mode,
    onVerified,
    onDismiss
}: {
    mode: SudoModalMode;
    onVerified: () => void;
    onDismiss: () => void;
}) {
    const [error, setError] = useState<string | null>(null);
    const codeRef = useRef<HTMLInputElement>(null);
    const subButRef = useRef<HTMLButtonElement>(null);

    const handleDismiss = () => {
        setError(null);
        onDismiss();
    };

    return <>
        {/* Enter sudo mode -------------------- */}
        <ModalShell
            open={mode === "verify"}
            onDismiss={handleDismiss}
            title="Enter Sudo Mode"
            description="Enter your 2FA code to confirm your identity."
        >
            <TextInput
                name="tfa-code"
                ref={codeRef}
                maxLength={6}
                autoComplete="one-time-code"
                inputMode="numeric"
                onKeyDown={event => (event.code === "Enter" && subButRef.current && subButRef.current.click())}
            />
            {error && <span className="text-sm text-red-500">{error}</span>}
            <div className="flex gap-2">
                <ActionButton
                    action={async () => {
                        const code = codeRef.current?.value ?? "";
                        const ok = await enterSudoAction(code);
                        if (ok) {
                            setError(null);
                            onVerified();
                        } else {
                            setError("Incorrect code, try again.");
                        }
                    }}
                    color={BUTTON_GREEN}
                    className="flex-1"
                    ref={subButRef}
                >
                    Verify
                </ActionButton>
                <SimpleButton callback={handleDismiss} color={BUTTON_RED} className="flex-1">
                    Cancel
                </SimpleButton>
            </div>
        </ModalShell>
        {/* Sudo mode unavailable -------------------- */}
        <ModalShell
            open={mode === "disabled"}
            onDismiss={handleDismiss}
            title="Sudo Mode Unavailable"
            description="
            This action requires sudo mode, but your account does not have 2FA enabled. Please enable 2FA to gain access."
        >
            <SimpleButton callback={handleDismiss} color={BUTTON_RED}>
                Close
            </SimpleButton>
        </ModalShell>
    </>;
}
