"use server";

import { NS } from "@/lib/session";
import { redirectLogin } from "../login/util";

/**
 * Logs the current user out of their session (if they have one, otherwise it is ignored).
 * This will then redirect the user to the login page.
 * @param next - Optional parameter to navigate to after the login page.
 */
export async function logoutAction(next?: string) {
    await NS.dropSession(); 
    redirectLogin(next);
}
