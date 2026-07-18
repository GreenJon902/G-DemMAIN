"use server";

import { z } from "zod";
import { redirect, notFound } from "next/navigation";
import { NS } from "@/lib/session";
import prisma from "@g/com/lib/prisma/client";
import { createEvent, updateEvent, deleteEvent as deleteEventGateway, type EventDateFields } from "@g/com/lib/prisma/hisdoc/event";
import { createPerson, updatePerson, deletePerson as deletePersonGateway } from "@g/com/lib/prisma/hisdoc/person";
import { createTag, updateTag, deleteTag as deleteTagGateway } from "@g/com/lib/prisma/hisdoc/tag";
import { sendHisDocWebhook } from "@g/com/lib/webhook";
import { hd_person_type } from "@g/com/prisma/enums";
import { parseFlexiDateForm } from "./lib/flexidate";
import { hexToColor } from "./lib/color";
import { resolvePersonDisplayName } from "./changelog/lib/personDisplayName";
import { parseTimelineFilters } from "./lib/timeline-filter";
import { fetchTimelinePage, TimelineEvent } from "./lib/timeline-data";

/** Zod schema for fields shared by both add and edit. */
const eventFieldSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().min(1),
    // Empty string is treated the same as absent — store null in both cases
    details: z.string().optional().transform(v => v || null)
});

/** Zod schema for the changelog note required on edits. */
const changelogNoteSchema = z.string().min(1);

// Mirrors chk_hd_person_minecraft_uuid (doc/Databases.md) — a 36-char hyphenated Minecraft UUID
const MINECRAFT_UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Zod schema for the person form fields. */
const personFieldSchema = z.object({
    type: z.enum(hd_person_type),
    data: z.string().min(1).max(255)
}).refine(
    v => v.type !== hd_person_type.MINECRAFT || MINECRAFT_UUID_REGEX.test(v.data),
    { message: "MINECRAFT persons require data to be a hyphenated Minecraft UUID" }
);

/** Zod schema for the tag form fields. Converts the colour input's "#rrggbb" into the stored int. */
const tagFieldSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().min(1),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).transform(hexToColor)
});

/**
 * Parses the shared form fields (name, description, details, tag_ids, person_ids,
 * related_event_ids) from the given FormData. Throws a Zod error if text fields are invalid.
 */
function parseEventFormFields(formData: FormData) {
    const { name, description, details } = eventFieldSchema.parse({
        name: formData.get("name"),
        description: formData.get("description"),
        // Map null (absent field) to undefined so Zod treats it as optional
        details: formData.get("details") ?? undefined
    });

    const tag_ids = (formData.getAll("tag_ids") as string[]).map(Number).filter(n => !isNaN(n));
    const person_ids = (formData.getAll("person_ids") as string[]).map(Number).filter(n => !isNaN(n));

    // related_event_ids arrives as a single comma-separated string
    const relatedStr = formData.get("related_event_ids");
    const related_event_ids = typeof relatedStr === "string" && relatedStr.trim()
        ? relatedStr.split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
        : [];

    return { name, description, details, tag_ids, person_ids, related_event_ids };
}

/**
 * Validates the structural invariants of a parsed FlexiDate and throws if any are violated.
 * These rules are also enforced by the database; this is a belt-and-suspenders check.
 *
 * @param flexiDate - The parsed FlexiDate to validate.
 */
function assertFlexiDateInvariants(flexiDate: NonNullable<ReturnType<typeof parseFlexiDateForm>>) {
    if (flexiDate.event_date_type === "centered") {
        if (
            flexiDate.event_date_units === null ||
            flexiDate.event_date_diff === null ||
            flexiDate.event_date2 !== null
        ) {
            throw new Error("Invalid centered FlexiDate: units and diff must be set, date2 must be null");
        }
    } else {
        if (
            flexiDate.event_date_units !== null ||
            flexiDate.event_date_diff !== null ||
            flexiDate.event_date2 === null ||
            flexiDate.event_date1 > flexiDate.event_date2
        ) {
            throw new Error("Invalid ranged FlexiDate: units and diff must be null, date2 must be set and >= date1");
        }
    }
}

/**
 * Resolves the acting user's database id and username from the session — the session only caches
 * the username. Throws if the authenticated user no longer exists in the database.
 */
async function resolveActor(): Promise<{ userId: number, username: string }> {
    const userData = await NS.getUserData();
    const userRecord = await prisma().user.findUnique({
        where: { username: userData.username },
        select: { id: true }
    });
    if (!userRecord) throw new Error("Authenticated user not found in database");
    return { userId: userRecord.id, username: userData.username };
}

/**
 * Server action: creates a new HisDoc event from the submitted form data.
 * Requires the user to have hisdoc access. Redirects to the new event page on success.
 *
 * @param formData - FormData containing name, description, details, tag_ids, person_ids,
 *   related_event_ids, and FlexiDate fields (date_type, date1, date_time_offset, etc.).
 */
export async function addEvent(formData: FormData): Promise<void> {
    await NS.strictRequirePermission("hisdoc", "editor");
    const actor = await resolveActor();

    const { name, description, details, tag_ids, person_ids, related_event_ids } =
        parseEventFormFields(formData);

    const flexiDate = parseFlexiDateForm(formData);
    if (!flexiDate) throw new Error("Invalid or missing FlexiDate fields in form data");
    assertFlexiDateInvariants(flexiDate);

    const message = `Created event '${name}'`;
    const event = await createEvent(
        { userId: actor.userId },
        message,
        {
            name,
            description,
            details,
            event_date_time_offset: flexiDate.event_date_time_offset,
            // assertFlexiDateInvariants above has already checked flexiDate matches one of the two
            // centered/ranged shapes; the cast just restores that discriminated-union narrowing,
            // which parseFlexiDateForm's flattened FlexiDateInput return type loses
            ...(flexiDate as EventDateFields),
            tagIds: tag_ids,
            personIds: person_ids,
            relatedEventIds: related_event_ids
        }
    );

    sendHisDocWebhook("event", "add", event.id, name, actor.userId, actor.username, message);
    // redirect throws internally, so it must run outside the transaction
    redirect("/hisdoc/event/" + event.id);
}

/**
 * Server action: updates an existing HisDoc event from the submitted form data.
 * Requires the user to have hisdoc access. Redirects to the event page on success.
 *
 * @param id - The id of the event to update.
 * @param formData - FormData with the same fields as addEvent, plus a `changelog_note` field.
 */
export async function editEvent(id: number, formData: FormData): Promise<void> {
    await NS.strictRequirePermission("hisdoc", "editor");
    const actor = await resolveActor();

    // Verify the event exists before attempting to update it
    const existing = await prisma().hd_event.findUnique({ where: { id, soft_deleted: false } });
    if (!existing) notFound();

    const { name, description, details, tag_ids, person_ids, related_event_ids } =
        parseEventFormFields(formData);

    const changelogNote = changelogNoteSchema.parse(formData.get("changelog_note"));

    const flexiDate = parseFlexiDateForm(formData);
    if (!flexiDate) throw new Error("Invalid or missing FlexiDate fields in form data");
    assertFlexiDateInvariants(flexiDate);

    await updateEvent(
        { userId: actor.userId },
        changelogNote,
        id,
        {
            name,
            description,
            details,
            event_date_time_offset: flexiDate.event_date_time_offset,
            // See the equivalent cast in addEvent above for why this is needed
            ...(flexiDate as EventDateFields),
            tagIds: tag_ids,
            personIds: person_ids,
            relatedEventIds: related_event_ids
        }
    );

    sendHisDocWebhook("event", "edit", id, name, actor.userId, actor.username, changelogNote);
    // redirect throws internally, so it must run outside the transaction
    redirect("/hisdoc/event/" + id);
}

/**
 * Server action: soft-deletes a HisDoc event.
 * Requires hisdoc editor access. Redirects to the timeline on success.
 *
 * @param id - The id of the event to delete.
 * @param note - The changelog note explaining the deletion.
 */
export async function deleteEvent(id: number, note: string): Promise<void> {
    await NS.strictRequirePermission("hisdoc", "editor");
    const actor = await resolveActor();

    const existing = await prisma().hd_event.findUnique({ where: { id, soft_deleted: false } });
    if (!existing) notFound();

    const changelogNote = changelogNoteSchema.parse(note);
    await deleteEventGateway({ userId: actor.userId }, changelogNote, id);

    sendHisDocWebhook("event", "delete", id, existing.name, actor.userId, actor.username, changelogNote);
    redirect("/hisdoc");
}

/**
 * Parses the person form fields (type, data) from the given FormData.
 * Throws a Zod error if they're invalid.
 */
function parsePersonFormFields(formData: FormData) {
    return personFieldSchema.parse({
        type: formData.get("type"),
        data: formData.get("data")
    });
}

/**
 * Server action: creates a new HisDoc person from the submitted form data.
 * Requires hisdoc admin access. Redirects to the new person page on success.
 *
 * @param formData - FormData containing type and data.
 */
export async function addPerson(formData: FormData): Promise<void> {
    await NS.strictRequirePermission("hisdoc", "admin");
    const actor = await resolveActor();

    const { type, data } = parsePersonFormFields(formData);

    const displayName = await resolvePersonDisplayName({ type, data });
    const message = `Created person '${displayName}'`;
    const person = await createPerson({ userId: actor.userId }, message, { type, data });

    sendHisDocWebhook("person", "add", person.id, displayName, actor.userId, actor.username, message);
    redirect("/hisdoc/person/" + person.id);
}

/**
 * Server action: updates an existing HisDoc person from the submitted form data.
 * linked_user_id is not part of the form and is left untouched.
 * Requires hisdoc admin access. Redirects to the person page on success.
 *
 * @param id - The id of the person to update.
 * @param formData - FormData containing type, data and a `changelog_note` field.
 */
export async function editPerson(id: number, formData: FormData): Promise<void> {
    await NS.strictRequirePermission("hisdoc", "admin");
    const actor = await resolveActor();

    // Verify the person exists before attempting to update it
    const existing = await prisma().hd_person.findUnique({ where: { id, soft_deleted: false } });
    if (!existing) notFound();

    const { type, data } = parsePersonFormFields(formData);
    const changelogNote = changelogNoteSchema.parse(formData.get("changelog_note"));

    await updatePerson({ userId: actor.userId }, changelogNote, id, { type, data });

    const displayName = await resolvePersonDisplayName({ type, data });
    sendHisDocWebhook("person", "edit", id, displayName, actor.userId, actor.username, changelogNote);
    redirect("/hisdoc/person/" + id);
}

/**
 * Server action: soft-deletes a HisDoc person.
 * Requires hisdoc admin access. Redirects to the persons list on success.
 *
 * @param id - The id of the person to delete.
 * @param note - The changelog note explaining the deletion.
 */
export async function deletePerson(id: number, note: string): Promise<void> {
    await NS.strictRequirePermission("hisdoc", "admin");
    const actor = await resolveActor();

    const existing = await prisma().hd_person.findUnique({ where: { id, soft_deleted: false } });
    if (!existing) notFound();

    const changelogNote = changelogNoteSchema.parse(note);
    await deletePersonGateway({ userId: actor.userId }, changelogNote, id);

    const displayName = await resolvePersonDisplayName(existing);
    sendHisDocWebhook("person", "delete", id, displayName, actor.userId, actor.username, changelogNote);
    redirect("/hisdoc/persons");
}

/**
 * Parses the tag form fields (name, description, color) from the given FormData.
 * Throws a Zod error if they're invalid.
 */
function parseTagFormFields(formData: FormData) {
    return tagFieldSchema.parse({
        name: formData.get("name"),
        description: formData.get("description"),
        color: formData.get("color")
    });
}

/**
 * Server action: creates a new HisDoc tag from the submitted form data.
 * Requires hisdoc admin access. Redirects to the new tag page on success.
 *
 * @param formData - FormData containing name, description and color ("#rrggbb").
 */
export async function addTag(formData: FormData): Promise<void> {
    await NS.strictRequirePermission("hisdoc", "admin");
    const actor = await resolveActor();

    const { name, description, color } = parseTagFormFields(formData);

    const message = `Created tag '${name}'`;
    const tag = await createTag({ userId: actor.userId }, message, { name, description, color });

    sendHisDocWebhook("tag", "add", tag.id, name, actor.userId, actor.username, message);
    redirect("/hisdoc/tag/" + tag.id);
}

/**
 * Server action: updates an existing HisDoc tag from the submitted form data.
 * Requires hisdoc admin access. Redirects to the tag page on success.
 *
 * @param id - The id of the tag to update.
 * @param formData - FormData containing name, description, color and a `changelog_note` field.
 */
export async function editTag(id: number, formData: FormData): Promise<void> {
    await NS.strictRequirePermission("hisdoc", "admin");
    const actor = await resolveActor();

    // Verify the tag exists before attempting to update it
    const existing = await prisma().hd_tag.findUnique({ where: { id, soft_deleted: false } });
    if (!existing) notFound();

    const { name, description, color } = parseTagFormFields(formData);
    const changelogNote = changelogNoteSchema.parse(formData.get("changelog_note"));

    await updateTag({ userId: actor.userId }, changelogNote, id, { name, description, color });

    sendHisDocWebhook("tag", "edit", id, name, actor.userId, actor.username, changelogNote);
    redirect("/hisdoc/tag/" + id);
}

/**
 * Server action: soft-deletes a HisDoc tag.
 * Requires hisdoc admin access. Redirects to the tags list on success.
 *
 * @param id - The id of the tag to delete.
 * @param note - The changelog note explaining the deletion.
 */
export async function deleteTag(id: number, note: string): Promise<void> {
    await NS.strictRequirePermission("hisdoc", "admin");
    const actor = await resolveActor();

    const existing = await prisma().hd_tag.findUnique({ where: { id, soft_deleted: false } });
    if (!existing) notFound();

    const changelogNote = changelogNoteSchema.parse(note);
    await deleteTagGateway({ userId: actor.userId }, changelogNote, id);

    sendHisDocWebhook("tag", "delete", id, existing.name, actor.userId, actor.username, changelogNote);
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
