"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import TextInput from "@/app/ui/TextInput";
import { ActionButton, BUTTON_GREEN, SimpleButton, BUTTON_RED } from "@/app/ui/Button";
import { Area } from "@g/com/lib/auth";
import { getSudoStatusAction, enterSudoAction } from "@/app/actions";

// null - Modal closed, verify - enter 2fa token to enter sudo mode, disabled - user has 2fa disabled and cannot enter sudo mode
type SudoModalMode = "verify" | "disabled" | null;

type SudoModalCtxType = {
    requestSudo: () => Promise<boolean>;
    showSudoUnavailable: () => Promise<void>;
};

const SudoModalCtx = createContext<SudoModalCtxType | null>(null);

export function SudoModalProvider({ children }: { children: ReactNode }) {
    const [mode, setMode] = useState<SudoModalMode>(null);
    const resolveRef = useRef<((verified: boolean) => void) | null>(null);  // Reference to function that resolves the promise that is blocking the caller of requestSudo or showSudoUnavailable until the modal is dismissed

    const requestSudo = (): Promise<boolean> => {
        setMode("verify");
        return new Promise<boolean>((resolve) => {
            resolveRef.current = resolve;  // When called, result of sudo check will be passed to caller of requestSudo
        });
    };

    const showSudoUnavailable = (): Promise<void> => {
        setMode("disabled");
        return new Promise<void>((resolve) => {
            resolveRef.current = () => resolve();  // We drop the output as sudo mode can only "fail" in this case
        });
    };

    // Closes the modal and unblocks whichever promise is pending
    const settle = (verified: boolean) => {
        setMode(null);
        resolveRef.current?.(verified);
        resolveRef.current = null;
    };

    return (
        <SudoModalCtx.Provider value={{ requestSudo, showSudoUnavailable }}>
            {children}
            <SudoModal mode={mode} onVerified={() => settle(true)} onDismiss={() => settle(false)} />
        </SudoModalCtx.Provider>
    );
}

export function useSudoModal(): SudoModalCtxType {
    const ctx = useContext(SudoModalCtx);
    if (ctx === null) throw new Error("useSudoModal must be used within SudoModalProvider");
    return ctx;
}

/**
 * Returns a guard function for use with ActionButton that checks whether sudo mode is required
 * for the given area and, if so, either opens the sudo verification modal (if 2FA is enabled on
 * the account) or an unavailability notice (if 2FA is not yet configured).
 */
export function makeAreaSudoGuard(area: Area, sudoModal: SudoModalCtxType): () => Promise<boolean> {
    return async () => {
        const status = await getSudoStatusAction(area);
        if (!status.requiresSudo) return true;  // sudo mode not required
        if (!status.tfaEnabled) {
            await sudoModal.showSudoUnavailable();
            return false;
        }
        return sudoModal.requestSudo();
    };
}

/**
 * Generic component that actually creates a modal.
 */
function ModalShell({
    open,
    onDismiss,
    title,
    description,
    children,
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
                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex w-72 flex-col gap-2 rounded-xl bg-gray-800 p-4">
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
    onDismiss,
}: {
    mode: SudoModalMode;
    onVerified: () => void;
    onDismiss: () => void;
}) {
    const [error, setError] = useState<string | null>(null);
    const codeRef = useRef<HTMLInputElement>(null);

    // Clear the error message when we close the modal
    useEffect(() => {
        if (mode === null) setError(null);
    }, [mode]);

    return <>
        {/* Enter sudo mode -------------------- */}
        <ModalShell 
            open={mode === "verify"} 
            onDismiss={onDismiss} 
            title="Enter Sudo Mode"
            description="Enter your 2FA code to confirm your identity."
        >
            <TextInput
                name="tfa-code"
                ref={codeRef}
                maxLength={6}
                autoComplete="one-time-code"
                inputMode="numeric"
            />
            {error && <span className="text-sm text-red-500">{error}</span>}
            <div className="flex gap-2">
                <ActionButton
                    action={async () => {
                        const code = codeRef.current?.value ?? "";
                        const ok = await enterSudoAction(code);
                        if (ok) {
                            onVerified();
                        } else {
                            setError("Incorrect code, try again.");
                        }
                    }}
                    color={BUTTON_GREEN}
                    className="flex-1"
                >
                    Verify
                </ActionButton>
                <SimpleButton callback={onDismiss} color={BUTTON_RED} className="flex-1">
                    Cancel
                </SimpleButton>
            </div>
        </ModalShell>
        {/* Sudo mode unavailable -------------------- */}
        <ModalShell 
            open={mode === "disabled"}
            onDismiss={onDismiss}
            title="Sudo Mode Unavailable"
            description="
            This action requires sudo mode, but your account does not have 2FA enabled. Please enable 2FA to gain access."
        >
            <SimpleButton callback={onDismiss} color={BUTTON_RED}>
                Close
            </SimpleButton>
        </ModalShell>
    </>;
}
