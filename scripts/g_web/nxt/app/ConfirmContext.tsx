"use client";

import { createContext, useContext, useRef, useState, ReactNode } from "react";
import { SimpleButton, ActionButton, BUTTON_GREEN, BUTTON_RED } from "@/app/ui/Button";
import ModalShell from "@/app/ui/ModalShell";

export type ConfirmContextType = {
    /** Opens the confirmation modal with the given warning message and returns a Promise that
     *  resolves to true when the user accepts or false when they cancel. */
    requestConfirm: (message: string) => Promise<boolean>;
};

const ConfirmCtx = createContext<ConfirmContextType | null>(null);

/** Provides a confirmation modal to the component tree. */
export function ConfirmContextProvider({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const resolveRef = useRef<((confirmed: boolean) => void) | null>(null);

    const requestConfirm = (msg: string): Promise<boolean> => {
        setMessage(msg);
        setOpen(true);
        return new Promise<boolean>((resolve) => {
            resolveRef.current = resolve;
        });
    };

    const settle = (confirmed: boolean) => {
        setOpen(false);
        resolveRef.current?.(confirmed);
        resolveRef.current = null;
    };

    return (
        <ConfirmCtx.Provider value={{ requestConfirm }}>
            {children}
            <ConfirmModal open={open} message={message} onConfirm={() => settle(true)} onDismiss={() => settle(false)} />
        </ConfirmCtx.Provider>
    );
}

export function useConfirmContext(): ConfirmContextType {
    const ctx = useContext(ConfirmCtx);
    if (ctx === null) throw new Error("useConfirmContext must be used within ConfirmContextProvider");
    return ctx;
}

function ConfirmModal({
    open,
    message,
    onConfirm,
    onDismiss
}: {
    open: boolean;
    message: string;
    onConfirm: () => void;
    onDismiss: () => void;
}) {
    return (
        <ModalShell open={open} onDismiss={onDismiss} title="Confirm Action" description={message}>
            <div className="flex gap-2">
                <ActionButton action={async () => onConfirm()} color={BUTTON_GREEN} className="flex-1">
                    Confirm
                </ActionButton>
                <SimpleButton callback={onDismiss} color={BUTTON_RED} className="flex-1">
                    Cancel
                </SimpleButton>
            </div>
        </ModalShell>
    );
}
