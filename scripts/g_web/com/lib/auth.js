/**
 * This file provides the utilities for session management for the whole project.
 */
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _SessionAccessor_instances, _SessionAccessor_sessionCookieArgsGetter, _SessionAccessor_getIronSession, _SessionAccessor_getSessionData;
import { getIronSession as getIronSession_ } from "iron-session";
import { C } from "./environ";
import { cookies as nextCookies } from "next/headers";
import { sendWebloginWebhook } from "./webhook";
import prisma from "./prisma";
import * as argon2 from "argon2";
const COOKIE_NAME = "auth"; // Name of the cookie that auth data is stored in
/**
 * This is the generic interface through which the iron-session can be accessed.
 * However how this loads and saves the iron session depends on the arguments with which this class is instantiated.
 */
export class SessionAccessor {
    /**
     * Creates a new sessionAccessor.
     * The cookies getter function will only be called when data is accessed/modified.
     */
    constructor(...cookies) {
        _SessionAccessor_instances.add(this);
        _SessionAccessor_sessionCookieArgsGetter.set(this, void 0);
        if (cookies.length === 2) {
            __classPrivateFieldSet(this, _SessionAccessor_sessionCookieArgsGetter, { type: "reqres", req: cookies[0], res: cookies[1] }, "f");
        }
        else {
            __classPrivateFieldSet(this, _SessionAccessor_sessionCookieArgsGetter, { type: "cookies", cookies: cookies[0] }, "f");
        }
        // Fix a weird js thing
        Object.getOwnPropertyNames(SessionAccessor.prototype).forEach((key) => {
            if (key !== "constructor") {
                const this_ = this; // Fix typescript
                this_[key] = this_[key].bind(this);
            }
        });
    }
    async optimisticCheckUser(area) {
        const session = await __classPrivateFieldGet(this, _SessionAccessor_instances, "m", _SessionAccessor_getSessionData).call(this);
        if (session === null)
            return false;
        return session.optimistic[area] === true;
    }
    /**
     * Like optimisticCheckUser but throws an error if the test fails.
     */
    async optimisticRequireUser(area) {
        if (!this.optimisticCheckUser(area))
            throw "User has no permission to access " + area;
    }
    /**
     * Returns true if the user has an active session.
     */
    async hasSession() {
        return (await __classPrivateFieldGet(this, _SessionAccessor_instances, "m", _SessionAccessor_getSessionData).call(this)) !== null;
    }
    /**
     * Checks if a user exists, and if they do then creates a session for that user.
     * @returns True if the session was sucessfully created, and false otherwise.
     */
    async attemptCreateSession(username, password) {
        // TODO: What to do if a session already exists
        // Check with database if user exists and password is correct
        const user = await prisma().user.findUnique({
            where: { username }
        });
        if (user === null || !await argon2.verify(user.password_hash, password))
            return false;
        // Create session for user
        const session = await __classPrivateFieldGet(this, _SessionAccessor_instances, "m", _SessionAccessor_getIronSession).call(this);
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
        const session = await __classPrivateFieldGet(this, _SessionAccessor_instances, "m", _SessionAccessor_getIronSession).call(this);
        session.destroy();
    }
    /**
     * Gets the data of the current logged-in user.
     * Note, this expects the user to be logged in.
     * // TODO: Document return data
     */
    async getUserData() {
        const session = await __classPrivateFieldGet(this, _SessionAccessor_instances, "m", _SessionAccessor_getSessionData).call(this);
        if (session === null)
            throw "Expected current user to have a session";
        return {
            username: session.username
        };
    }
}
_SessionAccessor_sessionCookieArgsGetter = new WeakMap(), _SessionAccessor_instances = new WeakSet(), _SessionAccessor_getIronSession = async function _SessionAccessor_getIronSession() {
    const SESSION_OPTIONS = { password: C().SESSION_PASSWORD, cookieName: COOKIE_NAME, cookieOptions: { secure: false } };
    if (__classPrivateFieldGet(this, _SessionAccessor_sessionCookieArgsGetter, "f").type === "cookies") {
        return await getIronSession_(await __classPrivateFieldGet(this, _SessionAccessor_sessionCookieArgsGetter, "f").cookies(), SESSION_OPTIONS);
    }
    else if (__classPrivateFieldGet(this, _SessionAccessor_sessionCookieArgsGetter, "f").type === "reqres") {
        return await getIronSession_(__classPrivateFieldGet(this, _SessionAccessor_sessionCookieArgsGetter, "f").req, __classPrivateFieldGet(this, _SessionAccessor_sessionCookieArgsGetter, "f").res, SESSION_OPTIONS);
    }
    else {
        throw "Unkown method";
    }
}, _SessionAccessor_getSessionData = 
/**
 * Gets the session data of the current user, or null if there is no session.
 */
async function _SessionAccessor_getSessionData() {
    const session = await __classPrivateFieldGet(this, _SessionAccessor_instances, "m", _SessionAccessor_getIronSession).call(this);
    if (session.hasSession !== true)
        return null; // If user has no session then return null
    return session.data;
};
export const NS = new SessionAccessor(nextCookies); // The session accessor to be used by nextjs
