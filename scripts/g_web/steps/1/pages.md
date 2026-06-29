# HisDoc — Pages / Routes

All routes are GET endpoints served by the embedded HTTP server, except the two submit endpoints which handle POST. Auth is session-cookie based (original `/link` system, being replaced in the JS migration).

---

## Route Table

| Route | Handler | Auth required | Purpose |
|-------|---------|---------------|---------|
| `/` | `HomePageRenderer` | None | Welcome/about page |
| `/timeline` | `TimelinePageRenderer` | None | All events with filter UI |
| `/event?id=<eid>` | `EventPageRenderer` | None (edit icon needs auth) | Event detail |
| `/person?id=<pid>` | `PersonPageRenderer` | None | Person profile |
| `/persons` | `PersonsPageRenderer` | None | All people list |
| `/tag?id=<tid>` | `TagPageRenderer` | None | Tag detail + events |
| `/tags` | `TagsPageRenderer` | None | All tags list |
| `/add` | `AddEventPageRenderer` | `ADD_EVENT` | Add event form |
| `/addEventSubmit` | `AddEventSubmitPageRenderer` | `ADD_EVENT` | POST: process new event |
| `/edit?id=<eid>` | `EditEventPageRenderer` | `EDIT_EVENT` | Edit event form (prefilled) |
| `/editEventSubmit` | `EditEventSubmitPageRenderer` | `EDIT_EVENT` | POST: process event edit |
| `/themes` | `CssPageRenderer` | None | CSS stylesheet |

---

## Page Layouts

### `/` — Home

Simple welcome page. Navbar + project description text. No data loaded from DB.

---

### `/timeline` — Timeline

The main hub. Two sections stacked vertically.

**Filters section (top)**

A table of filter dropdowns:
- **Set All** buttons: "Ex" (Excluded), "Ig" (Ignored), "In" (Included), "Re" (Required) — sets all tag/person filters at once
- **Per-tag** dropdown: Ex / Ig / In / Re
- **Per-person** dropdown: Ex / Ig / In / Re
- **Date range** pickers: start date, end date, and an "Exclusive / Inclusive" toggle (exclusive = event fully within range; inclusive = event overlaps range)
- **Text search** field

All filter state is persisted in cookies; restored on next visit.

**Filter logic (client-side JS):**
- A tag with Ex → hide events that have it
- A tag with Re → show only events that have it
- A tag with In → show if not otherwise excluded
- A tag with Ig → no effect
- Persons use the same logic
- Date filters applied against `earliestUnix` and `latestUnix`
- Text filter is a substring match on event name + description

**Timeline section (bottom)**

Events rendered in reverse chronological order (newest first). Each entry:
- Event name (link to `/event?id=<eid>`)
- FlexiDate string
- Event description (full text)

Data loaded: all events + all tags + all persons + all `EventTagRelation` + all `EventPersonRelation` in a single query batch (`getTimelineInfo.sql`). Entire dataset is loaded upfront — **no pagination in the original**.

---

### `/event?id=<eid>` — Event Detail

Two-column layout.

**Left column:**
- Title (event name) + optional edit icon (only if `EDIT_EVENT` permission)
- EID displayed in grey
- Optional "details" box (warning style) — shown only if `details` is non-null
- "Description" subtitle + full description text
- "Changelog" subtitle + table:
  - Row 0: posted date | posted-by person (link) | "This event was created!"
  - Rows 1..n: change date | author (link) | change description

**Right column:**
- FlexiDate string (misc style)
- "Tags" — list of coloured tag chips (sorted alphabetically by name)
- "Related Events" — list of event name links (sorted alphabetically)
- "Related Persons" — list of person name links (sorted alphabetically)

---

### `/person?id=<pid>` — Person Profile

Two-column layout.

**Left column:**
- Person name as title
- PID in grey
- "Recent Events" — table of `date — event name (link)` (events this person was involved in)
- "Recent Posts" — same format but events this person submitted
- "Tags" — bar chart showing count of events per tag for this person. Each bar is coloured by the tag's colour. (Rendered via QuickChart.io in the original — **being replaced**.)

**Right column (Minecraft player):**
- MineRender.org iframe showing 3D skin (**being replaced with grey box**)
- Link to NameMC profile
- UUID
- Post count
- Event count
- Ticks played (playtime — **being removed**)

**Right column (Miscellaneous/NPC):**
- Post count
- Event count

---

### `/persons` — All Persons

Simple list of all people, sorted alphabetically. Each entry is a link to `/person?id=<pid>`.

---

### `/tag?id=<tid>` — Tag Detail

- Tag name as title
- Tag colour swatch
- Description
- "Recent Events" table (events with this tag, by date, linking to event pages)

---

### `/tags` — All Tags

List of all tags, each as a coloured chip linking to `/tag?id=<tid>`.

---

### `/add` — Add Event Form

Requires `ADD_EVENT` permission (i.e. linked MC account in the original). If not authorised, shows the `/hs link <code>` instruction.

Form fields:
| Field | Input type | Required | Notes |
|-------|-----------|----------|-------|
| Name | Single-line text | Yes | Pattern: anything except newlines; must be unique |
| Description | Textarea (5 rows) | Yes | Full event description |
| Details | Textarea (5 rows) | No | Warnings, unknowns, todos |
| Tags | Checkbox grid (one per tag) | No | Tag chips, sorted alphabetically |
| People | Checkbox list (one per person) | No | Person names, sorted alphabetically |
| Events | Single-line text | No | Comma-separated EIDs of related events |
| Date | FlexiDate widget | Yes | Type selector (centered/ranged) + appropriate sub-fields |

On submit: POST to `/addEventSubmit`. On leave with unsaved data: browser confirms navigation.

---

### `/edit?id=<eid>` — Edit Event Form

Same form as Add, prefilled with current event values. Requires `EDIT_EVENT` permission.

Additional field (not in Add):
| Field | Input type | Notes |
|-------|-----------|-------|
| Changelog entry | Textarea | Required when editing — describes what changed |

On submit: POST to `/editEventSubmit`.

---

## FlexiDate Input Widget

The date input in the add/edit forms works as follows:

**Type selector** (radio): Centered | Ranged

**Centered sub-fields:**
- Center value (number)
- Units (dropdown: Days / Hours / Minutes)
- Difference (number, defaults to 0)
- UTC offset (number, in minutes)

**Ranged sub-fields:**
- Start date (date picker → days since epoch)
- End date (date picker)
- UTC offset (number, in minutes)

---

## Navbar

Present on all pages. Links to: Home, Timeline, Tags, Persons. Conditionally shows "Add Event" if user has permission. Includes a theme switcher (light/dark).
