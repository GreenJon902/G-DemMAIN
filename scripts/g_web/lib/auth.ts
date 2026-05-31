/**
 * This file provides the utilities for session management for the whole project.
 */

import { getIronSession as getIronSession_ } from "iron-session";
import { C } from "./environ";
import { cookies as nextCookies } from "next/headers";
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


/**
 * This is the generic interface through which the iron-session can be accessed.
 * However how this loads and saves the iron session depends on the arguments with which this class is instantiated.
 */ 
export class SessionAccessor {
    #sessionCookieArgsGetter: 
        { type: "cookies", cookies: typeof nextCookies } | 
        { type: "reqres", req: Request, res: Response };


    /**
     * Creates a new sessionAccessor. 
     * The cookies getter function will only be called when data is accessed/modified.
     */ 
    constructor(...cookies: [() => ReturnType<typeof nextCookies>] | [Request, Response]) {
        if (cookies.length === 2) {
            this.#sessionCookieArgsGetter = { type: "reqres", req: cookies[0], res: cookies[1] };
        } else {
            this.#sessionCookieArgsGetter = { type: "cookies", cookies: cookies[0] };
        }  

        // Fix a weird js thing
        Object.getOwnPropertyNames(SessionAccessor.prototype).forEach((key) => {
            if (key !== 'constructor') {
                this[key] = this[key].bind(this);
            }
        });
    }

    async #getIronSession() {
        const SESSION_OPTIONS = { password: C().SESSION_PASSWORD, cookieName: COOKIE_NAME, cookieOptions: { secure: false } };
        if (this.#sessionCookieArgsGetter.type === "cookies") {
            return await getIronSession_<WrappedSessionData>(await this.#sessionCookieArgsGetter.cookies(), SESSION_OPTIONS);
        } else if (this.#sessionCookieArgsGetter.type === "reqres") {
            return await getIronSession_<WrappedSessionData>(this.#sessionCookieArgsGetter.req, this.#sessionCookieArgsGetter.res, SESSION_OPTIONS);
        } else {
            throw "Unkown method";
        }
    }

    /**
     * Gets the session data of the current user, or null if there is no session.
     */
    async #getSessionData(): Promise<SessionData|null> {
        const session = await this.#getIronSession();
        if (session.hasSession !== true) return null;  // If user has no session then return null
        return session.data;
    }

    async optimisticCheckUser(area: keyof SessionData["optimistic"]) {
        const session = await this.#getSessionData();
        if (session === null) return false;
        return session.optimistic[area] === true;
    }

    /**
     * Like optimisticCheckUser but throws an error if the test fails.
     */
    async optimisticRequireUser(area: keyof SessionData["optimistic"]) {
        if (!this.optimisticCheckUser(area)) throw "User has no permission to access " + area;
    }

    /**
     * Returns true if the user has an active session.
     */
    async hasSession() {
        return (await this.#getSessionData()) !== null;
    }

    /**
     * Checks if a user exists, and if they do then creates a session for that user.
     * @returns True if the session was sucessfully created, and false otherwise.
     */
    async attemptCreateSession(username: string, password: string) {
        // TODO: What to do if a session already exists

        // TODO: Load sessions from a database

        const i = C().PANEL_USER.indexOf(username);
        if (i === -1) return false;  // User not found
        if (password !== C().PANEL_PASSWORD[i]) return false;  // Invalid password

        const session = await this.#getIronSession(); 
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
    async dropSession() {
        const session = await this.#getIronSession(); 
        session.destroy();
    }

    /**
     * Gets the data of the current logged-in user.
     * Note, this expects the user to be logged in.
     * // TODO: Document return data
     */
    async getUserData() {
        const session = await this.#getSessionData();
        if (session === null) throw "Expected current user to have a session";
        return {
            username: session.username
        };
    }
}

export const NS = new SessionAccessor(nextCookies);  // The session accessor to be used by nextjs
