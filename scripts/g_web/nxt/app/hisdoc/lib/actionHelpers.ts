import "server-only";
import { z } from "zod";
import prisma from "@g/com/lib/prisma/client";
import { NS } from "@/lib/session";

/**
 * Result of a mutating server action: an object carrying a human-readable error message, or
 * undefined on success (in which case the action has already redirected). Errors are *returned*
 * rather than thrown because Next.js masks thrown server-action error messages in production.
 */
export type ActionResult = { error: string } | undefined;

/** Zod schema for the changelog note required on edits and deletes. */
export const changelogNoteSchema = z.string().trim().min(1);

/** Extracts a human-readable message from a caught error, flattening Zod issues into one line. */
export function errorMessage(error: unknown): string {
    if (error instanceof z.ZodError) {
        return error.issues
            .map(issue => (issue.path.length > 0 ? issue.path.join(".") + ": " : "") + issue.message)
            .join("; ");
    }
    return error instanceof Error ? error.message : String(error);
}

/**
 * Runs a mutation body, converting anything it throws (Zod validation, gateway uniqueness /
 * soft-delete guards, DB errors) into a returned ActionResult error. Callers redirect afterwards —
 * redirect itself throws internally, so it must never run inside this wrapper.
 */
export async function runMutation(fn: () => Promise<void>): Promise<ActionResult> {
    try {
        await fn();
    } catch (error) {
        return { error: errorMessage(error) };
    }
}

/**
 * Resolves the acting user's database id and username from the session — the session only caches
 * the username. Throws if the authenticated user no longer exists in the database.
 */
export async function resolveActor(): Promise<{ userId: number, username: string }> {
    const userData = await NS.getUserData();
    const userRecord = await prisma().user.findUnique({
        where: { username: userData.username },
        select: { id: true }
    });
    if (!userRecord) throw new Error("Authenticated user not found in database");
    return { userId: userRecord.id, username: userData.username };
}
