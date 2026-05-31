"use server";

import { getIronSession as getIronSession_ } from "iron-session";
import { cookies } from "next/headers";
import { C } from "./environ";
import { sendWebloginWebhook } from "./webhook";

const COOKIE_NAME = "auth";  // Name of the cookie that auth data is stored in

type WrappedSessionData = {
    hasSession: true,  // Constant flag
    data: SessionData
}
type SessionData = {  // Wrapping it again makes it easier to set the whole thing in one
    username: string,
    optimistic: {
        panel: boolean
    }
} 

const getIronSession = async () => await getIronSession_<WrappedSessionData>(await cookies(), { password: C().SESSION_PASSWORD, cookieName: COOKIE_NAME, cookieOptions: { secure: false } });  // TODO: Set secure to true

/**
 * Gets the session data of the current user, or null if there is no session.
 */
async function getSessionData(): Promise<SessionData|null> {
    const session = await getIronSession();
    if (session.hasSession !== true) return null;  // If user has no session then return null
    return session.data;
}

export async function optimisticCheckUser(area: keyof SessionData["optimistic"]) {
    const session = await getSessionData();
    if (session === null) return false;
    return session.optimistic[area] === true;
}

/**
 * Like optimisticCheckUser but throws an error if the test fails.
 */
export async function optimisticRequireUser(area: keyof SessionData["optimistic"]) {
    if (!optimisticCheckUser(area)) throw "User has no permission to access " + area;
}

/**
 * Returns true if the user has an active session.
 */
export async function hasSession() {
    return (await getSessionData()) !== null;
}

/**
 * Checks if a user exists, and if they do then creates a session for that user.
 * @returns True if the session was sucessfully created, and false otherwise.
 */
export async function attemptCreateSession(username: string, password: string) {
    // TODO: What to do if a session already exists

    // TODO: Load sessions from a database

    const i = C().PANEL_USER.indexOf(username);
    if (i === -1) return false;  // User not found
    if (password !== C().PANEL_PASSWORD[i]) return false;  // Invalid password

    const session = await getIronSession(); 
    session.hasSession = true;
    session.data = {
        username: username,
        optimistic: {
            panel: true
        }
    };
    await session.save();
    sendWebloginWebhook(username);
    return true;
}

/**
 * Remove the session from the current user if they have one.
 */
export async function dropSession() {
    const session = await getIronSession(); 
    session.destroy();
}

/**
 * Gets the data of the current logged-in user.
 * Note, this expects the user to be logged in.
 * // TODO: Document return data
 */
export async function getUserData() {
    const session = await getSessionData();
    if (session === null) throw "Expected current user to have a session";
    return {
        username: session.username
    };
}
