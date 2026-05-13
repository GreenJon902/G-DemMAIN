"use client";

import TextInput from "../panel/ui/TextInput";
import { ActionButton, BUTTON_GREEN } from "../panel/ui/Button";
import { useRef, useState } from "react";
import { attemptLoginAction } from "./actions";
import { redirect } from "next/navigation";

/**
 * The login form client-component.
 * This component handles the credential validation and creation of the session.
 * However it is expected that user has no existing session if this component is displayed.
 * @param nextPath - The path to go to after logging-in.
 */
export default function LoginForm({ nextPath }: { nextPath: string }) {
    // Create actual UI
    const [showIncorrectPassword, setShowIncorrectPassword] = useState(false);

    const unmBoxRef = useRef<HTMLInputElement>(null);
    const pwdBoxRef = useRef<HTMLInputElement>(null);
    const subButRef = useRef<HTMLButtonElement>(null);

    return (
        <div className="flex h-svh items-center justify-center">
            <div className="m-1 flex size-fit flex-col gap-1 rounded-xl bg-gray-800 p-2">
                <h1 className="text-xl underline">Login</h1>

                <TextInput 
                    name={"username"} 
                    label="Username" 
                    onKeyDown={event => (event.code === "Enter" && pwdBoxRef.current && pwdBoxRef.current.focus())}
                    ref={unmBoxRef}
                />
                <TextInput 
                    name={"password"} 
                    label="Password" 
                    onKeyDown={event => (event.code === "Enter" && subButRef.current && subButRef.current.click())} 
                    password 
                    ref={pwdBoxRef}
                />
                <span className="text-red-600" hidden={!showIncorrectPassword}>Incorrect username or password!</span>
                
                <ActionButton 
                    action={async () => {
                        if (unmBoxRef.current === null) throw "unmBoxRef is null";
                        if (pwdBoxRef.current === null) throw "pwdBoxRef is null";

                        const result = await attemptLoginAction(unmBoxRef.current.value, pwdBoxRef.current.value);
                        setShowIncorrectPassword(!result);

                        // If succesful then forward user to another page
                        if (result) {
                            redirect(nextPath);
                        }
                    }}
                    color={BUTTON_GREEN}
                    ref={subButRef}
                >
                    Login
                </ActionButton>
            </div>
        </div>
    );
}
