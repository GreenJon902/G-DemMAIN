"use server"

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
 * Creates a session for the given user.
 * TODO: Implement this to authenticate the user.
 */
export async function createSessionAction() {
    const session = await getIronSession<WrappedSessionData>(await cookies(), { password: PASSWORD, cookieName: COOKIE_NAME }); 
    session.hasSession = true;
    session.data = {
        username: "test",
        optimistic: {
            panel: true
        }
    }
    await session.save();
}
