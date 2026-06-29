# HisDoc JS Architecture — Overview

## Goals

Migrate HisDoc from a Java embedded-HTTP-server mod into a Next.js section of g_web (`/hisdoc`), adopting the existing panel UI theme, g_web authentication, Prisma for DB access, and a set of specific feature changes.

---

## Confirmed Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| URL prefix | `/hisdoc` | Top-level, separate from `/panel`; keeps HisDoc independent |
| Root route | `/hisdoc` = timeline | Skips unnecessary landing page |
| Access control | Public read, `has_hisdoc_access` write | Dedicated flag + `hisdoc` area in auth system |
| Auth mechanism | g_web `user` table + `iron-session` | Replaces /link system |
| Database | Same g_web DB; `doc/Databases.md` is source of truth | Changes go to Databases.md → DB → `prisma db pull` |
| DB access | `@g/com/lib/prisma` | Replaces Java Dispatcher |
| Person types | `MINECRAFT` \| `NPC` | NPC replaces MISCELLANEOUS |
| MC ticks | Removed | No longer relevant |
| Player viewer | Grey box placeholder | MineRender.org dropped |
| Bar charts | Custom SVG `BarGraph` component | Extends existing approach; see below |
| Webhooks | Extend `com/lib/webhook.ts` | Add `hisdoc_event_added` and `hisdoc_event_edited` types |
| Timeline | Infinite scroll (server-side pagination) | Avoids loading full dataset upfront |
| Author display | Always `g_web.user.username` | Never shows person table name |
| UI theme | Same dark theme as panel | `bg-gray-900`, Tailwind, existing components |

---

## Bar Chart Library Decision

**Choice: extend `Graph.tsx` with a new `BarGraph` component.**

The existing `Graph.tsx` is a custom SVG approach. A new `BarGraph` component will sit alongside it in `nxt/app/hisdoc/ui/BarGraph.tsx` and follow the same visual style (gray-800 background, grid lines, legend, axis labels).

Key difference from `Graph.tsx`: tag colours come from the database as RGB integers. This means Tailwind class-based colour systems (like `LINE_COLORS`) cannot be used for bar fills — the colour isn't known at build time. Instead, bars use SVG `fill` attributes set from a runtime hex colour string (e.g. `fill="#ff0000"`).

**Why not a library?**

| Option | Verdict |
|--------|---------|
| Recharts | Would work. SVG-based, React-native. But adds ~150 KB to the bundle, and styling to match the dark Tailwind theme requires custom override work. |
| Chart.js | Canvas-based, poor SSR story, inconsistent with the SVG approach, adds ~200 KB. |
| D3.js | Maximum power, but very verbose for simple bar charts and awkward to compose with React's rendering model. |
| Custom SVG | Zero deps, fully consistent with panel, only slightly more upfront code. The axis/legend/grid infrastructure from `Graph.tsx` can be replicated. |

For bar charts whose only use case is "event counts per tag on a person's profile page", the complexity of any library outweighs the benefit. A bespoke `BarGraph` is the right call.

---

## Key Architectural Changes vs Original

### What stays the same (conceptually)

- 7 core data entities (person, event, tag, changelog + 3 junction tables)
- FlexiDate flexible date system (two variants: centered and ranged)
- Filter logic on the timeline (Ex/Ig/In/Re per tag/person, date range, text search)
- Event form fields (name, description, details, tags, persons, related events, date)

### What changes

| Original | New |
|----------|-----|
| Java SSR via custom builder system | Next.js App Router, React Server Components |
| Custom HTTP server + Dispatcher | Next.js routing + Prisma |
| /link session auth (MC in-game command) | g_web iron-session (username/password) |
| `postedPid` → Person | `posted_by_user_id` → user |
| Changelog `authorPid` → Person | `author_user_id` → user |
| MiscellaneousPerson ("MISCELLANEOUS") | NPC |
| MC ticks/playtime on person page | Removed |
| MineRender.org iframe | Grey box `<div>` |
| QuickChart.io bar chart | Custom SVG `BarGraph` |
| All events loaded upfront for timeline | Paginated API with infinite scroll |
| Client-side JS filter with cookies | URL-param filters (server-side) + IntersectionObserver |
| Light/dark theme switcher | Always dark (panel theme) |

---

## Auth Model

The original required a two-step /link flow (visit website, run in-game command) before a user could post events. This is replaced by a `has_hisdoc_access` flag on the `user` table, gated through the existing area system.

```
Public (unauthenticated): can view timeline, events, persons, tags
User with has_hisdoc_access = true: can also add and edit events
```

**Changes to `com/lib/auth.ts`:**
- Add `hisdoc: { requireSudo: false }` to the `AREAS` const
- Update `userToAreaAccess` to include `hisdoc: user.has_hisdoc_access`
- Update the DB select in `strictCheckUser` to also fetch `has_hisdoc_access`

**Usage in HisDoc:**
- Navbar "Add Event" button: `NS.optimisticCheckUser('hisdoc')` (cached, for display only)
- Add/edit page guards: `requireArea('hisdoc')` (optimistic check, redirects if denied)
- Server actions: `NS.strictRequireUser('hisdoc')` (hits the DB; revocation takes effect immediately; also enforces sudo mode if the user has 2FA enabled, since `needsSudo = AREAS[area].requireSudo || totp_secret !== null` applies even when `requireSudo: false`)

Note: if a user has 2FA (`totp_secret` set), the existing `auth.ts` logic (`needsSudo = requireSudo || totp_secret !== null`) means they still need active sudo mode to pass `strictCheckUser('hisdoc')`. Optimistic checks bypass this since they only use cached session data. This is acceptable for a passion project — the add/edit pages use optimistic checks.

---

## User ↔ Person Link

A `hisdoc_person` row has an optional `linked_user_id` FK pointing to `user.id` (nullable, unique). This lets server players who have g_web accounts be associated with their history entry, but:

- Persons can exist without a linked user (NPCs, MC players who never registered)
- The link does NOT affect who can edit events — that is controlled by `has_hisdoc_access`
- The link does NOT affect changelog display — usernames from `user.username` are always shown

The person link is purely informational: it tells you which website account corresponds to which historical person.

---

## Timeline Filtering Architecture

Filters are encoded in URL searchParams. On filter change, the client calls `router.replace()` which re-renders the Server Component with new params. On scroll-to-bottom, the client fetches additional pages from `/hisdoc/api/timeline` with the same params.

Filter state encoding:
```
?tags=3:re,7:ex     (tid:state, omit "ig" since it's the default)
?persons=1:re        (pid:state)
?from=2021-01-01&to=2021-06-01&dateMode=inclusive
?q=battle+of
```

The API route (`/hisdoc/api/timeline`) accepts these params + a `cursor` (last event ID seen) and returns the next batch.

---

## Timeline Sort Key

The original sort formula converts `eventDate1` to seconds based on type/units. The `sort_key` column on `hisdoc_event` stores this value for efficient `ORDER BY sort_key DESC, id DESC` queries without a runtime CASE expression.

Because `doc/Databases.md` is the source of truth and the table is defined in raw SQL, `sort_key` is a **MariaDB STORED generated column** (`GENERATED ALWAYS AS (...) STORED`). MariaDB computes and maintains it automatically on every insert/update — the application does not write it. An index on `sort_key` is created in the same `CREATE TABLE` statement.
