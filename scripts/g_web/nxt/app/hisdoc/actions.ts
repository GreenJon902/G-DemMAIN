"use server";

import { redirect, notFound } from "next/navigation";
import { NS } from "@/lib/session";
import prisma from "@g/com/lib/prisma/client";
import { deleteEvent as deleteEventGateway } from "@g/com/lib/prisma/hisdoc/event";
import { deletePerson as deletePersonGateway } from "@g/com/lib/prisma/hisdoc/person";
import { deleteTag as deleteTagGateway } from "@g/com/lib/prisma/hisdoc/tag";
import { sendHisDocWebhook } from "@g/com/lib/webhook";
import { resolvePersonDisplayName } from "./changelog/lib/personDisplayName";
import { parseTimelineFilters } from "./lib/timeline-filter";
import { fetchTimelinePage, TimelineEvent } from "./lib/timeline-data";
import { type ActionResult, changelogNoteSchema, resolveActor, runMutation } from "./lib/actionHelpers";

// The add/edit (form-submission) actions live in form/actions.tsx; this file holds the actions
// used by the entity detail pages and the timeline

/**
 * Server action: soft-deletes a HisDoc event.
 * Requires hisdoc editor access. Redirects to the timeline on success;
 * returns a human-readable error otherwise.
 *
 * @param id - The id of the event to delete.
 * @param note - The changelog note explaining the deletion.
 */
export async function deleteEvent(id: number, note: string): Promise<ActionResult> {
    await NS.strictRequirePermission("hisdoc", "editor");
    const actor = await resolveActor();

    const existing = await prisma().hd_event.findUnique({ where: { id, soft_deleted: false } });
    if (!existing) notFound();

    const failure = await runMutation(async () => {
        const changelogNote = changelogNoteSchema.parse(note);
        await deleteEventGateway({ userId: actor.userId }, changelogNote, id);

        sendHisDocWebhook("event", "delete", id, existing.name, actor.userId, actor.username, changelogNote);
    });
    if (failure) return failure;

    // redirect throws internally, so it must run outside runMutation's try/catch
    redirect("/hisdoc");
}

/**
 * Server action: soft-deletes a HisDoc person.
 * Requires hisdoc admin access. Redirects to the persons list on success;
 * returns a human-readable error otherwise.
 *
 * @param id - The id of the person to delete.
 * @param note - The changelog note explaining the deletion.
 */
export async function deletePerson(id: number, note: string): Promise<ActionResult> {
    await NS.strictRequirePermission("hisdoc", "admin");
    const actor = await resolveActor();

    const existing = await prisma().hd_person.findUnique({ where: { id, soft_deleted: false } });
    if (!existing) notFound();

    const failure = await runMutation(async () => {
        const changelogNote = changelogNoteSchema.parse(note);
        await deletePersonGateway({ userId: actor.userId }, changelogNote, id);

        const displayName = await resolvePersonDisplayName(existing);
        sendHisDocWebhook("person", "delete", id, displayName, actor.userId, actor.username, changelogNote);
    });
    if (failure) return failure;

    redirect("/hisdoc/persons");
}

/**
 * Server action: soft-deletes a HisDoc tag.
 * Requires hisdoc admin access. Redirects to the tags list on success;
 * returns a human-readable error otherwise.
 *
 * @param id - The id of the tag to delete.
 * @param note - The changelog note explaining the deletion.
 */
export async function deleteTag(id: number, note: string): Promise<ActionResult> {
    await NS.strictRequirePermission("hisdoc", "admin");
    const actor = await resolveActor();

    const existing = await prisma().hd_tag.findUnique({ where: { id, soft_deleted: false } });
    if (!existing) notFound();

    const failure = await runMutation(async () => {
        const changelogNote = changelogNoteSchema.parse(note);
        await deleteTagGateway({ userId: actor.userId }, changelogNote, id);

        sendHisDocWebhook("tag", "delete", id, existing.name, actor.userId, actor.username, changelogNote);
    });
    if (failure) return failure;

    redirect("/hisdoc/tags");
}

/**
 * Server action: fetches one page of timeline events matching the given filter query string.
 * Public — the timeline has no authentication requirement. Shared by InfiniteTimeline's
 * client-side re-fetches (initial filtering, and "load more"); the initial server-rendered page
 * calls fetchTimelinePage directly instead, since it's already running on the server.
 *
 * @param qs - URL-encoded filter query string, same format as the timeline page's search params.
 * @param cursor - id of the last event already loaded, or null to start from the beginning.
 */
export async function getTimelinePage(
    qs: string,
    cursor: number | null
): Promise<{ events: TimelineEvent[]; hasMore: boolean }> {
    const filters = parseTimelineFilters(new URLSearchParams(qs));
    return fetchTimelinePage(filters, cursor);
}
