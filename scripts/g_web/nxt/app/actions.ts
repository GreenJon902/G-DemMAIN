"use server";

import { Area, AreaPermission } from "@g/com/lib/auth";
import { NS } from "@/lib/session";

/**
 * Verify a TOTP code and enter sudo mode if correct.
 */
export async function enterSudoAction(code: string): Promise<boolean> {
    try {
        return await NS.enterSudo(code);
    } catch (e) {
        // instanceof won't work here — com's compiled dist loads its own copy of @otplib/core,
        // so the class objects are different module instances from nxt's copy.
        if (e instanceof Error && ["TokenFormatError", "TokenLengthError"].includes(e.name)) return false;
        throw e;
    }
}

/**
 * Check whether the current user needs to enter sudo mode to pass a strict check for the given area and permission level.
 */
export async function getAreaSudoStatusAction<A extends Area>(area: A, minLevel: AreaPermission<A>) {
    return NS.getAreaSudoStatus(area, minLevel);
}
