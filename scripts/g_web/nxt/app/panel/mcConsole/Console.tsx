"use client";
// TODO: Implement colouring text

import { useEffect, useRef, useState } from "react";
import { BUTTON_GREEN, SimpleButton } from "../../ui/Button";
import TextInput from "../../ui/TextInput";

export default function Console({ mccwss_port }: { mccwss_port: number }) {
    /**
     * We need to pass mccwss_port from the server to the client-component as a prop as client can't access environ.
     */

    // Store the messages from MCCWSS
    const [consoleContent, setConsoleContent] = useState<Array<string>>([]);
    const pushConsoleContent = (text: string) => setConsoleContent(prev => [...prev, text]);  // Function to push to the array

    // Connect to MCCWSS
    const socketRef = useRef<WebSocket>(null);
    useEffect(() => {
        // NOTE: In development mode, this may try and connect twice

        // eslint-disable-next-line react-hooks/set-state-in-effect
        pushConsoleContent("INFO: Connecting...");
        const socket = new WebSocket(`ws://${window.location.hostname}:${mccwss_port}`);  // TODO: Use the correct url
        socketRef.current = socket;

        // Append to the array in a way that makes react update
        socket.addEventListener("open", (event) => {
            console.log("OPEN:", event);
            pushConsoleContent("INFO: Connected!");
        });
        socket.addEventListener("message", (event) => {
            console.log("MESSAGE:", event);
            pushConsoleContent(event.data);
        });
        socket.addEventListener("error", (event) => {
            console.log("ERROR:", event);
            pushConsoleContent("INFO: An error occured!");
        });
        socket.addEventListener("close", (event) => {
            console.log("CLOSE:", event);
            pushConsoleContent("INFO: Server closed the connection!");
        });

        return () => socket.close();
    }, [mccwss_port]);

    // Function to handle sending the command
    const commandBoxRef = useRef<HTMLInputElement>(null);
    function sendCommand() {
        if (commandBoxRef.current === null) throw new Error("Exception, commandBoxRef.current is null");
        if (socketRef.current === null) throw new Error("Exception, socketRef.current is null");

        // Get function from text-box
        const command = commandBoxRef.current.value.trim();
        // If command is empty then don't do anything
        if (command === "") return;
        // Clear text-box
        commandBoxRef.current.value = "";
        // Send command to server
        socketRef.current.send(command);
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
