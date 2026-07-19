/**
 * The only sanctioned way to mutate hd_tag. Every write is paired with a hd_changelog row in the
 * same transaction — see doc/Databases.md for the tracked-table policy this enforces.
 */

import prisma from "../client";
import type { hd_tag, Prisma } from "../../../generated/prisma/client";
import { hd_changelog_action, hd_changelog_what } from "../../../generated/prisma/client";
import { type Actor, writeChangelog } from "./changelog";

export type TagInput = {
    name: string,
    description: string,
    color: number
};

/**
 * Throws a human-readable error if another tag already uses `name`. Pre-checks the
 * uq_hd_tag_name constraint, which spans soft-deleted rows too — so no soft_deleted filter here.
 *
 * @param excludeId - The tag being updated, exempt from the clash check.
 */
async function assertTagNameFree(tx: Prisma.TransactionClient, name: string, excludeId?: number): Promise<void> {
    const clash = await tx.hd_tag.findFirst({ where: { name, ...(excludeId !== undefined && { id: { not: excludeId } }) } });
    if (clash) throw new Error(`A tag named "${name}" already exists (possibly deleted)`);
}

/** Creates a new tag and records the creation in the changelog. Rejects duplicate names. */
export async function createTag(actor: Actor, message: string, data: TagInput): Promise<hd_tag> {
    return prisma().$transaction(async (tx) => {
        await assertTagNameFree(tx, data.name);
        const tag = await tx.hd_tag.create({ data });
        await writeChangelog(tx, actor, message, hd_changelog_what.TAG, tag.id, hd_changelog_action.INSERT, null, tag);
        return tag;
    });
}

/** Updates a tag and records the change in the changelog. Rejects soft-deleted tags and duplicate names. */
export async function updateTag(actor: Actor, message: string, id: number, data: Partial<TagInput>): Promise<hd_tag> {
    return prisma().$transaction(async (tx) => {
        const before = await tx.hd_tag.findUniqueOrThrow({ where: { id } });
        if (before.soft_deleted) throw new Error(`Cannot update soft-deleted hd_tag ${id}`);
        if (data.name !== undefined) await assertTagNameFree(tx, data.name, id);
        const after = await tx.hd_tag.update({ where: { id }, data });
        await writeChangelog(tx, actor, message, hd_changelog_what.TAG, id, hd_changelog_action.UPDATE, before, after);
        return after;
    });
}

/** Soft-deletes a tag and records the deletion in the changelog. Rejects already soft-deleted tags. */
export async function deleteTag(actor: Actor, message: string, id: number): Promise<void> {
    await prisma().$transaction(async (tx) => {
        const before = await tx.hd_tag.findUniqueOrThrow({ where: { id } });
        if (before.soft_deleted) throw new Error(`Cannot delete already soft-deleted hd_tag ${id}`);
        const after = await tx.hd_tag.update({ where: { id }, data: { soft_deleted: true } });
        await writeChangelog(tx, actor, message, hd_changelog_what.TAG, id, hd_changelog_action.DELETE, before, after);
    });
}
