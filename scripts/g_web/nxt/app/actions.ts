"use server";

import { Area } from "@g/com/lib/auth";
import { NS } from "@/lib/session";
import { forbidden } from "next/navigation";

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
 * Check whether the current user needs to enter sudo mode to pass a strict check for the given area.
 */
export async function getSudoStatusAction(area: Area) {
    return NS.getSudoStatus(area);
}
