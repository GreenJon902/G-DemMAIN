# HisDoc JS — Implementation Task Plan

This document breaks the implementation into discrete, agent-executable tasks. Tasks within the same phase have no inter-dependencies and can run in parallel. A task marked **reads** a file means it imports from it; the file must exist before the task runs.

All new files live under `scripts/g_web/nxt/app/hisdoc/` unless otherwise stated. All edits to `com/` take effect for `nxt/` only after `npm run build` is run in `com/`.

---

## Phase 0 — Setup

One agent writes the schema and edits the two `com/` library files. Several manual steps follow before any nxt/ code can be written.

### Agent 0 — Schema + com/ library edits

**Writes:**
- `doc/Databases.md` — add `has_hisdoc_access` to `user` table; add all seven new HisDoc tables
- `com/lib/auth.ts` — three targeted edits (see below)
- `com/lib/webhook.ts` — add two new webhook functions

**Reads:** existing `doc/Databases.md`, `com/lib/auth.ts`, `com/lib/webhook.ts`

#### `doc/Databases.md` changes

Add `has_hisdoc_access BOOLEAN NOT NULL DEFAULT false` to the `user` table. Then add seven new tables in this order (to satisfy FK dependencies):

1. `hisdoc_person`
2. `hisdoc_tag`
3. `hisdoc_event`
4. `hisdoc_changelog`
5. `hisdoc_event_tag`
6. `hisdoc_event_person`
7. `hisdoc_event_event`

Full SQL for each table is in `scripts/g_web/steps/2/schema.md`. Key details:

- `hisdoc_person.data VARCHAR(255)` with `UNIQUE KEY (type, data)` and `CHECK` validating UUID format for MINECRAFT type
- `hisdoc_event.sort_key` is a `GENERATED ALWAYS AS (...) STORED` column — do not add a setter anywhere
- `hisdoc_event` has seven `CONSTRAINT chk_flexidate_*` CHECK constraints
- `hisdoc_event_event` has `CONSTRAINT chk_hisdoc_event_event_no_self CHECK (event_a_id != event_b_id)` and convention `event_a_id < event_b_id` (enforced by application, not DB)

#### `com/lib/auth.ts` changes (three places, near each other)

1. `AREAS` const — add:
   ```typescript
   hisdoc: { requireSudo: false }
   ```

2. `userToAreaAccess` function — extend parameter type and return:
   ```typescript
   function userToAreaAccess(user: { has_panel_access: boolean, has_hisdoc_access: boolean }): Record<Area, boolean> {
       return { panel: user.has_panel_access, hisdoc: user.has_hisdoc_access };
   }
   ```

3. `strictCheckUser` DB select — add `has_hisdoc_access: true` to the `select` clause alongside `has_panel_access`.

#### `com/lib/webhook.ts` additions

Add two new exported functions following the existing pattern (`spawn("python3", [WEBHOOKS_FILE, ...])`):

```typescript
/** Notifies Discord that a new HisDoc event was added.
 * @param eventName - The name of the newly added event.
 * @param authorUsername - The g_web username of the user who added it.
 */
export function sendHisDocEventAddedWebhook(eventName: string, authorUsername: string): void {
    spawn("python3", [WEBHOOKS_FILE, "hisdoc_event_added", eventName, authorUsername]);
}

/** Notifies Discord that an existing HisDoc event was edited.
 * @param eventName - The name of the edited event.
 * @param authorUsername - The g_web username of the user who made the edit.
 * @param changelogNote - The human-written summary of what changed.
 */
export function sendHisDocEventEditedWebhook(eventName: string, authorUsername: string, changelogNote: string): void {
    spawn("python3", [WEBHOOKS_FILE, "hisdoc_event_edited", eventName, authorUsername, changelogNote]);
}
```

---

### Manual Gate 0 → Phase 1

These steps must be completed by a human before any Phase 1 work begins:

1. Apply the SQL additions from `doc/Databases.md` to the live MariaDB database.
2. In `scripts/g_web/com/`, run `npm run schema:pull` (`npx prisma db pull`) to regenerate `schema.prisma`.
3. Manually edit `schema.prisma` to add:
   - On `hisdoc_event_event`: two named `@relation` directives (see `steps/2/schema.md` → Prisma section)
   - On `hisdoc_event`: `related_events_a hisdoc_event_event[] @relation("event_relation_a")` and `related_events_b hisdoc_event_event[] @relation("event_relation_b")`
   - On `user`: `has_hisdoc_access Boolean @default(false)`, `hisdoc_person hisdoc_person?`, `hisdoc_posted_events hisdoc_event[]`, `hisdoc_changelog_entries hisdoc_changelog[]`
4. In `scripts/g_web/com/`, run `npm run build` to rebuild the Prisma client and TypeScript package.

After this gate, all Prisma types for the new tables are available in `nxt/`.

---

## Phase 1 — Leaf implementations

Three independent tasks; run all in parallel.

---

### Agent 1 — HisDoc utilities (`lib/`)

**Writes:**
- `lib/flexidate.ts`
- `lib/minecraft.ts`

**Reads:** `com/prisma/schema.prisma` (for the FlexiDate field types)

#### `lib/flexidate.ts`

Export a `FlexiDateInput` type mirroring the six FlexiDate columns from `hisdoc_event`:

```typescript
type FlexiDateInput = {
    event_date_type: 'centered' | 'ranged';
    event_date1: bigint;
    event_date_time_offset: number;
    event_date_units: 'd' | 'h' | 'm' | null;
    event_date_diff: bigint | null;
    event_date2: bigint | null;
}
```

Export these functions:

- `formatFlexiDate(date: FlexiDateInput): string` — format for display.
  - Centered: `"<value> <units> ± <diff> <units> (UTC<offset>)"` — convert `event_date1` from its unit to a human date, show `± event_date_diff units`.
  - Ranged: `"Between <date1> and <date2> (UTC<offset>)"` — both are days since unix epoch.
- `formatOffset(offsetMinutes: number): string` — formats as `"UTC+60"` / `"UTC-30"` / `"UTC"`.
- `earliestUnix(date: FlexiDateInput): bigint` — returns earliest possible unix timestamp in seconds.
  - Centered: `(event_date1 - event_date_diff) * unitMultiplier`
  - Ranged: `event_date1 * 86400n`
- `latestUnix(date: FlexiDateInput): bigint` — latest possible unix timestamp in seconds.
  - Centered: `(event_date1 + event_date_diff) * unitMultiplier`
  - Ranged: `event_date2! * 86400n`
- `parseFlexiDateForm(fields: FormData): FlexiDateInput | null` — parse raw form field strings back to typed data. Returns `null` if any required field is missing or invalid. Field names: `date_type`, `date1`, `date_time_offset`, `date_units`, `date_diff`, `date2`.

Unit multipliers: `'d' → 86400n`, `'h' → 3600n`, `'m' → 60n`.

#### `lib/minecraft.ts`

```typescript
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
```

---

### Agent 2 — Static display components

**Writes:**
- `ui/TagChip.tsx`
- `ui/PersonAvatar.tsx`
- `ui/BarGraph.tsx`

**Reads:** `nxt/app/panel/ui/Graph.tsx` (for visual style reference only — do not import from it)

#### `ui/TagChip.tsx`

Server Component. Props: `{ id: number, name: string, color: number }`. Convert `color` (packed RGB int) to hex: `'#' + (color >>> 0).toString(16).padStart(6, '0')`. Render a pill `<Link href={'/hisdoc/tag/' + id}>` with `style={{ backgroundColor: hexColor }}` and `className` for padding/rounded/text.

#### `ui/PersonAvatar.tsx`

Server Component. Props: none (placeholder only). Renders:
```tsx
<div className="size-48 rounded-md bg-gray-700" />
```

#### `ui/BarGraph.tsx`

Server Component (pure SVG, no state). Props:

```typescript
type Bar = { label: string; value: number; color: string };  // color is CSS hex e.g. "#ff0000"
type BarGraphProps = {
    bars: Bar[];
    graphClassName?: string;
    containerClassName?: string;
};
```

Implementation:
- If `bars` is empty, render `<p className="text-gray-400">No data</p>`.
- Compute `maxValue = Math.max(...bars.map(b => b.value))`, rounding up to the nearest integer for y-axis ticks.
- SVG with a gray-800 background rect, gray-700 horizontal grid lines at integer y-axis steps, one rect per bar with `fill={bar.color}`, label text below each bar.
- Bars use `fill={bar.color}` inline (not a Tailwind class) — tag colours are dynamic from the DB.
- Y-axis: integer ticks from 0 to `maxValue`.
- Follow `Graph.tsx` for proportions, axis rendering, and container wrapper — match its visual style without importing from it.

---

### Agent 3 — Client form controls

**Writes:**
- `ui/FlexiDateInput.tsx`
- `ui/TagSelector.tsx`

**Reads:** `com/prisma/schema.prisma` (for `hisdoc_tag` type)

#### `ui/FlexiDateInput.tsx`

`"use client"`. Controlled input for FlexiDate. Props: `{ defaultValue?: FlexiDateInput }` (import `FlexiDateInput` from `../lib/flexidate`).

Internal state: the current `type` (centered/ranged) and the sub-fields. Serialises to hidden `<input type="hidden">` fields with names matching what `parseFlexiDateForm` reads: `date_type`, `date1`, `date_time_offset`, `date_units`, `date_diff`, `date2`.

Shows a radio group for Centered / Ranged. Then conditionally:
- **Centered:** numeric input for center value, dropdown for units (`d`/`h`/`m`), numeric input for margin (diff), numeric input for UTC offset.
- **Ranged:** date inputs for start and end, numeric input for UTC offset.

When `type` switches, clear fields that don't apply.

#### `ui/TagSelector.tsx`

`"use client"`. Props: `{ tags: { id: number; name: string; color: number }[]; defaultSelected?: number[] }`.

Renders each tag as a toggleable button. Selected state: full opacity with tag colour background. Unselected: muted/faded. Serialises selected IDs to hidden `<input type="hidden" name="tag_ids" value={id}>` fields (one per selected tag).

---

## Phase 2 — Composed layer

Three independent tasks; run all in parallel after Phase 1 completes.

---

### Agent 4 — Composed display components

**Writes:**
- `ui/FlexiDateDisplay.tsx`
- `ui/TimelineItem.tsx`

**Reads:** `lib/flexidate.ts` (Agent 1), `ui/TagChip.tsx` (Agent 2)

#### `ui/FlexiDateDisplay.tsx`

Server Component. Props: `FlexiDateInput` (import from `../lib/flexidate`). Calls `formatFlexiDate(props)` and renders the result as a `<span>` or `<p>`.

#### `ui/TimelineItem.tsx`

Server Component. Props:
```typescript
{
    id: number;
    name: string;
    description: string;
    date: FlexiDateInput;
    tags: { id: number; name: string; color: number }[];
}
```
Renders one event card: event name as a `<Link href={'/hisdoc/event/' + id}>`, `<FlexiDateDisplay>`, description text (truncated if very long), and a row of `<TagChip>` components.

---

### Agent 5 — Data layer (`actions.ts` + API route)

**Writes:**
- `actions.ts`
- `api/timeline/route.ts`
- `lib/timeline-filter.ts`

**Reads:** `com/lib/auth.ts` (NS, requireArea), `com/lib/webhook.ts`, `lib/flexidate.ts` (Agent 1), `com/prisma/schema.prisma` (Prisma types), `nxt/lib/session.ts`

#### `lib/timeline-filter.ts`

Export `parseTimelineFilters(params: URLSearchParams | ReadonlyURLSearchParams)` and `buildTimelineWhere(filters: TimelineFilters)`. The `where` object is a Prisma `hisdoc_event` `WhereInput`.

Filter encoding (from `steps/2/overview.md`):
- `tags=3:re,7:ex` — tag filter states. States: `re` (required), `ex` (excluded), `in` (inclusive/any-of). Default when absent: ignore.
- `persons=1:re` — person filter states, same values.
- `from=YYYY-MM-DD&to=YYYY-MM-DD&dateMode=inclusive` — date range. Inclusive: event range overlaps query range. Exclusive: event range is fully inside.
- `q=text` — full-text search on event name and description.

`buildTimelineWhere` translates filters to Prisma conditions:
- Required tag: `tags: { some: { tag_id: tagId } }` in AND
- Excluded tag: `tags: { none: { tag_id: tagId } }` in AND
- Inclusive tag (any-of): `tags: { some: { tag_id: { in: inclusiveTagIds } } }` in AND
- Required person: same pattern via `persons`
- Date range: compare `earliestUnix`/`latestUnix` from `lib/flexidate.ts` against the range bounds (convert from day-boundary timestamps to bigint seconds)
- Text search: `OR: [{ name: { contains: q } }, { description: { contains: q } }]`

#### `actions.ts`

`"use server"`. Import `NS` from `nxt/lib/session.ts`, `prisma` from `com/lib/prisma`, the webhook functions from `com/lib/webhook.ts`, `parseFlexiDateForm` from `lib/flexidate.ts`.

**`addEvent(formData: FormData)`:**
1. `await NS.strictRequireUser('hisdoc')` — throws on failure
2. `const user = await NS.getUserData()` — for username in webhook
3. Parse form data with Zod. Fields: `name` (string, 1–255), `description` (string, min 1), `details` (string, optional/nullable), `tag_ids` (array of numbers), `person_ids` (array of numbers), `related_event_ids` (comma-separated string → array of numbers), plus FlexiDate fields via `parseFlexiDateForm`
4. Validate FlexiDate invariants (belt-and-suspenders — DB also enforces)
5. Validate related event IDs exist: `prisma().hisdoc_event.findMany({ where: { id: { in: relatedIds } } })`
6. DB transaction: create `hisdoc_event`, then `hisdoc_event_tag` rows, `hisdoc_event_person` rows, and `hisdoc_event_event` rows. For each related-event pair, always store `(min(a,b), max(a,b))` to satisfy the `event_a_id < event_b_id` convention.
7. `sendHisDocEventAddedWebhook(name, user.username)`
8. `redirect('/hisdoc/event/' + newId)`

**`editEvent(id: number, formData: FormData)`:**
1. `await NS.strictRequireUser('hisdoc')`
2. `const user = await NS.getUserData()`
3. Fetch existing event (throw 404 if not found)
4. Parse + validate form data (same as add, plus `changelog_note` string, required)
5. Validate FlexiDate invariants
6. DB transaction: `UPDATE hisdoc_event`, `DELETE` then re-`INSERT` all tag/person/event relation rows, `INSERT hisdoc_changelog` entry
7. `sendHisDocEventEditedWebhook(name, user.username, changelogNote)`
8. `redirect('/hisdoc/event/' + id)`

**Note:** `sort_key` is a STORED generated column — never include it in a Prisma `data` object for create or update.

#### `api/timeline/route.ts`

GET handler. No auth. Imports `buildTimelineWhere` from `lib/timeline-filter.ts`, `prisma` from `com/lib/prisma`.

Query params: all filter params + `cursor` (last event `id` seen as a string).

Fetch up to 21 events (take 21, use the 21st to determine `hasMore`, return only 20). If `cursor` is provided, add a `cursor`/`skip: 1` clause using Prisma's cursor pagination on `id`.

Order: `[{ sort_key: 'desc' }, { id: 'desc' }]`.

Select: `id`, `name`, `description`, FlexiDate fields (`event_date_type`, `event_date1`, `event_date_time_offset`, `event_date_units`, `event_date_diff`, `event_date2`), and `tags.tag` (`id`, `name`, `color`). Do **not** select `sort_key` (BigInt field, not needed client-side).

**BigInt serialisation:** Before `NextResponse.json(...)`, convert all `BigInt` fields to `Number`: `event_date1: Number(e.event_date1)`, etc. All FlexiDate values fit within `Number.MAX_SAFE_INTEGER`.

Response shape:
```typescript
{ events: TimelineEvent[], hasMore: boolean }
```

---

### Agent 6 — Simple pages

**Writes:**
- `layout.tsx`
- `tags/page.tsx`
- `tag/[id]/page.tsx`
- `persons/page.tsx`

**Reads:** `nxt/lib/session.ts` (NS), `nxt/app/ui/` (LinkButton, etc.), `ui/TagChip.tsx` (Agent 2), `lib/minecraft.ts` (Agent 1), `com/lib/prisma`

#### `layout.tsx`

Server Component. Fetches `canEdit = await NS.optimisticCheckUser('hisdoc')`. Renders a full-width dark header:
- Left: "HisDoc" title as `<Link href="/hisdoc">` in large bold text
- Center nav: `<LinkButton href="/hisdoc">Timeline</LinkButton>`, `<LinkButton href="/hisdoc/tags">Tags</LinkButton>`, `<LinkButton href="/hisdoc/persons">Persons</LinkButton>`
- Right: `{canEdit && <LinkButton href="/hisdoc/event/add">Add Event</LinkButton>}`

Wraps `{children}` in a `<main>` with consistent dark padding.

#### `tags/page.tsx`

Server Component. Fetches all tags ordered by name. Renders a grid/list of `<TagChip>` components.

#### `tag/[id]/page.tsx`

Server Component. Fetches the tag by ID (404 if not found). Fetches 20 most recent events with this tag (`hisdoc_event_tag` → `hisdoc_event`, ordered by `sort_key DESC`). Renders: tag name as title, colour swatch, description, table of events (FlexiDate string — event name link).

#### `persons/page.tsx`

Server Component. Fetches all persons ordered by `data ASC`. For each person, if `type === 'MINECRAFT'` call `await getMinecraftUsername(person.data)` for the display name; otherwise use `person.data` directly. Renders a list of links to `/hisdoc/person/[id]`.

---

## Phase 3 — Assembly

Four independent tasks; run all in parallel after Phase 2 completes.

---

### Agent 7 — Scroll + filter client components

**Writes:**
- `ui/InfiniteTimeline.tsx`
- `ui/TimelineFilters.tsx`

**Reads:** `ui/TimelineItem.tsx` (Agent 4), `lib/flexidate.ts` (Agent 1), `com/prisma/schema.prisma`

#### `ui/InfiniteTimeline.tsx`

`"use client"`. Props:
```typescript
{
    initialEvents: TimelineEvent[];
    filterParams: string;  // serialised searchParams for cursor-fetch URLs
}
```

State: `events: TimelineEvent[]` (initialised from `initialEvents`), `hasMore: boolean`, `loading: boolean`.

On `filterParams` prop change (via `useEffect`), reset `events` to `initialEvents` and re-enable `hasMore` — this handles the Server Component re-render when filters change. Key the component with `key={filterParams}` in the parent to force a clean remount on filter change.

Uses `IntersectionObserver` on a sentinel `<div ref={sentinelRef}>` at the bottom. When the sentinel enters the viewport and `hasMore && !loading`, fetch `/hisdoc/api/timeline?cursor=<lastId>&<filterParams>`, append new events, update `hasMore`.

Renders: list of `<TimelineItem>` components, loading spinner when `loading`, "No more events" text when `!hasMore && events.length > 0`, "No events match your filters" when `events.length === 0`.

#### `ui/TimelineFilters.tsx`

`"use client"`. Props:
```typescript
{
    tags: { id: number; name: string; color: number }[];
    persons: { id: number; data: string; type: string }[];
    // current filter state decoded from searchParams:
    currentFilters: TimelineFilters;
}
```

Uses `useRouter` and `useSearchParams`. On any filter change, calls `router.replace()` with updated searchParams (preserving unrelated params).

Renders:
- Per-tag dropdown: cycles through Ex / Ig / In / Re states (only Ex/Re/In written to URL; Ig omitted as the default)
- Per-person dropdown: same pattern
- Date range: two date pickers (`from`, `to`) + mode toggle (inclusive/exclusive)
- Text search: debounced text input writing to `q` param

---

### Agent 8 — Event form

**Writes:**
- `ui/EventForm.tsx`

**Reads:** `ui/TagSelector.tsx` (Agent 3), `ui/FlexiDateInput.tsx` (Agent 3), `app/AuthContext.tsx` (makeAreaSudoGuard, useAuthContext), `app/ui/Button.tsx` (ActionButton), `lib/flexidate.ts` (Agent 1), `com/prisma/schema.prisma`

#### `ui/EventForm.tsx`

`"use client"`. Props:
```typescript
{
    action: (formData: FormData) => Promise<void>;  // addEvent or editEvent(id, ...)
    defaultValues?: {
        name: string; description: string; details?: string;
        date: FlexiDateInput; tagIds: number[]; personIds: number[];
        relatedEventIds: number[]; changelogNote?: string;
    };
    tags: { id: number; name: string; color: number }[];
    persons: { id: number; data: string; type: string }[];
    isEdit: boolean;
}
```

Uses `useRef<HTMLFormElement>` for the form element. Uses `useAuthContext()` and `makeAreaSudoGuard('hisdoc', ctx)`.

Submit button:
```tsx
<ActionButton
    guard={makeAreaSudoGuard('hisdoc', ctx)}
    action={async () => {
        const fd = new FormData(formRef.current!);
        await props.action(fd);
    }}
>
    {props.isEdit ? 'Save Changes' : 'Add Event'}
</ActionButton>
```

Form fields (all inside `<form ref={formRef}>`):
- Text input: `name` (required, maxLength 255)
- Textarea: `description` (required)
- Textarea: `details` (optional)
- `<TagSelector tags={props.tags} defaultSelected={defaultValues?.tagIds} />`
- Person checkboxes: one `<input type="checkbox" name="person_ids" value={person.id}>` per person; display name via `person.type === 'MINECRAFT' ? person.data : person.data` (same field, just `data` for both — no async username lookup needed inside the form; use `data` directly as label)
- Textarea: `related_event_ids` (comma-separated numbers, optional)
- `<FlexiDateInput defaultValue={defaultValues?.date} />`
- `{props.isEdit && <input name="changelog_note" required placeholder="What changed?" />}`

---

### Agent 9 — Event and person detail pages

**Writes:**
- `event/[id]/page.tsx`
- `person/[id]/page.tsx`

**Reads:** `ui/TagChip.tsx` (Agent 2), `ui/PersonAvatar.tsx` (Agent 2), `ui/BarGraph.tsx` (Agent 2), `ui/FlexiDateDisplay.tsx` (Agent 4), `lib/minecraft.ts` (Agent 1), `nxt/lib/session.ts`, `com/lib/prisma`

#### `event/[id]/page.tsx`

Server Component. Fetch event with full relations:
```typescript
prisma().hisdoc_event.findUnique({
    where: { id },
    include: {
        tags: { include: { tag: true }, orderBy: { tag: { name: 'asc' } } },
        persons: { include: { person: true }, orderBy: { person: { data: 'asc' } } },
        related_events_a: { include: { event_b: { select: { id: true, name: true } } } },
        related_events_b: { include: { event_a: { select: { id: true, name: true } } } },
        changelog: { include: { author_user: { select: { username: true } } }, orderBy: { created_at: 'asc' } },
        posted_by_user: { select: { username: true } }
    }
})
```

Merge related events from both directions:
```typescript
const related = [
    ...event.related_events_a.map(r => r.event_b),
    ...event.related_events_b.map(r => r.event_a)
].sort((a, b) => a.name.localeCompare(b.name));
```

Render two-column layout:
- Left: title + optional edit link (if `await NS.optimisticCheckUser('hisdoc')`), event ID, optional `details` box, description, changelog table (initial post row + edit rows)
- Right: `<FlexiDateDisplay>`, tag chips, related events (name links), related persons (name links)

#### `person/[id]/page.tsx`

Server Component. Fetch person with relations:
```typescript
prisma().hisdoc_person.findUnique({
    where: { id },
    include: {
        involved_in_events: {
            include: { event: { select: { id: true, name: true, event_date_type: true, event_date1: true, event_date_time_offset: true, event_date_units: true, event_date_diff: true, event_date2: true } } },
            orderBy: { event: { sort_key: 'desc' } },
            take: 10
        },
        linked_user: {
            select: {
                username: true,
                hisdoc_posted_events: {
                    select: { id: true, name: true, event_date_type: true, event_date1: true, event_date_time_offset: true, event_date_units: true, event_date_diff: true, event_date2: true },
                    orderBy: { sort_key: 'desc' },
                    take: 10
                }
            }
        }
    }
})
```

Tag count bar chart — separate two-query approach:
```typescript
const counts = await prisma().hisdoc_event_tag.groupBy({
    by: ['tag_id'],
    where: { event: { persons: { some: { person_id: id } } } },
    _count: { tag_id: true }
});
const tags = await prisma().hisdoc_tag.findMany({ where: { id: { in: counts.map(c => c.tag_id) } } });
const bars = tags.map(t => ({
    label: t.name,
    value: counts.find(c => c.tag_id === t.id)!._count.tag_id,
    color: '#' + (t.color >>> 0).toString(16).padStart(6, '0')
})).sort((a, b) => b.value - a.value);
```

Display name: if `person.type === 'MINECRAFT'` call `await getMinecraftUsername(person.data)`; else use `person.data`.

Two-column layout:
- Left: person name as title, person ID, involved-in events table, posted events table (only if `linked_user` is non-null), `<BarGraph bars={bars} />`
- Right: for MINECRAFT: `<PersonAvatar />`, UUID text, NameMC link (`https://namemc.com/profile/<uuid>`); for NPC: nothing special; either way: post count, event count

---

## Phase 4 — Final assembly

Two independent tasks; run in parallel after Phase 3 completes.

---

### Agent 10 — Timeline root page

**Writes:**
- `page.tsx`

**Reads:** `ui/InfiniteTimeline.tsx` (Agent 7), `ui/TimelineFilters.tsx` (Agent 7), `lib/timeline-filter.ts` (Agent 5), `lib/flexidate.ts` (Agent 1), `com/lib/prisma`

#### `page.tsx`

Server Component. Receives `searchParams: Promise<Record<string, string>>` (Next.js 15+ async searchParams).

```typescript
const params = await searchParams;
const filters = parseTimelineFilters(new URLSearchParams(params));
const filterParamStr = new URLSearchParams(params).toString();

const [initialEvents, allTags, allPersons] = await Promise.all([
    prisma().hisdoc_event.findMany({
        where: buildTimelineWhere(filters),
        orderBy: [{ sort_key: 'desc' }, { id: 'desc' }],
        take: 20,
        select: {
            id: true, name: true, description: true,
            event_date_type: true, event_date1: true, event_date_time_offset: true,
            event_date_units: true, event_date_diff: true, event_date2: true,
            tags: { include: { tag: { select: { id: true, name: true, color: true } } } }
        }
    }),
    prisma().hisdoc_tag.findMany({ orderBy: { name: 'asc' } }),
    prisma().hisdoc_person.findMany({ orderBy: { data: 'asc' } })
]);
```

Convert BigInts before passing to client components: `event_date1: Number(e.event_date1)`, etc.

Renders:
```tsx
<TimelineFilters tags={allTags} persons={allPersons} currentFilters={filters} />
<InfiniteTimeline
    key={filterParamStr}
    initialEvents={serialisedEvents}
    filterParams={filterParamStr}
/>
```

---

### Agent 11 — Add and edit event pages

**Writes:**
- `event/add/page.tsx`
- `event/edit/[id]/page.tsx`

**Reads:** `ui/EventForm.tsx` (Agent 8), `actions.ts` (Agent 5), `nxt/lib/session.ts`, `com/lib/prisma`

Both pages fetch all tags and all persons to pass to `<EventForm>`.

#### `event/add/page.tsx`

Server Component:
```typescript
await requireArea('hisdoc');
const [tags, persons] = await Promise.all([
    prisma().hisdoc_tag.findMany({ orderBy: { name: 'asc' } }),
    prisma().hisdoc_person.findMany({ orderBy: { data: 'asc' } })
]);
```

```tsx
<EventForm
    action={addEvent}
    tags={tags}
    persons={persons}
    isEdit={false}
/>
```

#### `event/edit/[id]/page.tsx`

Server Component:
```typescript
await requireArea('hisdoc');
const [event, tags, persons] = await Promise.all([
    prisma().hisdoc_event.findUnique({
        where: { id },
        include: {
            tags: true,
            persons: true,
            related_events_a: { select: { event_b_id: true } },
            related_events_b: { select: { event_a_id: true } }
        }
    }),
    prisma().hisdoc_tag.findMany({ orderBy: { name: 'asc' } }),
    prisma().hisdoc_person.findMany({ orderBy: { data: 'asc' } })
]);
if (!event) notFound();

const defaultValues = {
    name: event.name,
    description: event.description,
    details: event.details ?? undefined,
    date: { event_date_type: event.event_date_type, ... },  // spread FlexiDate fields
    tagIds: event.tags.map(t => t.tag_id),
    personIds: event.persons.map(p => p.person_id),
    relatedEventIds: [
        ...event.related_events_a.map(r => r.event_b_id),
        ...event.related_events_b.map(r => r.event_a_id)
    ]
};
```

Pass `action={editEvent.bind(null, id)}` (partial application to fix the ID). Import `editEvent` from `../../../actions` and bind the `id`:
```tsx
<EventForm
    action={editEvent.bind(null, event.id)}
    defaultValues={defaultValues}
    tags={tags}
    persons={persons}
    isEdit={true}
/>
```

---

## File Ownership Summary

| File | Owner |
|------|-------|
| `doc/Databases.md` | Agent 0 |
| `com/lib/auth.ts` | Agent 0 |
| `com/lib/webhook.ts` | Agent 0 |
| `lib/flexidate.ts` | Agent 1 |
| `lib/minecraft.ts` | Agent 1 |
| `ui/TagChip.tsx` | Agent 2 |
| `ui/PersonAvatar.tsx` | Agent 2 |
| `ui/BarGraph.tsx` | Agent 2 |
| `ui/FlexiDateInput.tsx` | Agent 3 |
| `ui/TagSelector.tsx` | Agent 3 |
| `ui/FlexiDateDisplay.tsx` | Agent 4 |
| `ui/TimelineItem.tsx` | Agent 4 |
| `actions.ts` | Agent 5 |
| `api/timeline/route.ts` | Agent 5 |
| `lib/timeline-filter.ts` | Agent 5 |
| `layout.tsx` | Agent 6 |
| `tags/page.tsx` | Agent 6 |
| `tag/[id]/page.tsx` | Agent 6 |
| `persons/page.tsx` | Agent 6 |
| `ui/InfiniteTimeline.tsx` | Agent 7 |
| `ui/TimelineFilters.tsx` | Agent 7 |
| `ui/EventForm.tsx` | Agent 8 |
| `event/[id]/page.tsx` | Agent 9 |
| `person/[id]/page.tsx` | Agent 9 |
| `page.tsx` | Agent 10 |
| `event/add/page.tsx` | Agent 11 |
| `event/edit/[id]/page.tsx` | Agent 11 |

No two agents write the same file. Agents only read files owned by prior phases.
