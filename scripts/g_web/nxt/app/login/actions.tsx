"use server";

import { NS } from "@g/com/lib/auth";

/**
 * Validates if a users credentials are correct.
 * If they are then they are assigned a new session.
 * @returns true if credentials are correct, and false otherwise.
 */
export async function attemptLoginAction(username: string, password: string) {
    return await NS.attemptCreateSession(username, password);
}
