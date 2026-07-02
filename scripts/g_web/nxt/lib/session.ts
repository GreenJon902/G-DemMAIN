import "server-only";
import { SessionAccessor, Area, AreaPermission } from "@g/com/lib/auth";
import { cookies } from "next/headers";
import { forbidden, unauthorized } from "next/navigation";

// This only needs instantiating once, and a macro makes dev easier to
export const NS = new SessionAccessor(cookies);

/**
 * Checks if the current user holds at least the given permission level for the given area.
 * Calls unauthorized() or forbidden() as appropriate if not.
 *
 * @param strict - Whether this should be strict or optimistic. Default false.
 */
export async function requirePermission<A extends Area>(area: A, minLevel: AreaPermission<A>, strict: boolean = false) {
    const check = strict ? NS.strictCheckPermission : NS.optimisticCheckPermission;

    if (!await check(area, minLevel)) {
        // User not authorised to view this route

        // Check if user has session
        if (await NS.hasSession()) {
            // User has a session, just not permissions
            // So send the forbidden page
            forbidden();
        } else {
            // User has no session
            // So send to the unauthorised page
            unauthorized();
        }
    }
}
