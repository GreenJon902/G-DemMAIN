/**
 * The only sanctioned way to mutate hd_person. Every write is paired with a hd_changelog row in
 * the same transaction — see doc/Databases.md for the tracked-table policy this enforces.
 */

import prisma from "../client";
import type { hd_person, Prisma } from "../../../generated/prisma/client";
import { hd_changelog_action, hd_changelog_what, hd_person_type } from "../../../generated/prisma/client";
import { type Actor, writeChangelog } from "./changelog";

export type PersonInput = {
    type: hd_person_type,
    data: string,
    linked_user_id?: number | null
};

/**
 * Throws a human-readable error if another person already uses this (type, data) pair.
 * Pre-checks the uq_hd_person_data constraint, which spans soft-deleted rows too — so no
 * soft_deleted filter here.
 *
 * @param excludeId - The person being updated, exempt from the clash check.
 */
async function assertPersonDataFree(tx: Prisma.TransactionClient, type: hd_person_type, data: string, excludeId?: number): Promise<void> {
    const clash = await tx.hd_person.findFirst({ where: { type, data, ...(excludeId !== undefined && { id: { not: excludeId } }) } });
    if (clash) throw new Error("A person with this type and data already exists (possibly deleted)");
}

/** Creates a new person and records the creation in the changelog. Rejects duplicate (type, data) pairs. */
export async function createPerson(actor: Actor, message: string, data: PersonInput): Promise<hd_person> {
    return prisma().$transaction(async (tx) => {
        await assertPersonDataFree(tx, data.type, data.data);
        const person = await tx.hd_person.create({ data });
        await writeChangelog(tx, actor, message, hd_changelog_what.PERSON, person.id, hd_changelog_action.INSERT, null, person);
        return person;
    });
}

/** Updates a person and records the change in the changelog. Rejects soft-deleted persons and duplicate (type, data) pairs. */
export async function updatePerson(actor: Actor, message: string, id: number, data: Partial<PersonInput>): Promise<hd_person> {
    return prisma().$transaction(async (tx) => {
        const before = await tx.hd_person.findUniqueOrThrow({ where: { id } });
        if (before.soft_deleted) throw new Error(`Cannot update soft-deleted hd_person ${id}`);
        // The unique pair is (type, data) as a whole, so validate the merged (existing + patched) pair whenever either changes
        if (data.type !== undefined || data.data !== undefined) {
            await assertPersonDataFree(tx, data.type ?? before.type, data.data ?? before.data, id);
        }
        const after = await tx.hd_person.update({ where: { id }, data });
        await writeChangelog(tx, actor, message, hd_changelog_what.PERSON, id, hd_changelog_action.UPDATE, before, after);
        return after;
    });
}

/** Soft-deletes a person and records the deletion in the changelog. Rejects already soft-deleted persons. */
export async function deletePerson(actor: Actor, message: string, id: number): Promise<void> {
    await prisma().$transaction(async (tx) => {
        const before = await tx.hd_person.findUniqueOrThrow({ where: { id } });
        if (before.soft_deleted) throw new Error(`Cannot delete already soft-deleted hd_person ${id}`);
        const after = await tx.hd_person.update({ where: { id }, data: { soft_deleted: true } });
        await writeChangelog(tx, actor, message, hd_changelog_what.PERSON, id, hd_changelog_action.DELETE, before, after);
    });
}
