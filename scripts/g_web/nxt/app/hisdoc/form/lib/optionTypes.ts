import type { hd_person_type } from "@g/com/prisma/enums";

/** A selectable tag in the tags relation section. */
export type TagOption = { id: number, name: string, description: string, color: number };

/** A selectable person in the persons relation section. `displayName` is pre-resolved server-side. */
export type PersonOption = { id: number, type: hd_person_type, data: string, displayName: string };

/** A selectable event in the related-events relation section. */
export type EventOption = { id: number, name: string };
