import { hd_person_type } from "@g/com/prisma/enums";
import { getMinecraftUsername } from "../../lib/minecraft";

/** For an NPC, `data` is itself the display name; for a Minecraft account it's a uuid that needs resolving. */
export async function resolvePersonDisplayName(value: { type: hd_person_type; data: string }): Promise<string> {
    return value.type === hd_person_type.MINECRAFT ? await getMinecraftUsername(value.data) : value.data;
}
