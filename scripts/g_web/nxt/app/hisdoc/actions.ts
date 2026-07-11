"use server";

import { z } from "zod";
import { redirect, notFound } from "next/navigation";
import { NS } from "@/lib/session";
import prisma from "@g/com/lib/prisma/client";
import { createEvent, updateEvent, type EventDateFields } from "@g/com/lib/prisma/hisdoc/event";
import { sendHisDocEventAddedWebhook, sendHisDocEventEditedWebhook } from "@g/com/lib/webhook";
import { parseFlexiDateForm } from "./lib/flexidate";

/** Zod schema for fields shared by both add and edit. */
const eventFieldSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().min(1),
    // Empty string is treated the same as absent — store null in both cases
    details: z.string().optional().transform(v => v || null)
});

/** Zod schema for the changelog note required on edits. */
const changelogNoteSchema = z.string().min(1);

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
 * Server action: creates a new HisDoc event from the submitted form data.
 * Requires the user to have hisdoc access. Redirects to the new event page on success.
 *
 * @param formData - FormData containing name, description, details, tag_ids, person_ids,
 *   related_event_ids, and FlexiDate fields (date_type, date1, date_time_offset, etc.).
 */
export async function addEvent(formData: FormData): Promise<void> {
    await NS.strictRequirePermission("hisdoc", "editor");
    const userData = await NS.getUserData();

    // Resolve the DB user id — the session only caches the username
    const userRecord = await prisma().user.findUnique({
        where: { username: userData.username },
        select: { id: true }
    });
    if (!userRecord) throw new Error("Authenticated user not found in database");

    const { name, description, details, tag_ids, person_ids, related_event_ids } =
        parseEventFormFields(formData);

    const flexiDate = parseFlexiDateForm(formData);
    if (!flexiDate) throw new Error("Invalid or missing FlexiDate fields in form data");
    assertFlexiDateInvariants(flexiDate);

    const event = await createEvent(
        { userId: userRecord.id },
        `Created event '${name}'`,
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

    sendHisDocEventAddedWebhook(name, userData.username);
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
    const userData = await NS.getUserData();

    const userRecord = await prisma().user.findUnique({
        where: { username: userData.username },
        select: { id: true }
    });
    if (!userRecord) throw new Error("Authenticated user not found in database");

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
        { userId: userRecord.id },
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

    sendHisDocEventEditedWebhook(name, userData.username, changelogNote);
    // redirect throws internally, so it must run outside the transaction
    redirect("/hisdoc/event/" + id);
}
