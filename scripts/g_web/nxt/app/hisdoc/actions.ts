"use server";

import { z } from "zod";
import { redirect, notFound } from "next/navigation";
import { NS } from "@/lib/session";
import prisma from "@g/com/lib/prisma";
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
    await NS.strictRequireUser("hisdoc");
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

    const event = await prisma().$transaction(async (tx) => {
        const newEvent = await tx.hisdoc_event.create({
            data: {
                name,
                description,
                details,
                posted_by_user_id: userRecord.id,
                event_date_type: flexiDate.event_date_type,
                event_date1: flexiDate.event_date1,
                event_date_time_offset: flexiDate.event_date_time_offset,
                event_date_units: flexiDate.event_date_units,
                event_date_diff: flexiDate.event_date_diff,
                event_date2: flexiDate.event_date2
                // sort_key is a STORED generated column — never set explicitly
            }
        });

        if (tag_ids.length > 0) {
            await tx.hisdoc_event_tag.createMany({
                data: tag_ids.map(tag_id => ({ event_id: newEvent.id, tag_id }))
            });
        }

        if (person_ids.length > 0) {
            await tx.hisdoc_event_person.createMany({
                data: person_ids.map(person_id => ({ event_id: newEvent.id, person_id }))
            });
        }

        if (related_event_ids.length > 0) {
            // Enforce event_a_id < event_b_id to maintain the canonical ordering constraint
            await tx.hisdoc_event_event.createMany({
                data: related_event_ids.map(rel_id => ({
                    event_a_id: Math.min(newEvent.id, rel_id),
                    event_b_id: Math.max(newEvent.id, rel_id)
                })),
                skipDuplicates: true
            });
        }

        return newEvent;
    });

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
    await NS.strictRequireUser("hisdoc");
    const userData = await NS.getUserData();

    const userRecord = await prisma().user.findUnique({
        where: { username: userData.username },
        select: { id: true }
    });
    if (!userRecord) throw new Error("Authenticated user not found in database");

    // Verify the event exists before attempting to update it
    const existing = await prisma().hisdoc_event.findUnique({ where: { id } });
    if (!existing) notFound();

    const { name, description, details, tag_ids, person_ids, related_event_ids } =
        parseEventFormFields(formData);

    const changelogNote = changelogNoteSchema.parse(formData.get("changelog_note"));

    const flexiDate = parseFlexiDateForm(formData);
    if (!flexiDate) throw new Error("Invalid or missing FlexiDate fields in form data");
    assertFlexiDateInvariants(flexiDate);

    await prisma().$transaction(async (tx) => {
        await tx.hisdoc_event.update({
            where: { id },
            data: {
                name,
                description,
                details,
                event_date_type: flexiDate.event_date_type,
                event_date1: flexiDate.event_date1,
                event_date_time_offset: flexiDate.event_date_time_offset,
                event_date_units: flexiDate.event_date_units,
                event_date_diff: flexiDate.event_date_diff,
                event_date2: flexiDate.event_date2
                // sort_key is a STORED generated column — never set explicitly
            }
        });

        // Replace all relations — delete then recreate
        await tx.hisdoc_event_tag.deleteMany({ where: { event_id: id } });
        await tx.hisdoc_event_person.deleteMany({ where: { event_id: id } });
        // Composite-PK junction tables don't support OR in deleteMany, so use two calls
        await tx.hisdoc_event_event.deleteMany({ where: { event_a_id: id } });
        await tx.hisdoc_event_event.deleteMany({ where: { event_b_id: id } });

        if (tag_ids.length > 0) {
            await tx.hisdoc_event_tag.createMany({
                data: tag_ids.map(tag_id => ({ event_id: id, tag_id }))
            });
        }

        if (person_ids.length > 0) {
            await tx.hisdoc_event_person.createMany({
                data: person_ids.map(person_id => ({ event_id: id, person_id }))
            });
        }

        if (related_event_ids.length > 0) {
            // Enforce event_a_id < event_b_id to maintain the canonical ordering constraint
            await tx.hisdoc_event_event.createMany({
                data: related_event_ids.map(rel_id => ({
                    event_a_id: Math.min(id, rel_id),
                    event_b_id: Math.max(id, rel_id)
                })),
                skipDuplicates: true
            });
        }

        await tx.hisdoc_changelog.create({
            data: {
                event_id: id,
                description: changelogNote,
                author_user_id: userRecord.id
            }
        });
    });

    sendHisDocEventEditedWebhook(name, userData.username, changelogNote);
    // redirect throws internally, so it must run outside the transaction
    redirect("/hisdoc/event/" + id);
}
