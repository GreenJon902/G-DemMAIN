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

type AreaConfig = {
    readonly levels: readonly string[],
    readonly default: string | null,  // Null means no access by default
    readonly sudoFrom: string | null  // This level and above require sudo; null means none required. This only applies to write operations; read never requires sudo
}

// Definition for the different restricted areas.
//  * sudoFrom - The minimum level that requires sudo. null means no sudo is ever required by this area. If a user has 2FA enabled, sudo is always required regardless of this setting.
// Note, the permission specification must be manually mirrored in the database schema - `doc/Databases.md`.
const AREAS = {
    panel: {
        levels: ["viewer", "admin"] as const,
        default: null,      // null = no panel access by default
        sudoFrom: "admin"   // admin-level panel actions require sudo
    },
    hisdoc: {
        levels: ["viewer", "editor", "admin"] as const,
        default: "viewer",  // all users can view hisdoc by default
        sudoFrom: null      // no sudo required for hisdoc operations
    }
} satisfies Record<string, AreaConfig>;

export type Area = keyof typeof AREAS;
/** The valid permission level strings for a given area. */
export type AreaPermission<A extends Area> = typeof AREAS[A]["levels"][number];

type StoredPermissions = { [A in Area]: AreaPermission<A> | null };

/** Returns true if userLevel meets or exceeds minLevel in the given ordered levels array. */
function checkMinPermission(levels: readonly string[], userLevel: string | null, minLevel: string): boolean {
    if (userLevel === null) return false;
    return levels.indexOf(userLevel) >= levels.indexOf(minLevel);
}

// Extract stored permissions for each area from a database user
function userToPermissions(user: {
    panel_permission: "viewer" | "admin" | null,
    hisdoc_permission: "viewer" | "editor" | "admin"
}): StoredPermissions {
    return {
        panel: user.panel_permission,
        hisdoc: user.hisdoc_permission
    };
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
        permissions: z.object({
            panel: z.enum(AREAS.panel.levels).nullable(),
            hisdoc: z.enum(AREAS.hisdoc.levels).nullable()
        })
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
     * Checks if the user's cached session data grants at least the given permission level for the given area.
     * Does not consult the database — use strictCheckPermission for sensitive operations.
     */
    async optimisticCheckPermission<A extends Area>(area: A, minLevel: AreaPermission<A>): Promise<boolean> {
        const [session] = await this.#getIronSession();
        if (session === null) return false;
        const permissions = session.optimistic.permissions as unknown as StoredPermissions;
        return checkMinPermission(AREAS[area].levels, permissions[area], minLevel);
    }

    /**
     * Like optimisticCheckPermission but throws if the optimistic check fails.
     */
    async optimisticRequirePermission<A extends Area>(area: A, minLevel: AreaPermission<A>): Promise<void> {
        if (!await this.optimisticCheckPermission(area, minLevel))
            throw new Error(`User does not have optimistic permission '${minLevel}' for area '${area}'`);
    }

    /**
     * Checks area permission against the database and validates sudo mode if required.
     * Use this for sensitive operations where the cached session data is not sufficient.
     * This is slower than an optimistic check so should only be used when required.
     */
    async strictCheckPermission<A extends Area>(area: A, minLevel: AreaPermission<A>): Promise<boolean> {
        const [session] = await this.#getIronSession();
        if (session === null) return false;

        const user = await prisma().user.findUnique({
            where: { id: session.uid },
            select: { panel_permission: true, hisdoc_permission: true, tfa_secret: true }
        });
        if (user === null) throw new Error(`Session references non-existent user id ${session.uid}`);

        const { levels, sudoFrom } = AREAS[area];
        const userPermission = userToPermissions(user)[area];
        if (!checkMinPermission(levels, userPermission, minLevel)) return false;

        // Check sudo mode if this level requires it by area config, or if the user has 2FA enabled
        const areaRequiresSudo = sudoFrom !== null && checkMinPermission(levels, minLevel, sudoFrom);
        const needsSudo = areaRequiresSudo || user.tfa_secret !== null;
        if (needsSudo && !this.#sudoIsActive(session.sudoVerifiedAt)) return false;

        return true;
    }

    /**
     * Like strictCheckPermission but throws if the strict check fails.
     */
    async strictRequirePermission<A extends Area>(area: A, minLevel: AreaPermission<A>): Promise<void> {
        if (!await this.strictCheckPermission(area, minLevel))
            throw new Error(`User does not have strict permission '${minLevel}' for area '${area}'`);
    }

    /**
     * Returns whether the user needs to enter sudo mode to pass a strict check for the given area and permission level.
     * Also triggers when sudo mode is within SUDO_WARN_MS of expiring, so the caller can prompt
     * re-entry before the time-window closes mid-action.
     * Throws if the user has no session.
     */
    async getAreaSudoStatus<A extends Area>(area: A, minLevel: AreaPermission<A>): Promise<{ requiresSudo: false } | { requiresSudo: true, tfaEnabled: boolean }> {
        const [session] = await this.#getIronSession();
        if (session === null) throw new Error("getAreaSudoStatus called with no active session");

        const user = await prisma().user.findUnique({
            where: { id: session.uid },
            select: { tfa_secret: true }
        });
        if (user === null) throw new Error(`Session references non-existent user id ${session.uid}`);

        const { levels, sudoFrom } = AREAS[area];
        const tfaEnabled = user.tfa_secret !== null;
        // Check if we'll require the user to enter sudo mode — area requires it for this level, or user has 2FA enabled
        const areaRequiresSudo = sudoFrom !== null && checkMinPermission(levels, minLevel, sudoFrom);
        const requiresSudo = areaRequiresSudo || tfaEnabled;
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
            where: { username },
            select: { id: true, password_hash: true, panel_permission: true, hisdoc_permission: true }
        });
        if (user === null || !await argon2.verify(user.password_hash, password)) return false;

        // Create session for user
        const [, session] = await this.#getIronSession();
        session.hasSession = true;
        session.data = {
            uid: user.id,
            optimistic: {
                username: username,
                permissions: userToPermissions(user)
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
