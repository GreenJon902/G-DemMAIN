import "server-only";
import fs from "node:fs/promises";
import path from "node:path";

// Sibling to the other g_web state directories (/var/lib/g_mc, /var/lib/g_monitor), and outside
// nxt/ so it survives code redeploys. Overridable in dev the same way MONITOR_FOLDER is.
const CACHE_FILE = (process.env.NODE_ENV === "development" && process.env.MINECRAFT_CACHE_FILE) || "/var/lib/g_web/minecraft-cache.json";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type CacheEntry = { name: string; fetchedAt: number };

let cacheMap: Map<string, CacheEntry> | undefined;
let loadPromise: Promise<Map<string, CacheEntry>> | undefined;

/** Loads the on-disk cache into memory, once, sharing the load across concurrent callers. */
function loadCache(): Promise<Map<string, CacheEntry>> {
    if (cacheMap !== undefined) return Promise.resolve(cacheMap);
    if (loadPromise === undefined) {
        console.log(`Loading minecraft playername cache from ${CACHE_FILE}...`);
        loadPromise = fs.readFile(CACHE_FILE, "utf8")
            .then(raw => new Map(Object.entries(JSON.parse(raw) as Record<string, CacheEntry>)))
            .catch(() => new Map<string, CacheEntry>())
            .then(loaded => (cacheMap = loaded));
    }
    return loadPromise;
}

// Serializes writes so concurrent persistCache() calls can't interleave and corrupt the file
let writeQueue: Promise<void> = Promise.resolve();

/** Persists the current in-memory cache to disk. */
function persistCache(): void {
    const snapshot = JSON.stringify(Object.fromEntries(cacheMap!));
    writeQueue = writeQueue
        .then(() => fs.mkdir(path.dirname(CACHE_FILE), { recursive: true }))
        .then(() => fs.writeFile(CACHE_FILE, snapshot))
        .catch(console.error);
}

type LookupResult = { name: string } | { notFound: true } | { error: true };

/** Looks up the current username for a uuid via the Mojang API. */
async function lookupUsername(uuid: string): Promise<LookupResult> {
    try {
        console.log(`Fetching unkown or expired username for ${uuid}`);
        const res = await fetch(`https://api.minecraftservices.com/minecraft/profile/lookup/${uuid}`);
        if (res.status === 404) return { notFound: true };
        if (!res.ok) return { error: true };
        const data = (await res.json()) as { name: string };
        return { name: data.name };
    } catch {
        return { error: true };
    }
}

// In-flight first-time lookups, keyed by uuid, so concurrent calls share one request
const inFlight = new Map<string, Promise<string>>();

/**
 * Resolves a uuid that has no cache entry yet. Blocks the caller since there's no
 * old value to serve in the meantime.
 */
async function resolveUncached(uuid: string): Promise<string> {
    let promise = inFlight.get(uuid);
    if (promise === undefined) {
        promise = (async () => {
            const result = await lookupUsername(uuid);
            // A real name is cached normally; a confirmed "no such player" is cached as the uuid
            // itself so we don't refetch it every call, but still retried after CACHE_TTL_MS in
            // case the uuid gets claimed later. A transient error isn't cached, so the very next
            // call retries it.
            if ("name" in result) {
                cacheMap!.set(uuid, { name: result.name, fetchedAt: Date.now() });
                persistCache();
                return result.name;
            }
            if ("notFound" in result) {
                cacheMap!.set(uuid, { name: uuid, fetchedAt: Date.now() });
                persistCache();
                return uuid;
            }
            return uuid;
        })().finally(() => inFlight.delete(uuid));
        inFlight.set(uuid, promise);
    }
    return promise;
}

// uuids currently being refreshed in the background, so repeated stale hits don't pile up requests
const refreshing = new Set<string>();

/**
 * Re-fetches a uuid whose cache entry has gone stale, without blocking the caller.
 * Leaves the cache untouched on failure, so the next stale hit retries.
 */
function refreshInBackground(uuid: string): void {
    if (refreshing.has(uuid)) return;
    refreshing.add(uuid);

    lookupUsername(uuid)
        .then(result => {
            if ("name" in result) {
                cacheMap!.set(uuid, { name: result.name, fetchedAt: Date.now() });
                persistCache();
            }
        })
        .finally(() => refreshing.delete(uuid));
}

/**
 * Returns the display name for a Minecraft player identified by the given UUID.
 * Names are cached on disk for a week. Once a cached name goes stale, the old value
 * is served immediately while the real name is re-fetched in the background for next time.
 * @param uuid - The player's UUID in hyphenated format (e.g. "550e8400-...").
 */
export async function getMinecraftUsername(uuid: string): Promise<string> {
    const cache = await loadCache();
    const entry = cache.get(uuid);

    if (entry === undefined) return resolveUncached(uuid);

    if (Date.now() - entry.fetchedAt >= CACHE_TTL_MS) refreshInBackground(uuid);
    return entry.name;
}
