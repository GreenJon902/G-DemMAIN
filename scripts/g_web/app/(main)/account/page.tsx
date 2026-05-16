
import { getUserData, hasSession } from "@/lib/auth";
import { ActionButton, BUTTON_RED } from "../ui/Button";
import { logoutAction } from "./actions";
import { redirectLogin } from "../login/util";

export default async function Page() {
    // If user not logged in then log them in
    
    if (!await hasSession()) redirectLogin("/account");

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
    );
}
