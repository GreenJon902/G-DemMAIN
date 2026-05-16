
import { getUserData, hasSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ActionButton, BUTTON_RED } from "../ui/Button";
import { logoutAction } from "./actions";

export default async function Page() {
    // If user not logged in then log them in
    
    //if (!await hasSession()) redirect("/login?next=/account");

    // Render user page
    const user = await getUserData();

    return (
        <div className="p-1">
            <span>
                You are currently logged in as 
                <span className="text-gray-400"> {user.username} </span> 
                .
            </span>
            <ActionButton
                action={logoutAction}
                color={BUTTON_RED}
            >
                Log out
            </ActionButton>
        </div>
    )
}
