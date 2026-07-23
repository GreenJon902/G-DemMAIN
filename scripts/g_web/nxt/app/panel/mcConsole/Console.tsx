"use client";

/**
 * Auth + connection flow for the MC console:
 *
 * Connecting only ever requires "viewer" (see `ensureSudo`), so a plain viewer with no 2FA connects
 * instantly and can watch the live feed read-only. Sending a command additionally requires "admin",
 * checked (and sudo-gated) independently right before the command is sent - the server (mcc)
 * re-checks this fresh on every command too, so the client-side check here is UX only, not the
 * actual security boundary.
 *
 * `ensureSudo(minLevel)`:
 *   1. Calls `getAreaSudoStatusAction("panel", minLevel)` (server action) to check whether sudo mode
 *      is currently required and active for the given level.
 *   2. If sudo is required but 2FA is not enabled, shows the "sudo unavailable" modal and aborts.
 *   3. If sudo is required and 2FA is enabled, opens the 2FA verification modal and waits for the
 *      user to enter their code (`requestSudo()`). Aborts if they cancel.
 *   4. Returns whether the caller may proceed, plus whether sudo was actually required (used by the
 *      connection to decide whether it needs to react to sudo mode expiring later - see below).
 *
 * Lifecycle:
 *   - On mount: `connectRef.current()` is called automatically, gated on `ensureSudo("viewer")`.
 *   - The server (`@g/mcc`) re-validates permissions/sudo at connection and command time, so the
 *     server and client checks are always in sync.
 *   - On sudo expiry: the `AuthContext` timer clears `sudoVerifiedAt`; the effect below only closes
 *     the socket if *this* connection actually needed sudo to open (tracked in
 *     `connectionSudoGatedRef`) - otherwise a plain viewer session would be disconnected just because
 *     sudo expired elsewhere (e.g. another tab), which never mattered for them.
 *   - On send while disconnected: `sendCommand` awaits `connectRef.current()` before sending,
 *     so typing a command while the socket is closed triggers a reconnect and then sends the
 *     command if reconnection succeeds.
 *   - On reconnect from account page: if the user enters sudo elsewhere while the socket is
 *     closed, the `sudoVerifiedAt` effect detects `sudoVerifiedAt` becoming non-null and
 *     calls `connectRef.current()` automatically.
 */

import { useEffect, useRef, useState } from "react";
import { BUTTON_GREEN, SimpleButton } from "../../ui/Button";
import TextInput from "../../ui/TextInput";
import { useAuthContext } from "../../AuthContext";
import { getAreaSudoStatusAction } from "../../actions";
import { zConsoleServerMessage, type ConsoleLine, type ConsoleMeta, type ConsoleCommand } from "@g/com/lib/mcConsoleProtocol";
import { formatConsoleLine, LEVEL_COLOR } from "./consoleFormat";

type Entry = { kind: "line", line: ConsoleLine } | { kind: "meta", meta: ConsoleMeta } | { kind: "note" };

// How long to wait before retrying an unexpected connection failure (e.g. the MC server itself being
// down, so mcc closes the socket instantly) - without this, a persistently-failing upstream would
// cause a tight, zero-delay reconnect loop
const RECONNECT_DELAY_MS = 3000;

const MAX_DISPLAYED_ENTRIES = 50;

/** Parses a string as JSON, returning undefined (rather than throwing) if it isn't valid JSON. */
function tryParseJson(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

export default function Console({ mccwss_port }: { mccwss_port: number }) {
    /**
     * We need to pass mccwss_port from the server to the client-component as a prop as client can't access environ.
     */

    // Store the entries received from MCCWSS (both real console lines and locally/mcc-synthesized notices)
    const [entries, setEntries] = useState<Array<Entry>>([]);
    const appendEntries = (newEntries: Array<Entry>) =>
        setEntries(prev => [...prev, ...newEntries].slice(-MAX_DISPLAYED_ENTRIES));
    const pushMeta = (level: ConsoleMeta["level"], message: string) =>
        appendEntries([{ kind: "meta", meta: { type: "meta", level, source: "Client", message } }]);

    const { sudoVerifiedAt, requestSudo, showSudoUnavailable, checkPermission } = useAuthContext();
    const isAdmin = checkPermission("panel", "admin");

    const socketRef = useRef<WebSocket | null>(null);
    const isMountedRef = useRef(false);
    // Prevents concurrent connection attempts; stays true for the whole lifetime of a connection
    const connectingRef = useRef(false);
    // Suppress the "Server closed the connection" message when we close intentionally
    const intentionalCloseRef = useRef(false);
    // Whether the current connection's viewer-level check actually required sudo (only then does losing sudo matter to it)
    const connectionSudoGatedRef = useRef(false);
    // Keep latest auth callbacks reachable from async/event-handler contexts without dep-array churn
    const requestSudoRef = useRef(requestSudo);
    const showSudoUnavailableRef = useRef(showSudoUnavailable);
    useEffect(() => { requestSudoRef.current = requestSudo; }, [requestSudo]);
    useEffect(() => { showSudoUnavailableRef.current = showSudoUnavailable; }, [showSudoUnavailable]);

    // Checks (and if necessary, prompts for) sudo mode for the given permission level.
    // Returns whether the caller may proceed, and whether sudo was actually required for this check.
    async function ensureSudo(minLevel: "viewer" | "admin"): Promise<{ ok: boolean, requiredSudo: boolean }> {
        const status = await getAreaSudoStatusAction("panel", minLevel);
        if (!status.requiresSudo) return { ok: true, requiredSudo: false };

        const what = minLevel === "admin" ? "run commands" : "use the console";
        if (!status.tfaEnabled) {
            await showSudoUnavailableRef.current();
            pushMeta("WARN", `You must enter sudo mode to ${what}.`);
            return { ok: false, requiredSudo: true };
        }
        const ok = await requestSudoRef.current();
        if (!ok) pushMeta("WARN", `You must enter sudo mode to ${what}.`);
        return { ok, requiredSudo: true };
    }

    // Stable entry point for initiating a connection. Updated after every render so it always
    // captures the latest mccwss_port and pushMeta without needing them in dependency arrays.
    // Resolves true when the socket opens, false on any failure (auth cancelled, error, etc.).
    const connectRef = useRef<() => Promise<boolean>>(null!);
    useEffect(() => {
        connectRef.current = (): Promise<boolean> => {
            if (!isMountedRef.current || connectingRef.current) return Promise.resolve(false);
            connectingRef.current = true;

            return new Promise<boolean>((resolve) => {
                (async () => {
                    // Verify (viewer-level) sudo mode on the server before opening the socket
                    const { ok, requiredSudo } = await ensureSudo("viewer");
                    connectionSudoGatedRef.current = requiredSudo;
                    if (!isMountedRef.current) { connectingRef.current = false; resolve(false); return; }
                    if (!ok) { connectingRef.current = false; resolve(false); return; }

                    pushMeta("INFO", "Connecting...");
                    const socket = new WebSocket(`ws://${window.location.hostname}:${mccwss_port}`);
                    socketRef.current = socket;

                    // Append to the array in a way that makes react update
                    socket.addEventListener("open", () => {
                        pushMeta("INFO", "Connected!");
                        resolve(true);
                    });
                    socket.addEventListener("message", (event) => {
                        const parsed = zConsoleServerMessage.safeParse(tryParseJson(event.data as string));
                        if (!parsed.success) {
                            console.error("Console: dropping unparseable message from mcc<", event.data, ">", parsed.error);
                            return;
                        }
                        const message = parsed.data;
                        if (message.type === "history") {
                            const historyEntries: Array<Entry> = message.lines.map(line => ({ kind: "line", line }));
                            appendEntries([...historyEntries, { kind: "note" }]);
                        } else if (message.type === "meta") {
                            appendEntries([{ kind: "meta", meta: message }]);
                        } else {
                            appendEntries([{ kind: "line", line: message }]);
                        }
                    });
                    socket.addEventListener("error", () => {
                        pushMeta("ERROR", "An error occured!");
                        resolve(false);
                    });
                    socket.addEventListener("close", () => {
                        socketRef.current = null;
                        connectingRef.current = false;
                        const wasIntentional = intentionalCloseRef.current;
                        intentionalCloseRef.current = false;
                        resolve(false);
                        if (wasIntentional) {
                            // A deliberate close (e.g. sudo refresh) - reconnect right away, it'll re-prompt if needed
                            connectRef.current();
                        } else {
                            // An unexpected close (mcc itself down, or its upstream monitor-mod connection down, e.g.
                            // because the MC server is off) - wait before retrying so a persistently-failing
                            // upstream doesn't turn into a tight, zero-delay reconnect loop
                            pushMeta("WARN", "Server closed the connection! This may be to refresh sudo-mode.");
                            setTimeout(() => connectRef.current(), RECONNECT_DELAY_MS);
                        }
                    });
                })();
            });
        };
    });

    // Connect on mount; tear down on unmount
    useEffect(() => {
        isMountedRef.current = true;
        // NOTE: In development mode, this may try and connect twice
        connectRef.current();
        return () => {
            isMountedRef.current = false;
            intentionalCloseRef.current = true;
            socketRef.current?.close();
            socketRef.current = null;
        };
    }, [mccwss_port]);

    // Close the connection when sudo expires, but only if this connection actually needed it
    // (the reconnect will re-prompt); reconnect if sudo becomes active while we are disconnected
    // (e.g. entered from the account page)
    useEffect(() => {
        if (sudoVerifiedAt === null && socketRef.current !== null && connectionSudoGatedRef.current) {
            intentionalCloseRef.current = true;
            pushMeta("WARN", "Refreshing sudo mode, disconnecting...");
            socketRef.current.close();
            socketRef.current = null;
        } else if (sudoVerifiedAt !== null && socketRef.current === null && !connectingRef.current) {
            connectRef.current();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- pushMeta only closes over the stable setEntries dispatcher, so an older render's copy behaves identically; this should only re-run on sudoVerifiedAt changes
    }, [sudoVerifiedAt]);

    // Function to handle sending the command
    const commandBoxRef = useRef<HTMLInputElement>(null);
    async function sendCommand() {
        if (commandBoxRef.current === null) throw new Error("Exception, commandBoxRef.current is null");

        // Capture the command before any await so changes to the input box don't affect us
        const command = commandBoxRef.current.value.trim();
        if (command === "") return;

        // Sending requires admin, checked (and sudo-gated) independently of the viewer-level connection check
        const { ok } = await ensureSudo("admin");
        if (!ok) return;

        // If not connected, attempt to reconnect (which will re-check viewer-level sudo if needed)
        if (socketRef.current === null) {
            const connected = await connectRef.current();
            if (!connected) return;
        }

        const socket = socketRef.current;
        if (socket === null) return;  // Connection closed between reconnect and send
        commandBoxRef.current.value = "";
        socket.send(JSON.stringify({ type: "command", command } satisfies ConsoleCommand));
    }

    // Always keep the console scrolled to the bottom as new content arrives
    const consoleDivRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const cd = consoleDivRef.current;
        if (cd === null) throw new Error("Exception, consoleDivRef.current is null");
        cd.scrollTop = cd.scrollHeight;
    }, [entries]);

    return (
        <div className="flex h-[calc(100dvh-10rem)] flex-col gap-1">
            <div
                className="w-full flex-1 overflow-scroll rounded-md bg-gray-950 p-1"
                ref={consoleDivRef}
            >
                {
                    entries
                        .map((entry, i) => {
                            if (entry.kind === "note") {
                                return (
                                    <span key={i} className="block text-gray-500 italic">
                                        * History may not be entirely accurate.
                                    </span>
                                );
                            }
                            if (entry.kind === "meta") {
                                // Notices from mcc/the client itself - not timestamped or attributed to a thread, so rendered as just the message
                                return (
                                    <span key={i} className={`block ${LEVEL_COLOR[entry.meta.level]}`}>
                                        {entry.meta.message}
                                    </span>
                                );
                            }
                            return (
                                <span key={i} className={`block whitespace-pre-wrap ${LEVEL_COLOR[entry.line.level]}`}>
                                    {formatConsoleLine(entry.line)}
                                </span>
                            );
                        })
                }
            </div>
            <div className="flex gap-1">
                <TextInput
                    placeholder="Message or /command to run..."
                    ref={commandBoxRef}
                    disabled={!isAdmin}
                    onKeyDown={event => {if (event.code === "Enter") sendCommand();}}  // Run command when enter pressed
                />
                <SimpleButton callback={sendCommand} color={BUTTON_GREEN} disabled={{ area: "panel", minLevel: "admin" }}>Run</SimpleButton>
            </div>
        </div>
    );
}
