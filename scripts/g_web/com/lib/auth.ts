/**
 * This file provides the utilities for session management for the whole project.
 */

import { getIronSession as getIronSession_ } from "iron-session";
import { C } from "./environ";
import { sendWebloginWebhook } from "./webhook";
import prisma from "./prisma";
import * as argon2 from "argon2";

const COOKIE_NAME = "auth";  // Name of the cookie that auth data is stored in
const TFA_WINDOW_MS = 30 * 60 * 1000;  // How long a 2FA verification remains valid
const TFA_WARN_MS = 5 * 1000;          // Warn if TFA expires within this window

// Definition for the different restricted areas
//  * requireTfa - Strict checks only. If true then 2FA must be enabled and verified. If false then 2FA verified only if the user has it enabled.
const AREAS = {
    panel: { requireTfa: true }
} satisfies Record<string, { requireTfa: boolean }>;

type Area = keyof typeof AREAS;

// Extract the areas a user can access from a database-user
function userToAreaAccess(user: { has_panel_access: boolean }): Record<Area, boolean> {
    return { panel: user.has_panel_access };
}

// Structural equivalent of iron-session's unexported CookieStore
type Cookies = {
    get(name: string): { name: string; value: string } | undefined;
    set(...args: unknown[]): void;
};

type WrappedSessionData = {
    hasSession: true,  // Constant flag
    data: SessionData
}
type SessionData = {  // Wrapping it again makes it easier to set the whole thing in one
    uid: number,                         // User ID 
    optimistic: {                        // Cached data, not to be used for sensitive operations
        username: string,
        areaAccess: Record<Area, boolean>
    },
    tfaVerifiedAt: number | null         // Timestamp of last 2FA verification, null if not yet verified
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
     * Checks if the user's cached session data grants access to the given area.
     * Does not consult the database — use strictCheckUser for sensitive operations.
     */
    async optimisticCheckUser(area: Area) {
        const session = await this.#getSessionData();
        if (session === null) return false;
        return session.optimistic.areaAccess[area] === true;
    }

    /**
     * Like optimisticCheckUser but throws if the optimistic check fails.
     */
    async optimisticRequireUser(area: Area) {
        if (!await this.optimisticCheckUser(area)) throw new Error("User does not have optimistic permission to access " + area);
    }

    /**
     * Checks area access against the database and validates 2FA if required.
     * Use this for sensitive operations where the cached session data is not sufficient.
     * This is slower than an optimistic check so should only be used when required.
     */
    async strictCheckUser(area: Area): Promise<boolean> {
        const session = await this.#getSessionData();
        if (session === null) return false;

        const user = await prisma().user.findUnique({
            where: { id: session.uid },
            select: { has_panel_access: true, totp_secret: true }
        });
        if (user === null) throw new Error(`Session references non-existent user id ${session.uid}`);

        // Check user can access area
        if (!userToAreaAccess(user)[area]) return false;

        // Check 2FA if required by area config, or required if user has it enabled
        const needsTfa = AREAS[area].requireTfa || user.totp_secret !== null;
        if (needsTfa) {
            if (session.tfaVerifiedAt === null || Date.now() - session.tfaVerifiedAt > TFA_WINDOW_MS) return false;
        }

        return true;
    }

    /**
     * Like strictCheckUser but throws if the strict check fails.
     */
    async strictRequireUser(area: Area) {
        if (!await this.strictCheckUser(area)) throw new Error("User does not have strict permission to access " + area);
    }

    /**
     * Returns whether the user needs to (re-)verify 2FA to pass a strict check for the given area.
     * Also triggers when the current verification is within TFA_WARN_MS of expiring, so the caller can prompt re-verification before the time-window closes mid-action.
     * Throws if the user has no session.
     */
    async getTfaVerificationStatus(area: Area): Promise<{ requiresTfa: false } | { requiresTfa: true, tfaEnabled: boolean }> {
        const session = await this.#getSessionData();
        if (session === null) throw new Error("needsTfaVerification called with no active session");

        const user = await prisma().user.findUnique({
            where: { id: session.uid },
            select: { totp_secret: true }
        });
        if (user === null) throw new Error(`Session references non-existent user id ${session.uid}`);

        // Check if we'll require the user to enter tfa - they have it enabled or the area requires it
        const tfaEnabled = user.totp_secret !== null;
        const requiresTfa = AREAS[area].requireTfa || tfaEnabled;
        if (!requiresTfa) return { requiresTfa: false };

        // tfa is required, check if user has an active session
        const noTfaSession = session.tfaVerifiedAt === null
            || Date.now() - session.tfaVerifiedAt > TFA_WINDOW_MS - TFA_WARN_MS;
        if (!noTfaSession) return { requiresTfa: false };

        return { requiresTfa: true, tfaEnabled };
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
            uid: user.id,
            optimistic: {
                username: username,
                areaAccess: userToAreaAccess(user)
            },
            tfaVerifiedAt: null
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
     * Note, some of this data is optimistic/cached so may not be the most recent version.
     */
    async getUserData() {
        const session = await this.#getSessionData();
        if (session === null) throw new Error("Expected current user to have a session");
        return {
            username: session.optimistic.username
        };
    }
}
