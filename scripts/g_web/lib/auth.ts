"use server";

import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

const PASSWORD = "testingtestingtestingtestingtestingtestingtestingtestingtestingtestingtesting";  // The password used to encrypt the password cookies // TODO: Load from environ
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

/**
 * Gets the session data of the current user, or null if there is no session.
 */
async function getSessionData(): Promise<SessionData|null> {
    const session = await getIronSession<WrappedSessionData>(await cookies(), { password: PASSWORD, cookieName: COOKIE_NAME });
    if (session.hasSession !== true) return null;  // If user has no session then return null
    return session.data;
}

export async function optimisticCheckUser(area: keyof SessionData["optimistic"]) {
    const session = await getSessionData();
    if (session === null) return false;
    return session.optimistic[area] === true;
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

    // TODO: Validate username and password
    const userExists = password === "bar";
    if (!userExists) return false;

    // TODO: Load a real session
    const session = await getIronSession<WrappedSessionData>(await cookies(), { password: PASSWORD, cookieName: COOKIE_NAME }); 
    session.hasSession = true;
    session.data = {
        username: username,
        optimistic: {
            panel: username === "foo"
        }
    };
    await session.save();
    return true;
}

/**
 * Remove the session from the current user if they have one.
 */
export async function dropSession() {
    const session = await getIronSession<WrappedSessionData>(await cookies(), { password: PASSWORD, cookieName: COOKIE_NAME }); 
    await session.destroy();
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
