# HisDoc JS Architecture — Devil's Advocate

Issues, risks, and edge cases found by critically reviewing the architecture plan.

---

## Critical Issues (must address)

### 1. `BigInt` cannot be JSON serialised

Prisma returns `BigInt` for `event_date1`, `event_date_diff`, and `event_date2`. (`sort_key` is a STORED generated column and will also appear as `BigInt` after `db pull`, but since it is only used server-side in `ORDER BY` clauses and never serialised to the client, it should be omitted from all `select` shapes passed to the client.) `JSON.stringify` throws `TypeError: Do not know how to serialize a BigInt`. This will crash the `/hisdoc/api/timeline` API route.

**Fix:** Convert all `BigInt` fields to `number` before serialising in the API route. All FlexiDate values are unix-adjacent timestamps that fit comfortably within JS's safe integer range (`Number.MAX_SAFE_INTEGER` = 2^53 - 1 ≈ 9×10^15; current unix seconds ≈ 1.7×10^9). A small utility is needed:

```typescript
function bigIntToNumber(val: bigint): number { return Number(val); }
```

Server Components passing data to Client Components also need this — `BigInt` props cannot cross the RSC/client boundary.

### 2. Self-referential event relation requires OR query — not obvious in Prisma

The `hisdoc_event_event_relation` table stores one row per pair (`event_a_id`, `event_b_id`). To find all events related to event X, we need rows where **either** column equals X.

Prisma's `include` on a model with two named relations gives you two separate arrays (`related_events_a` and `related_events_b`). These must be merged in application code:

```typescript
const related = [
  ...event.related_events_a.map(r => r.event_b),
  ...event.related_events_b.map(r => r.event_a)
];
```

This is non-obvious and easy to forget, leaving only half the related events showing. **Document clearly in the page code.**

Also: when creating a new event–event relation, the action must enforce `event_a_id < event_b_id` (or any consistent ordering) to avoid duplicate rows stored in opposite directions. The original's `PRIMARY KEY(eid1, eid2)` does not prevent `(1,2)` and `(2,1)` being stored separately without an additional constraint. **Add this invariant in the server action.**

### 3. ~~FlexiDate CHECK constraints are not in Prisma schema~~ — RESOLVED

**Resolved:** Since `doc/Databases.md` is the source of truth, we write raw SQL directly. All seven FlexiDate constraints (`chk_flexidate_*`) are defined in the `CREATE OR REPLACE TABLE hisdoc_event` statement and are enforced by MariaDB at the engine level. Application-code validation (Zod) is still good practice as a first line of defence but is no longer the only guard.

### 4. ~~Conditional unique constraints for person type~~ — RESOLVED

**Resolved:** The `hisdoc_person` table uses a single `data VARCHAR(255)` column with a composite `UNIQUE KEY (type, data)`. This correctly mirrors the original schema — an NPC and a MC player can share the same string (different types), duplicate UUIDs within MINECRAFT are prevented, and duplicate names within NPC are prevented. A `CHECK` constraint additionally validates that `data` is a well-formed UUID when `type = 'MINECRAFT'`.

---

## Medium Issues (should address)

### 5. Timeline filter reset when props change

`InfiniteTimeline` is a client component seeded with the initial events (passed as props). When the user changes a filter, the Server Component re-renders with new results and passes new initial events as props. The client component must detect this and reset its local event list.

Using React's `key` prop on `InfiniteTimeline` (keyed to the serialised filter state) forces a full remount on filter change, resetting state automatically. This is the correct pattern but means a flash of content while the new first page loads (the Server Component re-renders, replaces the client component from scratch). This is acceptable for a small community tool.

### 6. ~~Sort key is a denormalised field — must be kept in sync~~ — RESOLVED

**Resolved:** `sort_key` is a MariaDB `STORED` generated column (`GENERATED ALWAYS AS (...) STORED`). MariaDB computes and updates it automatically on every insert/update. The application cannot write to it (attempting to do so would be a DB error). `computeSortKey` in `lib/flexidate.ts` is therefore no longer needed — remove it from the plan.

### 7. Infinite scroll cursor stability

Cursor-based pagination uses the `(sort_key, id)` pair of the last-seen event. If an event is added or edited between two scroll loads, it might appear in a different position, causing events near that position to be skipped or duplicated. For a small community tool used by a handful of people adding events infrequently, this is acceptable, but worth documenting.

### 8. Tag count query on person page requires two round-trips

Prisma's `groupBy` doesn't support `include`, so fetching "event count per tag for this person" requires:
1. `groupBy` to get `(tag_id, count)` pairs
2. `findMany` on `hisdoc_tag` with the tag IDs

This is two queries. For a small dataset it's fine, but if this becomes a concern, a raw SQL query with `GROUP BY` and a `JOIN` could do it in one.

### 9. `auth.ts` requires coordinated changes — easy to miss

Adding the `hisdoc` area requires changes in three places in `com/lib/auth.ts`:

1. `AREAS` const: add `hisdoc: { requireSudo: false }`
2. `userToAreaAccess`: add `hisdoc: user.has_hisdoc_access`
3. `strictCheckUser` DB select: add `has_hisdoc_access: true` to the `select` clause

Missing any one of these would cause a runtime error or silently deny all hisdoc access. The three spots are close together in the file but it's a multi-site change.

Additionally, the `user` model in `schema.prisma` will gain `has_hisdoc_access` after `db pull` — Prisma needs to be rebuilt before the new field is accessible in TypeScript.

**Resolved concern from earlier plan:** the earlier plan used `NS.hasSession()` for HisDoc auth, which had no access control. This is now properly gated by `requireArea('hisdoc')` and `NS.optimisticCheckUser('hisdoc')`, which enforce the `has_hisdoc_access` flag.

### 10. Persons page: MC player name display — deferred via placeholder

MC players are stored by UUID only. The architecture includes a placeholder function `getMinecraftUsername(uuid)` in `nxt/app/hisdoc/lib/minecraft.ts` that currently returns the UUID unchanged. A `TODO` comment in that function flags that the implementation and caching strategy (in-memory LRU, DB column, periodic Mojang API refresh) should be decided in a later version. All code that displays an MC player's name must call this function rather than using `data` directly, so the display can be upgraded without touching each call site.

---

## Low Issues (informational)

### 11. `color` integer to hex edge case

If the `color` column somehow contains a negative value (Java's `int` is signed; values > 0x7FFFFFFF are negative), `color.toString(16)` produces a negative hex string like `"-1"`. This can't happen for valid RGB values (max 0xFFFFFF = 16,777,215 fits in a signed int), but worth noting. Use `(color >>> 0).toString(16).padStart(6, '0')` for defensive conversion if paranoid.

Wait — in TypeScript/JS, `>>>` treats a number as unsigned 32-bit. This is fine.

### 12. Related events form input UX

The original required the user to look up EIDs on the timeline and type them as comma-separated values. This is poor UX but matches the original spec. It could be improved with a searchable multi-select, but that's beyond the current scope.

### 13. `posted_at` vs `sort_key` confusion

`posted_at` is when the event was added to the system (always increasing, reflects submission order). `sort_key` is when the historical event occurred (the FlexiDate, which could be centuries ago). These are very different and it would be easy to accidentally sort by `posted_at` when the timeline should sort by `sort_key`. **Name these clearly and add comments.**

### 14. Edit action: relation rows are deleted and recreated

On edit, the cleanest approach is to delete all existing tag/person/event relations for the event and insert the new ones from the form. This is a short transaction. An alternative (diff the old and new) is more complex with no meaningful benefit for a small tool.

The deletion must be in the same transaction as the inserts and the event update to avoid a window with orphaned relations.

### 15. No pagination on tag/persons pages

The current plan has no pagination on `/hisdoc/tags` or `/hisdoc/persons`. If the server has hundreds of players/NPCs, these pages could get long. For now, load all — infinite scroll can be added later if needed.
