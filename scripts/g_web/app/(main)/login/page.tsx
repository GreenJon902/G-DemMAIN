"use client";

import { redirect, useSearchParams } from "next/navigation";
import TextInput from "../panel/ui/TextInput";
import { ActionButton, BUTTON_GREEN } from "../panel/ui/Button";
import { useEffect, useRef, useState } from "react";
import { attemptLoginAction } from "./actions";
import { hasSession } from "@/lib/auth";

export default function Page() {

    // Util to redirect the user to the next page
    const searchParams = useSearchParams();
    const goToNextPage = () => {
        console.log("gtnp", searchParams);
        if (searchParams.has("next")) {
            redirect(searchParams.get("next") as string);
        } else {
            redirect("/");
        }  
    };

    // If the user is already authenticated then skip this page
    useEffect(() => {
        hasSession().then(v => v && goToNextPage());
    }, []);

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
                            goToNextPage();
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

