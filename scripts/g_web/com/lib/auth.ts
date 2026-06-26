/**
 * This file provides the utilities for session management for the whole project.
 */

import { getIronSession as getIronSession_ } from "iron-session";
import { C } from "./environ";
import { sendWebloginWebhook } from "./webhook";
import prisma from "./prisma";
import * as argon2 from "argon2";

const COOKIE_NAME = "auth";  // Name of the cookie that auth data is stored in

// Type matching iron-session's CookieStore. Same format as the return-type of next's cookies()
type Cookies = {
    get(name: string): { name: string; value: string } | undefined;
    set(...args: unknown[]): void;
};

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
        { type: "cookies", cookies: () => Cookies | Promise<Cookies> } |
        { type: "reqres", req: Request, res: Response };


    /**
     * Creates a new sessionAccessor.
     * The cookies getter function will only be called when data is accessed/modified.
     */
    constructor(...args: [cookies: () => Cookies | Promise<Cookies>] | [req: Request, res: Response]) {
        if (args.length === 2) {
            this.#sessionCookieArgsGetter = { type: "reqres", req: args[0], res: args[1] };
        } else {
            this.#sessionCookieArgsGetter = { type: "cookies", cookies: args[0] };
        }

        // Fix a weird js thing
        Object.getOwnPropertyNames(SessionAccessor.prototype).forEach((key) => {
            if (key !== "constructor") {
                const this_ = this as unknown as { [name: string]: () => void };  // Fix typescript
                this_[key] = this_[key].bind(this);
            }
        });
    }

    async #getIronSession() {
        const SESSION_OPTIONS = { password: C().SESSION_PASSWORD, cookieName: COOKIE_NAME, cookieOptions: { secure: false } };
        if (this.#sessionCookieArgsGetter.type === "cookies") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return await getIronSession_<WrappedSessionData>(await this.#sessionCookieArgsGetter.cookies() as any, SESSION_OPTIONS);
        } else if (this.#sessionCookieArgsGetter.type === "reqres") {
            return await getIronSession_<WrappedSessionData>(this.#sessionCookieArgsGetter.req, this.#sessionCookieArgsGetter.res, SESSION_OPTIONS);
        } else {
            throw new Error("Unkown method");
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

    /**
     * Checks if the user session has panel access as a flag. This does not actually confirm with the database, rather it uses a "cached" value.
     * This is enough to show general data, but should not be used authorization to modify data or view sensititve data.
     */
    async optimisticCheckUser(area: keyof SessionData["optimistic"]) {
        const session = await this.#getSessionData();
        if (session === null) return false;
        return session.optimistic[area] === true;
    }

    /**
     * Like optimisticCheckUser but throws an error if the test fails.
     */
    async optimisticRequireUser(area: keyof SessionData["optimistic"]) {
        if (!this.optimisticCheckUser(area)) throw new Error("User has no permission to access ") + area;
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

        // Check with database if user exists and password is correct
        const user = await prisma().user.findUnique({
            where: { username }
        });
        if (user === null || !await argon2.verify(user.password_hash, password)) return false;

        // Create session for user
        const session = await this.#getIronSession();
        session.hasSession = true;
        session.data = {
            username: username,
            optimistic: {
                panel: user.has_panel_access
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
     */
    async getUserData() {
        const session = await this.#getSessionData();
        if (session === null) throw new Error("Expected current user to have a session");
        return {
            username: session.username
        };
    }
}
