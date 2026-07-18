/**
 * The only sanctioned way to mutate hd_person. Every write is paired with a hd_changelog row in
 * the same transaction — see doc/Databases.md for the tracked-table policy this enforces.
 */

import prisma from "../client";
import type { hd_person } from "../../../generated/prisma/client";
import { hd_changelog_action, hd_changelog_what, hd_person_type } from "../../../generated/prisma/client";
import { type Actor, writeChangelog } from "./changelog";

export type PersonInput = {
    type: hd_person_type,
    data: string,
    linked_user_id?: number | null
};

/** Creates a new person and records the creation in the changelog. */
export async function createPerson(actor: Actor, message: string, data: PersonInput): Promise<hd_person> {
    return prisma().$transaction(async (tx) => {
        const person = await tx.hd_person.create({ data });
        await writeChangelog(tx, actor, message, hd_changelog_what.PERSON, person.id, hd_changelog_action.INSERT, null, person);
        return person;
    });
}

/** Updates a person and records the change in the changelog. Rejects soft-deleted persons. */
export async function updatePerson(actor: Actor, message: string, id: number, data: Partial<PersonInput>): Promise<hd_person> {
    return prisma().$transaction(async (tx) => {
        const before = await tx.hd_person.findUniqueOrThrow({ where: { id } });
        if (before.soft_deleted) throw new Error(`Cannot update soft-deleted hd_person ${id}`);
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
