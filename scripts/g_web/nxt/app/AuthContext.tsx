"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import TextInput from "@/app/ui/TextInput";
import ModalShell from "@/app/ui/ModalShell";
import { ActionButton, BUTTON_GREEN, SimpleButton, BUTTON_RED } from "@/app/ui/Button";
import { AREAS, checkMinPermission, type Area, type AreaPermission, SUDO_WINDOW_MS } from "@g/com/lib/authConstants";
import type { StoredPermissions } from "@g/com/lib/auth";
import { getAreaSudoStatusAction, enterSudoAction } from "@/app/actions";

type SudoModalMode = "verify" | "disabled" | null;

type AuthBroadcast =
    | { type: "sudo-entered"; at: number }
    | { type: "sudo-exited" }
    | { type: "logged-in"; permissions: StoredPermissions }  // Only need to sync permissions, other fields will be reloaded before use
    | { type: "logged-out" };

export type AuthContextType = {
    isLoggedIn: boolean;
    sudoVerifiedAt: number | null;  // When was sudo mode entered. If this was longer ago than SUDO_WINDOW_MS then the user is not in sudo mode
    tfaEnabled: boolean;            // User has 2fa enabled
    checkPermission: <A extends Area>(area: A, minLevel: AreaPermission<A>) => boolean;  // Checks the cached, client-synced permissions — same semantics as NS.optimisticCheckPermission
    requestSudo: () => Promise<boolean>;       // Function to request that the user is in sudo mode. This blocks until the user is in sudo mode and true is returned, or the user is not and false is returned
    showSudoUnavailable: () => Promise<void>;  // Function to display that this user is unable to enter sudo mode. This blocks until the modal is dismissed
    onSudoExited: () => void;
};

const AuthCtx = createContext<AuthContextType | null>(null);

/**
 * Provides auth state to the component tree.
 *
 * Cross-tab sync: login, logout, sudo-entered, and sudo-exited events are broadcast over
 * BroadcastChannel("auth-sync") so all open tabs stay in sync without polling. Logout triggers
 * a page reload in other tabs so the server can redirect to the login page as appropriate.
 */
export function AuthContextProvider({
    initialIsLoggedIn,
    initialSudoVerifiedAt,
    initialTfaEnabled,
    initialPermissions,
    children
}: {
    initialIsLoggedIn: boolean;
    initialSudoVerifiedAt: number | null;
    initialTfaEnabled: boolean;
    initialPermissions: StoredPermissions;
    children: ReactNode;
}) {
    const [isLoggedIn, setIsLoggedIn] = useState(initialIsLoggedIn);
    const [sudoVerifiedAt, setSudoVerifiedAt] = useState(initialSudoVerifiedAt);
    const [tfaEnabled, setTfaEnabled] = useState(initialTfaEnabled);
    const [permissions, setPermissions] = useState(initialPermissions);

    const channelRef = useRef<BroadcastChannel | null>(null);
    useEffect(() => {
        const channel = new BroadcastChannel("auth-sync");
        channelRef.current = channel;
        // Mirror auth state changes broadcast by other tabs into this tab's local state.
        channel.onmessage = ({ data }: MessageEvent<AuthBroadcast>) => {
            switch (data.type) {
            case "sudo-entered": setSudoVerifiedAt(data.at); break;
            case "sudo-exited":  setSudoVerifiedAt(null);   break;
            case "logged-in":    setIsLoggedIn(true); setPermissions(data.permissions); break;
            case "logged-out":   window.location.reload();  break;  // Clear all data and let server routing redirect (to login)
            }
        };
        return () => { channel.close(); channelRef.current = null; };
    }, []);

    // Sync with server state on navigation (layout re-renders pass fresh initial values).
    // The set-state-in-effect rule is a false positive: this is prop→state syncing, not derived state
    const prevIsLoggedInRef = useRef(initialIsLoggedIn);
    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        const prev = prevIsLoggedInRef.current;
        prevIsLoggedInRef.current = initialIsLoggedIn;
        setIsLoggedIn(initialIsLoggedIn);
        // Broadcast login/logout transitions so other tabs update without waiting for a navigation.
        // Reads initialPermissions directly (not permissions state) since it's guaranteed fresh for
        // this render; it's deliberately not a dep here since it should only piggyback on an actual
        // login transition, not re-fire this effect on every permissions change (synced separately below)
        // eslint-disable-next-line react-hooks/exhaustive-deps
        if (initialIsLoggedIn && !prev)  channelRef.current?.postMessage({ type: "logged-in", permissions: initialPermissions } satisfies AuthBroadcast);
        if (!initialIsLoggedIn && prev)  channelRef.current?.postMessage({ type: "logged-out" } satisfies AuthBroadcast);
    }, [initialIsLoggedIn]);
    useEffect(() => { setSudoVerifiedAt(initialSudoVerifiedAt); }, [initialSudoVerifiedAt]);
    useEffect(() => { setTfaEnabled(initialTfaEnabled); }, [initialTfaEnabled]);
    useEffect(() => { setPermissions(initialPermissions); }, [initialPermissions]);
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
        if (verified) {
            const at = Date.now();
            setSudoVerifiedAt(at);
            channelRef.current?.postMessage({ type: "sudo-entered", at } satisfies AuthBroadcast);
        }
        resolveRef.current?.(verified);
        resolveRef.current = null;
    };

    const onSudoExited = () => {
        setSudoVerifiedAt(null);
        channelRef.current?.postMessage({ type: "sudo-exited" } satisfies AuthBroadcast);
    };

    const checkPermission = <A extends Area>(area: A, minLevel: AreaPermission<A>): boolean =>
        checkMinPermission(AREAS[area].levels, permissions[area], minLevel);

    return (
        <AuthCtx.Provider value={{ isLoggedIn, sudoVerifiedAt, tfaEnabled, checkPermission, requestSudo, showSudoUnavailable, onSudoExited }}>
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
 * for the given area and permission level and, if so, either opens the sudo verification modal
 * (if 2FA is enabled on the account) or an unavailability notice (if 2FA is not yet configured).
 */
export function makeAreaSudoGuard<A extends Area>(area: A, minLevel: AreaPermission<A>, ctx: AuthContextType): () => Promise<boolean> {
    return async () => {
        const status = await getAreaSudoStatusAction(area, minLevel);
        if (!status.requiresSudo) return true;
        if (!status.tfaEnabled) {
            await ctx.showSudoUnavailable();
            return false;
        }
        return ctx.requestSudo();
    };
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
