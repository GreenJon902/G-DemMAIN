/**
 * Returns the display name for a Minecraft player identified by the given UUID.
 * @param uuid - The player's UUID in hyphenated format (e.g. "550e8400-...").
 * TODO: Implement UUID→username resolution with a caching strategy.
 *       Candidates: in-memory LRU cache, a mc_username column on hisdoc_person,
 *       or periodic batch refresh via the Mojang API. Decide before implementing.
 */
export async function getMinecraftUsername(uuid: string): Promise<string> {
    return uuid;
}
