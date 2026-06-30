/**
 * This file provides the utilities for session management for the whole project.
 */

import { getIronSession as getIronSession_ } from "iron-session";
import { C } from "./environ";
import { sendWebloginWebhook } from "./webhook";
import prisma from "./prisma";
import * as argon2 from "argon2";
import { verify as otplibVerify } from "otplib";
import { z } from "zod";
import type { ReadonlyDeep } from "type-fest";

const COOKIE_NAME = "auth";  // Name of the cookie that auth data is stored in
import { SUDO_WINDOW_MS } from "./authConstants";
export { SUDO_WINDOW_MS };
const SUDO_WARN_MS = 5 * 1000;                 // Warn if sudo mode expires within this time-window
const TFA_EPOCH_TOLERANCE: number | [number, number] = [5, 0];  // Five seconds into past, none into future

// Definition for the different restricted areas
//  * requireSudo - Strict checks only. If true then 2FA must be enabled and sudo mode must be active. If false then sudo mode is required only if the user has 2FA enabled.
const AREAS = {
    panel: { requireSudo: true },
    hisdoc: { requireSudo: false }
} satisfies Record<string, { requireSudo: boolean }>;

export type Area = keyof typeof AREAS;

// Extract the areas a user can access from a database-user
function userToAreaAccess(user: { has_panel_access: boolean, has_hisdoc_access: boolean }): Record<Area, boolean> {
    return { panel: user.has_panel_access, hisdoc: user.has_hisdoc_access };
}

// Structural equivalent of iron-session's unexported CookieStore
type Cookies = {
    get(name: string): { name: string; value: string } | undefined;
    set(...args: unknown[]): void;
};

const SessionDataSchema = z.object({
    uid: z.number(),                        // User ID
    optimistic: z.object({                  // Cached data, not to be used for sensitive operations
        username: z.string(),
        areaAccess: z.object(
            Object.fromEntries(Object.keys(AREAS).map(k => [k, z.boolean()])) as { [K in Area]: z.ZodBoolean }
        )
    }),
    sudoVerifiedAt: z.number().nullable()   // Timestamp when sudo mode was last entered, null if not active
});
type SessionData = z.infer<typeof SessionDataSchema>;

const WrappedSessionDataSchema = z.object({
    hasSession: z.literal(true),            // Constant flag
    data: SessionDataSchema
});
type WrappedSessionData = z.infer<typeof WrappedSessionDataSchema>;


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

    // Returns true if sudo mode is currently active.
    // Pass warn=true to treat sessions within SUDO_WARN_MS of expiry as inactive (used to prompt re-entry early).
    #sudoIsActive(sudoVerifiedAt: number | null, warn = false): boolean {
        if (sudoVerifiedAt === null) return false;
        const window = warn ? SUDO_WINDOW_MS - SUDO_WARN_MS : SUDO_WINDOW_MS;
        return Date.now() - sudoVerifiedAt <= window;
    }

    async #getIronSession() {
        const SESSION_OPTIONS = { password: C().SESSION_PASSWORD, cookieName: COOKIE_NAME, cookieOptions: { secure: false } };
        let session;
        if (this.#sessionCookieArgsGetter.type === "cookies") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            session = await getIronSession_<WrappedSessionData>(await this.#sessionCookieArgsGetter.cookies() as any, SESSION_OPTIONS);
        } else if (this.#sessionCookieArgsGetter.type === "reqres") {
            session = await getIronSession_<WrappedSessionData>(this.#sessionCookieArgsGetter.req, this.#sessionCookieArgsGetter.res, SESSION_OPTIONS);
        } else {
            throw new Error("Unkown method");
        }
        // If a session exists but its shape is wrong (e.g. stale cookie from a schema change), treat it as no session
        // We can't necessarily drop the session-cookie as in some contexts we are not able to mutate cookies here (e.g. calls from server-components)
        if (session.hasSession === true) {
            if (WrappedSessionDataSchema.safeParse(session).success) {
                return [session.data as ReadonlyDeep<SessionData>, session] as const;
            } else {
                console.log("Session cookie exists, but has invalid schema. This may be from a previous version.");
            }
        }
        return [null, session] as const;
    }

    /**
     * Checks if the user's cached session data grants access to the given area.
     * Does not consult the database — use strictCheckUser for sensitive operations.
     */
    async optimisticCheckUser(area: Area) {
        const [session] = await this.#getIronSession();
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
     * Checks area access against the database and validates sudo mode if required.
     * Use this for sensitive operations where the cached session data is not sufficient.
     * This is slower than an optimistic check so should only be used when required.
     */
    async strictCheckUser(area: Area): Promise<boolean> {
        const [session] = await this.#getIronSession();
        if (session === null) return false;

        const user = await prisma().user.findUnique({
            where: { id: session.uid },
            select: { has_panel_access: true, has_hisdoc_access: true, tfa_secret: true }
        });
        if (user === null) throw new Error(`Session references non-existent user id ${session.uid}`);

        // Check user can access area
        if (!userToAreaAccess(user)[area]) return false;

        // Check sudo mode if required by area config, or if the user has 2FA enabled
        const needsSudo = AREAS[area].requireSudo || user.tfa_secret !== null;
        if (needsSudo && !this.#sudoIsActive(session.sudoVerifiedAt)) return false;

        return true;
    }

    /**
     * Like strictCheckUser but throws if the strict check fails.
     */
    async strictRequireUser(area: Area) {
        if (!await this.strictCheckUser(area)) throw new Error("User does not have strict permission to access " + area);
    }

    /**
     * Returns whether the user needs to enter sudo mode to pass a strict check for the given area.
     * Also triggers when sudo mode is within SUDO_WARN_MS of expiring, so the caller can prompt
     * re-entry before the time-window closes mid-action.
     * Throws if the user has no session.
     */
    async getAreaSudoStatus(area: Area): Promise<{ requiresSudo: false } | { requiresSudo: true, tfaEnabled: boolean }> {
        const [session] = await this.#getIronSession();
        if (session === null) throw new Error("getAreaSudoStatus called with no active session");

        const user = await prisma().user.findUnique({
            where: { id: session.uid },
            select: { tfa_secret: true }
        });
        if (user === null) throw new Error(`Session references non-existent user id ${session.uid}`);

        // Check if we'll require the user to enter sudo mode - area requires it, or user has 2FA enabled
        const tfaEnabled = user.tfa_secret !== null;
        const requiresSudo = AREAS[area].requireSudo || tfaEnabled;
        if (!requiresSudo) return { requiresSudo: false };

        // Sudo is required; check if the user has an active (non-expiring) sudo session
        if (this.#sudoIsActive(session.sudoVerifiedAt, true)) return { requiresSudo: false };

        return { requiresSudo: true, tfaEnabled };
    }

    /**
     * Returns true if the user has an active session.
     */
    async hasSession() {
        const [data] = await this.#getIronSession();
        return data !== null;
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
        const [, session] = await this.#getIronSession();
        session.hasSession = true;
        session.data = {
            uid: user.id,
            optimistic: {
                username: username,
                areaAccess: userToAreaAccess(user)
            },
            sudoVerifiedAt: null
        };
        await session.save();
        sendWebloginWebhook(username);
        return true;
    }

    /**
     * Verifies a TOTP code against the user's stored secret and, if valid, enters sudo mode by
     * recording a timestamp in the session so subsequent strict checks pass.
     * Throws if there is no active session or the user has no TOTP secret configured.
     */
    async enterSudo(code: string): Promise<boolean> {
        const [sessionData, session] = await this.#getIronSession();
        if (sessionData === null) throw new Error("enterSudo called with no active session");

        const user = await prisma().user.findUnique({
            where: { id: sessionData.uid },
            select: { tfa_secret: true }
        });
        if (user === null) throw new Error(`Session references non-existent user id ${sessionData.uid}`);
        if (user.tfa_secret === null) throw new Error("User has no TOTP secret configured");

        if (!(await otplibVerify({ token: code, secret: user.tfa_secret, epochTolerance: TFA_EPOCH_TOLERANCE })).valid) return false;

        session.data.sudoVerifiedAt = Date.now();
        await session.save();
        return true;
    }

    /**
     * Returns the current sudo mode status for the user.
     * Throws if there is no active session.
     */
    async getSudoActiveStatus(): Promise<{ sudoVerifiedAt: number | null, tfaEnabled: boolean }> {
        const [session] = await this.#getIronSession();
        if (session === null) throw new Error("getSudoActiveStatus called with no active session");

        const user = await prisma().user.findUnique({
            where: { id: session.uid },
            select: { tfa_secret: true }
        });
        if (user === null) throw new Error(`Session references non-existent user id ${session.uid}`);

        return {
            sudoVerifiedAt: this.#sudoIsActive(session.sudoVerifiedAt) ? session.sudoVerifiedAt : null,
            tfaEnabled: user.tfa_secret !== null
        };
    }

    /**
     * Exits sudo mode by clearing the sudo verification timestamp.
     * Throws if there is no active session.
     */
    async exitSudo(): Promise<void> {
        const [sessionData, session] = await this.#getIronSession();
        if (sessionData === null) throw new Error("exitSudo called with no active session");

        session.data.sudoVerifiedAt = null;
        await session.save();
    }

    /**
     * Remove the session from the current user if they have one.
     */
    async dropSession() {
        const [, session] = await this.#getIronSession();
        session.destroy();
    }

    /**
     * Gets the data of the current logged-in user.
     * Note, this expects the user to be logged in.
     * Note, some of this data is optimistic/cached so may not be the most recent version.
     */
    async getUserData() {
        const [session] = await this.#getIronSession();
        if (session === null) throw new Error("Expected current user to have a session");
        return {
            username: session.optimistic.username
        };
    }
}
