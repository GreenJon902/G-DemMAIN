"use server"

import { dropSession } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Logs the current user out of their session (if they have one, otherwise it is ignored).
 * This will then redirect the user to the login page.
 */
export async function logoutAction() {
   await dropSession(); 
   redirect("/login?next=/account");
}
