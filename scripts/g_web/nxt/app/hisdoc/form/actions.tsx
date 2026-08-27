"use server";

import { z } from "zod";
import { redirect, notFound } from "next/navigation";
import { NS } from "@/lib/session";
import prisma from "@g/com/lib/prisma/client";
import { createEvent, updateEvent, type EventDateFields } from "@g/com/lib/prisma/hisdoc/event";
import { createPerson, updatePerson } from "@g/com/lib/prisma/hisdoc/person";
import { createTag, updateTag } from "@g/com/lib/prisma/hisdoc/tag";
import { sendHisDocWebhook } from "@g/com/lib/webhook";
import { hd_person_type } from "@g/com/prisma/enums";
import { earliestUnix, latestUnix, parseFlexiDateForm, MIN_FLEXIDATE_UNIX, MAX_FLEXIDATE_UNIX } from "../lib/date/flexidate";
import { hexToColor } from "../lib/color";
import { resolvePersonDisplayName } from "../changelog/lib/personDisplayName";
import { type ActionResult, changelogNoteSchema, resolveActor, runMutation } from "../lib/actionHelpers";
import { fetchPersonOptions } from "./lib/options";
import type { PersonOption } from "./lib/optionTypes";

/** Zod schema for fields shared by both add and edit. Text fields are trimmed so whitespace-only
 * input is rejected as empty rather than accepted, and leading/trailing whitespace is never stored. */
const eventFieldSchema = z.object({
    name: z.string().trim().min(1).max(255),
    description: z.string().trim().min(1),
    // Empty string is treated the same as absent — store null in both cases
    details: z.string().trim().optional().transform(v => v || null)
});

// Mirrors chk_hd_person_minecraft_uuid (doc/Databases.md) — a 36-char hyphenated Minecraft UUID
const MINECRAFT_UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Zod schema for the person form fields. */
const personFieldSchema = z.object({
    type: z.enum(hd_person_type),
    data: z.string().trim().min(1).max(255)
}).refine(
    v => v.type !== hd_person_type.MINECRAFT || MINECRAFT_UUID_REGEX.test(v.data),
    { message: "MINECRAFT persons require data to be a hyphenated Minecraft UUID" }
);

/** Zod schema for the tag form fields. Converts the colour input's "#rrggbb" into the stored int. */
const tagFieldSchema = z.object({
    name: z.string().trim().min(1).max(255),
    description: z.string().trim().min(1),
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

// event_date_time_offset is a SMALLINT column; the client's offset field is a free-text "(+|-)HH:MM"
// string with no numeric min/max of its own, so this bound is enforced only here
const eventDateTimeOffsetSchema = z.number().int().min(-32768).max(32767);
const eventDateDiffSchema = z.bigint().min(0n).max(BigInt(Number.MAX_SAFE_INTEGER)); // event_date_diff is BIGINT UNSIGNED, bounded to what a JS number can represent exactly

/**
 * Validates the structural invariants and numeric bounds of a parsed FlexiDate, throwing if any
 * are violated. These rules are also enforced by the database (or, for the numeric bounds, by the
 * client); this is a belt-and-suspenders check.
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
        eventDateDiffSchema.parse(flexiDate.event_date_diff);
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

    eventDateTimeOffsetSchema.parse(flexiDate.event_date_time_offset);

    if (earliestUnix(flexiDate) < MIN_FLEXIDATE_UNIX || latestUnix(flexiDate) > MAX_FLEXIDATE_UNIX) {
        throw new Error("Date must be between the years 1000 and 9999");
    }
}

/**
 * Server action: creates a new HisDoc event from the submitted form data.
 * Requires the user to have hisdoc access. Redirects to the new event page on success;
 * returns a human-readable error otherwise.
 *
 * @param formData - FormData containing name, description, details, tag_ids, person_ids,
 *   related_event_ids, and FlexiDate fields (date_type, date1, date_time_offset, etc.).
 */
export async function addEvent(formData: FormData): Promise<ActionResult> {
    await NS.strictRequirePermission("hisdoc", "editor");
    const actor = await resolveActor();

    let eventId!: number;
    const failure = await runMutation(async () => {
        const { name, description, details, tag_ids, person_ids, related_event_ids } =
            parseEventFormFields(formData);

        const flexiDate = parseFlexiDateForm(formData);
        if (!flexiDate) throw new Error("Invalid or missing FlexiDate fields in form data");
        assertFlexiDateInvariants(flexiDate);

        const message = `Created event "${name}".`;
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
                // which parseFlexiDateForm's flattened FlexiDate return type loses
                ...(flexiDate as EventDateFields),
                tagIds: tag_ids,
                personIds: person_ids,
                relatedEventIds: related_event_ids
            }
        );
        eventId = event.id;

        sendHisDocWebhook("event", "add", event.id, name, actor.userId, actor.username, message);
    });
    if (failure) return failure;

    // redirect throws internally, so it must run outside runMutation's try/catch
    redirect("/hisdoc/event/" + eventId);
}

/**
 * Server action: updates an existing HisDoc event from the submitted form data.
 * Requires the user to have hisdoc access. Redirects to the event page on success;
 * returns a human-readable error otherwise.
 *
 * @param id - The id of the event to update.
 * @param formData - FormData with the same fields as addEvent, plus a `changelog_note` field.
 */
export async function editEvent(id: number, formData: FormData): Promise<ActionResult> {
    await NS.strictRequirePermission("hisdoc", "editor");
    const actor = await resolveActor();

    // Verify the event exists before attempting to update it
    const existing = await prisma().hd_event.findUnique({ where: { id, soft_deleted: false } });
    if (!existing) notFound();

    const failure = await runMutation(async () => {
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
    });
    if (failure) return failure;

    // redirect throws internally, so it must run outside runMutation's try/catch
    redirect("/hisdoc/event/" + id);
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
 * Requires hisdoc admin access. Redirects to the new person page on success;
 * returns a human-readable error otherwise.
 *
 * @param formData - FormData containing type and data.
 */
export async function addPerson(formData: FormData): Promise<ActionResult> {
    await NS.strictRequirePermission("hisdoc", "admin");
    const actor = await resolveActor();

    let personId!: number;
    const failure = await runMutation(async () => {
        const { type, data } = parsePersonFormFields(formData);

        const displayName = await resolvePersonDisplayName({ type, data });
        const message = `Created person "${displayName}".`;
        const person = await createPerson({ userId: actor.userId }, message, { type, data });
        personId = person.id;

        sendHisDocWebhook("person", "add", person.id, displayName, actor.userId, actor.username, message);
    });
    if (failure) return failure;

    redirect("/hisdoc/person/" + personId);
}

/**
 * Server action: updates an existing HisDoc person from the submitted form data.
 * linked_user_id is not part of the form and is left untouched.
 * Requires hisdoc admin access. Redirects to the person page on success;
 * returns a human-readable error otherwise.
 *
 * @param id - The id of the person to update.
 * @param formData - FormData containing type, data and a `changelog_note` field.
 */
export async function editPerson(id: number, formData: FormData): Promise<ActionResult> {
    await NS.strictRequirePermission("hisdoc", "admin");
    const actor = await resolveActor();

    // Verify the person exists before attempting to update it
    const existing = await prisma().hd_person.findUnique({ where: { id, soft_deleted: false } });
    if (!existing) notFound();

    const failure = await runMutation(async () => {
        const { type, data } = parsePersonFormFields(formData);
        const changelogNote = changelogNoteSchema.parse(formData.get("changelog_note"));

        await updatePerson({ userId: actor.userId }, changelogNote, id, { type, data });

        const displayName = await resolvePersonDisplayName({ type, data });
        sendHisDocWebhook("person", "edit", id, displayName, actor.userId, actor.username, changelogNote);
    });
    if (failure) return failure;

    redirect("/hisdoc/person/" + id);
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
 * Requires hisdoc admin access. Redirects to the new tag page on success;
 * returns a human-readable error otherwise.
 *
 * @param formData - FormData containing name, description and color ("#rrggbb").
 */
export async function addTag(formData: FormData): Promise<ActionResult> {
    await NS.strictRequirePermission("hisdoc", "admin");
    const actor = await resolveActor();

    let tagId!: number;
    const failure = await runMutation(async () => {
        const { name, description, color } = parseTagFormFields(formData);

        const message = `Created tag "${name}".`;
        const tag = await createTag({ userId: actor.userId }, message, { name, description, color });
        tagId = tag.id;

        sendHisDocWebhook("tag", "add", tag.id, name, actor.userId, actor.username, message);
    });
    if (failure) return failure;

    redirect("/hisdoc/tag/" + tagId);
}

/**
 * Server action: updates an existing HisDoc tag from the submitted form data.
 * Requires hisdoc admin access. Redirects to the tag page on success;
 * returns a human-readable error otherwise.
 *
 * @param id - The id of the tag to update.
 * @param formData - FormData containing name, description, color and a `changelog_note` field.
 */
export async function editTag(id: number, formData: FormData): Promise<ActionResult> {
    await NS.strictRequirePermission("hisdoc", "admin");
    const actor = await resolveActor();

    // Verify the tag exists before attempting to update it
    const existing = await prisma().hd_tag.findUnique({ where: { id, soft_deleted: false } });
    if (!existing) notFound();

    const failure = await runMutation(async () => {
        const { name, description, color } = parseTagFormFields(formData);
        const changelogNote = changelogNoteSchema.parse(formData.get("changelog_note"));

        await updateTag({ userId: actor.userId }, changelogNote, id, { name, description, color });

        sendHisDocWebhook("tag", "edit", id, name, actor.userId, actor.username, changelogNote);
    });
    if (failure) return failure;

    redirect("/hisdoc/tag/" + id);
}

// Search actions return at most this many rows; hitting the cap means "too many matches"
const SEARCH_RESULT_LIMIT = 20;

/**
 * Server action: searches non-deleted events by name substring, for the related-events selector.
 * Public — read-only, same as getTimelinePage.
 *
 * @param query - The search text; matched case-insensitively as a substring of the event name.
 * @returns The matching events ordered by name when fewer than SEARCH_RESULT_LIMIT match (empty
 *   for a blank query), or null when the query is too broad and should be refined.
 */
export async function searchEvents(query: string): Promise<{ id: number; name: string }[] | null> {
    const q = query.trim();
    if (!q) return [];

    const events = await prisma().hd_event.findMany({
        where: { soft_deleted: false, name: { contains: q } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
        take: SEARCH_RESULT_LIMIT
    });
    return events.length >= SEARCH_RESULT_LIMIT ? null : events;
}

/**
 * Server action: searches non-deleted persons by resolved display name, for the persons selector.
 * Public — read-only, same as searchEvents. Display names aren't stored (MINECRAFT persons store
 * a UUID), so every active person is resolved via fetchPersonOptions and matched here rather
 * than in SQL.
 *
 * @param query - The search text; matched case-insensitively as a substring of the display name.
 * @returns The matching persons ordered by name when fewer than SEARCH_RESULT_LIMIT match (empty
 *   for a blank query), or null when the query is too broad and should be refined.
 */
export async function searchPersons(query: string): Promise<Array<PersonOption> | null> {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const persons = (await fetchPersonOptions()).filter(p => p.displayName.toLowerCase().includes(q));
    return persons.length >= SEARCH_RESULT_LIMIT ? null : persons;
}
