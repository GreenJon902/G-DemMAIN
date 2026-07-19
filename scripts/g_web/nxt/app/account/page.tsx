
import type { Metadata } from "next";
import { NS } from "@/lib/session";
import { ActionButton, BUTTON_RED } from "../ui/Button";
import { logoutAction } from "./actions";
import { redirectLogin } from "../login/util";
import AccountSudoSection from "./AccountSudoSection";

export const metadata: Metadata = { title: "Account" };

export default async function Page() {
    // If user not logged in then log them in
    if (!await NS.hasSession()) redirectLogin("/account");

    const user = await NS.getUserData();

    return (
        <div className="flex flex-col gap-2 p-1">
            <span>
                You are currently logged in as
                <span className="text-gray-400"> {user.username} </span>
                .
            </span>
            <AccountSudoSection />
            <div>
                <ActionButton
                    action={logoutAction}
                    color={BUTTON_RED}
                >
                    Log out
                </ActionButton>
            </div>
        </div>
    );
}
