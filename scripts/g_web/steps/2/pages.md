# HisDoc JS Architecture — Pages & Components

## Route Map

```
/hisdoc                     Timeline (Server Component + Client scroll)
/hisdoc/event/[id]          Event detail (Server Component)
/hisdoc/event/add           Add event form (Server Component, auth-gated)
/hisdoc/event/edit/[id]     Edit event form (Server Component, auth-gated)
/hisdoc/person/[id]         Person profile (Server Component)
/hisdoc/persons             All persons list (Server Component)
/hisdoc/tag/[id]            Tag detail (Server Component)
/hisdoc/tags                All tags list (Server Component)
/hisdoc/api/timeline        Paginated timeline API (GET handler)
```

---

## File Layout

```
nxt/app/hisdoc/
├── layout.tsx                   HisDoc navbar (public, no auth gate)
├── page.tsx                     Timeline page
├── event/
│   ├── [id]/
│   │   └── page.tsx
│   ├── add/
│   │   └── page.tsx
│   └── edit/[id]/
│       └── page.tsx
├── person/[id]/
│   └── page.tsx
├── persons/
│   └── page.tsx
├── tag/[id]/
│   └── page.tsx
├── tags/
│   └── page.tsx
├── actions.ts                   Server actions (addEvent, editEvent)
├── api/
│   └── timeline/
│       └── route.ts             GET handler for paginated timeline
├── lib/
│   ├── flexidate.ts             FlexiDate utilities
│   └── minecraft.ts             MC username lookup (placeholder)
└── ui/
    ├── HisDocNavbar.tsx
    ├── TagChip.tsx
    ├── PersonAvatar.tsx
    ├── BarGraph.tsx
    ├── FlexiDateDisplay.tsx
    ├── TimelineItem.tsx
    ├── InfiniteTimeline.tsx     "use client"
    ├── TimelineFilters.tsx      "use client"
    ├── EventForm.tsx            "use client"
    ├── FlexiDateInput.tsx       "use client"
    └── TagSelector.tsx          "use client"
```

---

## Layout (`layout.tsx`)

No auth check. Renders a full-width dark header (matching panel style) + `<main>` wrapper.

Header contents:
- Title: "HisDoc" (large, bold, link to `/hisdoc`)
- Nav buttons (using existing `LinkButton`): Timeline (`/hisdoc`), Tags (`/hisdoc/tags`), Persons (`/hisdoc/persons`)
- "Add Event" button shown only when the user has HisDoc write access — checked server-side via `NS.optimisticCheckUser('hisdoc')`

```tsx
// layout.tsx (Server Component)
const canEdit = await NS.optimisticCheckUser('hisdoc');
// render header with conditional AddEvent link
```

---

## Pages

### `/hisdoc` — Timeline (`page.tsx`)

Server Component. Receives `searchParams` (filter state).

1. Reads filter params from `searchParams`
2. Runs initial DB query: first 20 events matching the active filters, ordered by `sort_key DESC, id DESC`
3. Fetches all tags and all persons (for the filter UI — needed regardless of active filters)
4. Renders `<TimelineFilters>` (client component) with all tags/persons and current filter state
5. Renders `<InfiniteTimeline>` (client component) seeded with the first 20 events

**Data queries:**
```typescript
// First page of events (simplified):
prisma().hisdoc_event.findMany({
  where: buildTimelineWhere(filters),
  orderBy: [{ sort_key: 'desc' }, { id: 'desc' }],
  take: 20,
  include: { tags: { include: { tag: true } }, persons: { include: { person: true } } }
})
```

---

### `/hisdoc/api/timeline` — Pagination API (`route.ts`)

GET handler. No auth required.

**Why a route handler and not a Server Action?** `IntersectionObserver` fires inside the browser after the initial SSR render. At that point there is no mechanism to invoke a Server Component (they run only during SSR/RSC rendering triggered by navigation). Server Actions are semantically for mutations; using one as a read endpoint is non-idiomatic and may trigger Next.js warnings. A GET route handler is the correct conventional pattern for client-initiated data fetching.

Query params:
- `cursor` — the `id` of the last event seen (for stable pagination)
- All filter params (same as the page searchParams)

Returns JSON: `{ events: TimelineEvent[], hasMore: boolean }`

**Cursor pagination:**
```typescript
// Fetch events after the cursor, maintaining sort order
prisma().hisdoc_event.findMany({
  where: {
    AND: [
      buildTimelineWhere(filters),
      // Events with lower sort_key than cursor, or same sort_key but lower id
      { OR: [
        { sort_key: { lt: cursorEvent.sort_key } },
        { AND: [{ sort_key: cursorEvent.sort_key }, { id: { lt: cursorEvent.id } }] }
      ]}
    ]
  },
  orderBy: [{ sort_key: 'desc' }, { id: 'desc' }],
  take: 20,
  ...
})
```

**BigInt serialisation:** All `BigInt` fields are converted to `number` before JSON serialisation (all FlexiDate values fit within JS safe integer range).

---

### `/hisdoc/event/[id]` — Event Detail (`page.tsx`)

Server Component. Queries the event with all relations.

**Data:**
```typescript
prisma().hisdoc_event.findUnique({
  where: { id },
  include: {
    tags: { include: { tag: true }, orderBy: { tag: { name: 'asc' } } },
    persons: { include: { person: true }, orderBy: { person: { name: 'asc' } } },
    related_events_a: { include: { event_b: { select: { id: true, name: true } } } },
    related_events_b: { include: { event_a: { select: { id: true, name: true } } } },
    changelog: { include: { author_user: { select: { username: true } } }, orderBy: { created_at: 'asc' } },
    posted_by_user: { select: { username: true } }
  }
})
```

Related events from both directions are merged: `[...event.related_events_a.map(r => r.event_b), ...event.related_events_b.map(r => r.event_a)]`, deduplicated and sorted by name.

**Layout (two columns):**

Left:
- Title + optional edit link to `/hisdoc/event/edit/[id]` (shown if `canEdit`, checked via `NS.optimisticCheckUser('hisdoc')`)
- Event ID (misc text)
- Optional `details` box (warning style) if non-null
- "Description" heading + description text
- "Changelog" heading + table: rows for initial post + all edits, each showing `created_at` | `username` | note

Right:
- FlexiDate display string
- Tags (using `<TagChip>` components, sorted A-Z)
- Related Events (links, sorted A-Z)
- Related Persons (links, sorted A-Z)

---

### `/hisdoc/person/[id]` — Person Profile (`page.tsx`)

Server Component.

**Data:**
```typescript
prisma().hisdoc_person.findUnique({
  where: { id },
  include: {
    // Recent events this person was involved in (newest first, limit 10)
    involved_in_events: {
      include: { event: { select: { id: true, name: true, ...flexiDateFields } } },
      orderBy: { event: { sort_key: 'desc' } },
      take: 10
    },
    // Recent events this person posted (newest first, limit 10)
    posted_events: {
      select: { id: true, name: true, ...flexiDateFields },
      orderBy: { sort_key: 'desc' },
      take: 10
    },
    // All tags across this person's events, with counts
    // (computed via aggregation query, not a simple include)
  }
})
```

Tag counts for the bar chart require a separate aggregation:
```typescript
prisma().hisdoc_event_tag_relation.groupBy({
  by: ['tag_id'],
  where: { event: { persons: { some: { person_id: id } } } },
  _count: { tag_id: true },
  include: { ... }  // need tag name + color
})
```
Actually Prisma's `groupBy` doesn't support `include`. Instead:
```typescript
// Raw approach: groupBy then lookup tags separately
const counts = await prisma().hisdoc_event_tag_relation.groupBy({
  by: ['tag_id'],
  where: { event: { persons: { some: { person_id: id } } } },
  _count: { tag_id: true }
});
const tagIds = counts.map(c => c.tag_id);
const tags = await prisma().hisdoc_tag.findMany({ where: { id: { in: tagIds } } });
// merge counts + tag info
```

**Layout (two columns):**

Left:
- Person name as title
- Person ID (misc text)
- "Recent Events" heading + table (date — event name link)
- "Recent Posts" heading + table (events posted by this person)
- "Tags" heading + `<BarGraph>` (bars coloured by tag colour, labelled by tag name)

Right:
- For MINECRAFT: `<PersonAvatar>` (grey box), UUID, NameMC link, post count, event count
- For NPC: post count, event count only

---

### `/hisdoc/persons` — All Persons (`page.tsx`)

Server Component. Fetches all persons ordered by `data ASC`. Renders a list of links to `/hisdoc/person/[id]`.

Name display: all person types use the `data` column. For MINECRAFT persons, `data` is a UUID — the display name is obtained by calling `getMinecraftUsername(data)` from `lib/minecraft.ts`, which currently returns the UUID unchanged (see placeholder below).

---

### `/hisdoc/tag/[id]` — Tag Detail (`page.tsx`)

Server Component.

Data: tag info + recent events with this tag (ordered by sort_key DESC, limited to 20, with pagination if needed).

Layout:
- Tag name as title, colour swatch
- Description
- "Recent Events" heading + table (FlexiDate — event name link)

---

### `/hisdoc/tags` — All Tags (`page.tsx`)

Server Component. All tags sorted by name. Each rendered as a `<TagChip>` linking to `/hisdoc/tag/[id]`.

---

### `/hisdoc/event/add` — Add Event Form (`page.tsx`)

Server Component. Auth check at top via `requireArea('hisdoc')` (redirects to login if no session, 403 if logged in without `has_hisdoc_access`).

Renders `<EventForm>` with no default values.

---

### `/hisdoc/event/edit/[id]` — Edit Event Form (`page.tsx`)

Server Component. Auth check via `requireArea('hisdoc')` + fetches current event data. Renders `<EventForm>` prefilled.

---

### `actions.ts` — Server Actions

Two server actions:

**`addEvent(formData: FormData)`**
1. Auth check: `await NS.strictRequireUser('hisdoc')` (hits the DB; throws if not authenticated, lacks `has_hisdoc_access`, or has 2FA and is not in active sudo mode)
2. Parse + Zod-validate form data
3. Validate FlexiDate constraints (units null iff ranged, etc.) — belt-and-suspenders; DB enforces these too
4. Validate related event IDs exist
5. DB write: create `hisdoc_event` + all relation rows (in a transaction); `sort_key` is computed automatically by MariaDB
7. Send `sendHisDocEventAddedWebhook(eventName, username)`
8. Redirect to `/hisdoc/event/[newId]`

**`editEvent(id: number, formData: FormData)`**
1. Auth check: `await NS.strictRequireUser('hisdoc')`
2. Fetch existing event (404 if not found)
3. Parse + validate form data (includes `changelog_note` field, required for edits)
4. Validate FlexiDate constraints — belt-and-suspenders; DB enforces these too
5. DB write (transaction): update event + delete+recreate all relation rows + create changelog entry; `sort_key` is recomputed automatically by MariaDB
7. Send `sendHisDocEventEditedWebhook(eventName, username, changelogNote)`
8. Redirect to `/hisdoc/event/[id]`

---

## UI Components

### `HisDocNavbar.tsx`
Server Component. Uses `LinkButton` and `NS.optimisticCheckUser('hisdoc')` for the conditional Add Event button.

### `TagChip.tsx`
Renders a coloured pill for a tag. Uses inline `style={{ backgroundColor: '#rrggbb' }}` for the dynamic colour. Shows tag name; wraps in `<Link>` to `/hisdoc/tag/[id]`.

### `PersonAvatar.tsx`
Simple placeholder:
```tsx
<div className="size-48 rounded-md bg-gray-700" />
```

### `BarGraph.tsx`

Custom SVG bar chart. Props:
```typescript
type Bar = { label: string, value: number, color: string }  // color is CSS hex string
{
  bars: Bar[],
  graphClassName?: string,   // same API as Graph.tsx
  containerClassName?: string
}
```

Implementation: SVG bars with computed x/width positions, inline `fill` for colour, y-axis ticks (integer steps from 0 to max), label text below each bar. Grey-800 background, gray-700 grid lines (matching Graph.tsx style). If `bars` is empty, renders a "No data" text placeholder.

### `FlexiDateDisplay.tsx`
Server Component (no client state needed). Takes FlexiDate fields, calls `formatFlexiDate()` from `lib/flexidate.ts`, renders as styled text.

### `TimelineItem.tsx`
Renders one event card: name (link), FlexiDate display, description text. Used by `InfiniteTimeline`.

### `InfiniteTimeline.tsx`
`"use client"`. Holds the list of loaded events. Uses `IntersectionObserver` on a sentinel div at the bottom. When triggered, calls `/hisdoc/api/timeline?cursor=<lastId>&<filterParams>`. Appends new events to the list. Shows a loading indicator and "No more events" when exhausted.

Receives the initial events as a prop (from the Server Component) and the current filter params (also as a prop, derived from the URL searchParams). When filter params change (via React prop change on Server Component re-render), the component resets its list and re-seeds from the new initial events.

### `TimelineFilters.tsx`
`"use client"`. Renders the filter bar: tag dropdowns (Ex/Ig/In/Re), person dropdowns, date range pickers, text search. On any change, calls `router.replace()` with updated searchParams. Uses `useSearchParams()` to read current state.

### `EventForm.tsx`
`"use client"`. Shared form for add and edit. Props: `action` (the server action to call — either `addEvent` or `editEvent` partially applied with the event ID), `defaultValues?` (prefilled data for edit mode). The server action is passed as a prop from the parent Server Component page, which is permitted.

Contains:
- Text inputs for name, description, details
- `<TagSelector>` for tag checkboxes
- Person checkbox list
- Related events textarea (comma-separated IDs)
- `<FlexiDateInput>` for the date picker
- Changelog note field (only for edit mode)
- Submit `<ActionButton>` with a `makeAreaSudoGuard('hisdoc', ctx)` guard

Submit flow:
```tsx
const ctx = useAuthContext();
const formRef = useRef<HTMLFormElement>(null);

<form ref={formRef}>
  {/* ... fields ... */}
  <ActionButton
    guard={makeAreaSudoGuard('hisdoc', ctx)}
    action={async () => {
      const fd = new FormData(formRef.current!);
      await props.action(fd);
    }}
  >Submit</ActionButton>
</form>
```

The guard triggers the 2FA modal if sudo mode is required (i.e. the user has 2FA enabled); if not required it passes through immediately. If the guard returns `false` the action is aborted without touching the server.

### `FlexiDateInput.tsx`
`"use client"`. Shows a type selector (Centered / Ranged radio), then conditionally shows the appropriate sub-fields:
- Centered: center value + units dropdown + difference + UTC offset
- Ranged: start date picker + end date picker + UTC offset

Controlled component; serialises to hidden form fields.

### `TagSelector.tsx`
`"use client"`. Renders tag chips as toggleable buttons (selected = full colour, unselected = faded). Maintains selection state. Serialises selected tag IDs to hidden form fields.

---

## `lib/flexidate.ts`

Utility functions (no React):

```typescript
// Format for display ("2021-03-15 ±7D", "Somewhere between 2021-03-15 and 2021-03-22")
function formatFlexiDate(date: FlexiDateInput): string

// Format UTC offset for display (" UTC+60" etc.)
function formatOffset(offsetMinutes: number): string

// Earliest and latest possible unix timestamps (seconds) — used for date-range filtering
function earliestUnix(date: FlexiDateInput): bigint
function latestUnix(date: FlexiDateInput): bigint

// Parse form field values back into FlexiDate data
function parseFlexiDateForm(fields: FormData): FlexiDateInput | null
```

`FlexiDateInput` mirrors the Prisma model fields for the FlexiDate columns. Note: `computeSortKey` is not needed — `sort_key` is a MariaDB STORED generated column.

---

## `lib/minecraft.ts`

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

All code that displays a MINECRAFT person's name must call this function rather than reading `person.data` directly, so the display can be upgraded in one place when the TODO is resolved.
