"use server";

import { NS } from "@/lib/auth";
import { redirectLogin } from "../login/util";

/**
 * Logs the current user out of their session (if they have one, otherwise it is ignored).
 * This will then redirect the user to the login page.
 */
export async function logoutAction() {
    await NS.dropSession(); 
    redirectLogin();
}
