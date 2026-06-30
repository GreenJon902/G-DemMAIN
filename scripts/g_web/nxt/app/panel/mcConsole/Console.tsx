"use client";
// TODO: Implement colouring text

/**
 * Auth + connection flow for the MC console:
 *
 * Every connection attempt runs through `connectRef.current()`, which:
 *   1. Calls `getAreaSudoStatusAction("panel")` (server action) to check whether sudo mode is
 *      currently active on the user's session.
 *   2. If sudo is required but 2FA is not enabled, shows the "sudo unavailable" modal and aborts.
 *   3. If sudo is required and 2FA is enabled, opens the 2FA verification modal and waits for the
 *      user to enter their code (`requestSudo()`). Aborts if they cancel.
 *   4. Opens the WebSocket. The server (`@g/mcc`) re-validates sudo via `strictCheckUser` at
 *      connection time, so the server and client checks are always in sync.
 *   5. The server sets a `setTimeout` to close the socket when the sudo window expires, giving
 *      a server-side guarantee even if the client-side enforcement fails.
 *
 * Lifecycle:
 *   - On mount: `connectRef.current()` is called automatically.
 *   - On sudo expiry: the `AuthContext` timer clears `sudoVerifiedAt`; the `sudoVerifiedAt`
 *     effect detects the transition, closes the socket, and the close handler triggers a
 *     reconnect (which will re-prompt for sudo).
 *   - On send while disconnected: `sendCommand` awaits `connectRef.current()` before sending,
 *     so typing a command while the socket is closed triggers a reconnect + auth flow and then
 *     sends the command if reconnection succeeds.
 *   - On reconnect from account page: if the user enters sudo elsewhere while the socket is
 *     closed, the `sudoVerifiedAt` effect detects `sudoVerifiedAt` becoming non-null and
 *     calls `connectRef.current()` automatically.
 */

import { useEffect, useRef, useState } from "react";
import { BUTTON_GREEN, SimpleButton } from "../../ui/Button";
import TextInput from "../../ui/TextInput";
import { useAuthContext } from "../../AuthContext";
import { getAreaSudoStatusAction } from "../../actions";

export default function Console({ mccwss_port }: { mccwss_port: number }) {
    /**
     * We need to pass mccwss_port from the server to the client-component as a prop as client can't access environ.
     */

    // Store the messages from MCCWSS
    const [consoleContent, setConsoleContent] = useState<Array<string>>([]);
    const pushConsoleContent = (text: string) => setConsoleContent(prev => [...prev, text]);

    const { sudoVerifiedAt, requestSudo, showSudoUnavailable } = useAuthContext();

    const socketRef = useRef<WebSocket | null>(null);
    const isMountedRef = useRef(false);
    // Prevents concurrent connection attempts; stays true for the whole lifetime of a connection
    const connectingRef = useRef(false);
    // Suppress the "Server closed the connection" message when we close intentionally
    const intentionalCloseRef = useRef(false);
    // Keep latest auth callbacks reachable from async/event-handler contexts without dep-array churn
    const requestSudoRef = useRef(requestSudo);
    const showSudoUnavailableRef = useRef(showSudoUnavailable);
    useEffect(() => { requestSudoRef.current = requestSudo; }, [requestSudo]);
    useEffect(() => { showSudoUnavailableRef.current = showSudoUnavailable; }, [showSudoUnavailable]);

    // Stable entry point for initiating a connection. Updated after every render so it always
    // captures the latest mccwss_port and pushConsoleContent without needing them in dependency arrays.
    // Resolves true when the socket opens, false on any failure (auth cancelled, error, etc.).
    const connectRef = useRef<() => Promise<boolean>>(null!);
    useEffect(() => {
        connectRef.current = (): Promise<boolean> => {
            if (!isMountedRef.current || connectingRef.current) return Promise.resolve(false);
            connectingRef.current = true;

            return new Promise<boolean>((resolve) => {
                (async () => {
                    // Verify sudo mode on the server before opening the socket
                    const status = await getAreaSudoStatusAction("panel");
                    if (!isMountedRef.current) { connectingRef.current = false; resolve(false); return; }

                    if (status.requiresSudo) {
                        if (!status.tfaEnabled) {
                            connectingRef.current = false;
                            await showSudoUnavailableRef.current();
                            pushConsoleContent("INFO: You must enter sudo mode to use the console.");
                            resolve(false);
                            return;
                        }
                        const ok = await requestSudoRef.current();
                        if (!isMountedRef.current) { connectingRef.current = false; resolve(false); return; }
                        if (!ok) {
                            connectingRef.current = false;
                            pushConsoleContent("INFO: You must enter sudo mode to use the console.");
                            resolve(false);
                            return;
                        }
                    }

                    if (!isMountedRef.current) { connectingRef.current = false; resolve(false); return; }

                    pushConsoleContent("INFO: Connecting...");
                    const socket = new WebSocket(`ws://${window.location.hostname}:${mccwss_port}`);
                    socketRef.current = socket;

                    // Append to the array in a way that makes react update
                    socket.addEventListener("open", () => {
                        pushConsoleContent("INFO: Connected!");
                        resolve(true);
                    });
                    socket.addEventListener("message", (event) => {
                        pushConsoleContent(event.data as string);
                    });
                    socket.addEventListener("error", () => {
                        pushConsoleContent("INFO: An error occured!");
                        resolve(false);
                    });
                    socket.addEventListener("close", () => {
                        socketRef.current = null;
                        connectingRef.current = false;
                        if (!intentionalCloseRef.current) {
                            pushConsoleContent("INFO: Server closed the connection! This may be to refresh sudo-mode.");
                        }
                        intentionalCloseRef.current = false;
                        resolve(false);
                        // Reconnect (will re-check sudo, prompting the user again if necessary)
                        connectRef.current();
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

    // Close the connection when sudo expires (the reconnect will re-prompt);
    // reconnect if sudo becomes active while we are disconnected (e.g. entered from the account page)
    useEffect(() => {
        if (sudoVerifiedAt === null && socketRef.current !== null) {
            intentionalCloseRef.current = true;
            pushConsoleContent("INFO: Refreshing sudo mode, disconnecting...");
            socketRef.current.close();
            socketRef.current = null;
        } else if (sudoVerifiedAt !== null && socketRef.current === null && !connectingRef.current) {
            connectRef.current();
        }
    }, [sudoVerifiedAt]);

    // Function to handle sending the command
    const commandBoxRef = useRef<HTMLInputElement>(null);
    async function sendCommand() {
        if (commandBoxRef.current === null) throw new Error("Exception, commandBoxRef.current is null");

        // Capture the command before any await so changes to the input box don't affect us
        const command = commandBoxRef.current.value.trim();
        if (command === "") return;

        // If not connected, attempt to reconnect (which will re-check sudo if needed)
        if (socketRef.current === null) {
            const connected = await connectRef.current();
            if (!connected) return;
        }

        const socket = socketRef.current;
        if (socket === null) return;  // Connection closed between reconnect and send
        commandBoxRef.current.value = "";
        socket.send(command);
    }

    // If the console is scrolled to the bottom, then stay there when we add new conent
    const consoleDivRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const cd = consoleDivRef.current;
        if (cd === null) throw new Error("Exception, consoleDivRef.current is null");
        if (cd.lastChild === null) return;
        const lastChild = cd.lastChild as unknown as { clientHeight: number };  // So typescript is happy
        if (cd.scrollHeight - cd.scrollTop - cd.clientHeight < lastChild.clientHeight + 10) {  // Is at bottom?
            cd.scrollTop = cd.scrollHeight;  // Scroll to bottom
        }
    }, [consoleContent]);


    return (
        <div className="flex max-h-[30dvh] flex-col gap-1">
            <div
                className="w-full flex-1 overflow-scroll rounded-md bg-gray-950 p-1"
                ref={consoleDivRef}
            >
                {
                    consoleContent.map((text, i) => (
                        <span key={i} className="block">
                            {text}
                        </span>
                    ))
                }
            </div>
            <div className="flex gap-1">
                <TextInput
                    placeholder="Message or /command to run..."
                    ref={commandBoxRef}
                    onKeyDown={event => {if (event.code === "Enter") sendCommand();}}  // Run command when enter pressed
                />
                <SimpleButton callback={sendCommand} color={BUTTON_GREEN}>Run</SimpleButton>
            </div>
        </div>
    );
}
