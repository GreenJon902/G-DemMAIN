# HisDoc — Annotated Database Schema

All table names use a configurable `{prefix}` (defaults to empty string). The database is MySQL.

---

## Table: `Person`

Represents a named entity that can be involved in events.

```sql
CREATE TABLE Person (
    pid        INTEGER      NOT NULL AUTO_INCREMENT,
    personType ENUM('MINECRAFT', 'MISCELLANEOUS') NOT NULL,
    personData VARCHAR(36),                -- UUID for MINECRAFT; name string for MISCELLANEOUS
    PRIMARY KEY (pid),
    UNIQUE (personType, personData)        -- no duplicate MC UUIDs or NPC names
);
```

| Column | Type | Notes |
|--------|------|-------|
| `pid` | INT PK | Auto-assigned person ID |
| `personType` | ENUM | `MINECRAFT` = real player; `MISCELLANEOUS` = NPC/named entity |
| `personData` | VARCHAR(36) | UUID (36 chars) for MC players; arbitrary name for NPCs |

**Relationships:**
- Referenced by `Event.postedPid`, `ChangeLog.authorPid`, `EventPersonRelation.pid`

---

## Table: `Event`

The core entity. One row per documented historical event.

```sql
CREATE TABLE Event (
    eid                 INTEGER      NOT NULL AUTO_INCREMENT,
    name                VARCHAR(255) NOT NULL,
    description         LONGTEXT     NOT NULL,
    details             LONGTEXT,                  -- nullable: optional warnings / unknowns
    postedPid           INTEGER      REFERENCES Person(pid),  -- nullable: who submitted this
    postedDate          BIGINT UNSIGNED NULL,       -- Unix timestamp in seconds; auto-set on insert

    eventDateType       ENUM('c', 'r') NOT NULL,   -- 'c' = centered, 'r' = ranged
    eventDate1          BIGINT NOT NULL,            -- centre (centered) or start (ranged), in eventDateUnits or days
    eventDateTimeOffset SMALLINT NOT NULL,          -- UTC offset in minutes (e.g. 60 = UTC+1)

    eventDateUnits      ENUM('d', 'h', 'm'),        -- only set when type='c'; d=days h=hours m=minutes
    eventDateDiff       BIGINT UNSIGNED,            -- only set when type='c'; margin of error in same units
    eventDate2          BIGINT UNSIGNED,            -- only set when type='r'; end of range in days

    PRIMARY KEY (eid),
    UNIQUE (name),

    -- Centered: must have units + diff, must NOT have date2
    CONSTRAINT CheckDate_c_units CHECK ((eventDateType = 'c') = (eventDateUnits IS NOT NULL)),
    CONSTRAINT CheckDate_c_diff  CHECK ((eventDateType = 'c') = (eventDateDiff IS NOT NULL)),
    CONSTRAINT CheckDate_c_date2 CHECK ((eventDateType = 'c') = (eventDate2 IS NULL)),

    -- Ranged: must NOT have units + diff, must have date2
    CONSTRAINT CheckDate_b_units  CHECK ((eventDateType = 'r') = (eventDateUnits IS NULL)),
    CONSTRAINT CheckDate_b_diff   CHECK ((eventDateType = 'r') = (eventDateDiff IS NULL)),
    CONSTRAINT CheckDate_b_date2  CHECK ((eventDateType = 'r') = (eventDate2 IS NOT NULL)),

    -- date1 <= date2 for ranged
    CONSTRAINT CheckDate_b_date2_after CHECK (eventDate1 <= eventDate2)
);
```

| Column | Type | Notes |
|--------|------|-------|
| `eid` | INT PK | Auto-assigned event ID |
| `name` | VARCHAR(255) UNIQUE | Short, unique event title |
| `description` | LONGTEXT | Full description (main body text) |
| `details` | LONGTEXT nullable | Optional notes about unknowns or things needing clarification |
| `postedPid` | INT FK nullable | Person who submitted the event |
| `postedDate` | BIGINT UNSIGNED nullable | Unix timestamp (seconds) when submitted |
| `eventDateType` | ENUM | `c` = CenteredFlexiDateTime, `r` = RangedFlexiDate |
| `eventDate1` | BIGINT | Centre value (centered) or range start (ranged) |
| `eventDateTimeOffset` | SMALLINT | UTC offset in minutes |
| `eventDateUnits` | ENUM nullable | Only for type='c': `d`/`h`/`m` |
| `eventDateDiff` | BIGINT UNSIGNED nullable | Only for type='c': margin of error |
| `eventDate2` | BIGINT UNSIGNED nullable | Only for type='r': range end in days |

**Relationships:**
- `postedPid` → `Person.pid`
- Referenced by `ChangeLog.eid`, `EventTagRelation.eid`, `EventPersonRelation.eid`, `EventEventRelation`

---

## Table: `Tag`

A category/label that can be applied to events.

```sql
CREATE TABLE Tag (
    tid         INTEGER      NOT NULL AUTO_INCREMENT,
    name        VARCHAR(255) NOT NULL,
    description LONGTEXT     NOT NULL,
    color       INTEGER      NOT NULL,   -- RGB value packed into an integer (e.g. 0xFF0000 = red)
    PRIMARY KEY (tid)
);
```

| Column | Type | Notes |
|--------|------|-------|
| `tid` | INT PK | Auto-assigned tag ID |
| `name` | VARCHAR(255) | Display name (e.g. "Combat", "Politics") |
| `description` | LONGTEXT | Description of what events belong under this tag |
| `color` | INT | RGB integer — formatted as `#RRGGBB` hex for display; e.g. `16711680` = `#FF0000` |

**Relationships:**
- Referenced by `EventTagRelation.tid`

---

## Table: `ChangeLog`

Audit log of edits to events. One row per edit.

```sql
CREATE TABLE ChangeLog (
    cid         INTEGER      NOT NULL AUTO_INCREMENT,
    eid         INTEGER      NOT NULL REFERENCES Event(eid),
    description LONGTEXT     NOT NULL,      -- human-written summary of what changed
    authorPid   INTEGER      NOT NULL REFERENCES Person(pid),
    date        BIGINT UNSIGNED NOT NULL,   -- Unix timestamp in seconds
    PRIMARY KEY (cid)
);
```

| Column | Type | Notes |
|--------|------|-------|
| `cid` | INT PK | Auto-assigned changelog ID |
| `eid` | INT FK | The event that was edited |
| `description` | LONGTEXT | What was changed (free text by the editor) |
| `authorPid` | INT FK | Person who made the edit |
| `date` | BIGINT UNSIGNED | Unix timestamp (seconds) of the edit |

---

## Table: `EventTagRelation`

Many-to-many: events ↔ tags.

```sql
CREATE TABLE EventTagRelation (
    eid INTEGER NOT NULL REFERENCES Event(eid),
    tid INTEGER NOT NULL REFERENCES Tag(tid)
);
```

| Column | Notes |
|--------|-------|
| `eid` | Event |
| `tid` | Tag assigned to that event |

---

## Table: `EventPersonRelation`

Many-to-many: events ↔ people involved in those events.

```sql
CREATE TABLE EventPersonRelation (
    eid INTEGER NOT NULL REFERENCES Event(eid),
    pid INTEGER NOT NULL REFERENCES Person(pid)
);
```

| Column | Notes |
|--------|-------|
| `eid` | Event |
| `pid` | Person involved in that event |

---

## Table: `EventEventRelation`

Many-to-many: events ↔ related events. Bidirectional — only one row per pair is stored; queries union both directions.

```sql
CREATE TABLE EventEventRelation (
    eid1 INTEGER NOT NULL REFERENCES Event(eid),
    eid2 INTEGER NOT NULL REFERENCES Event(eid)
);
```

| Column | Notes |
|--------|-------|
| `eid1` | First event |
| `eid2` | Related event |

---

## Entity-Relationship Summary

```
User (auth, in-game)
  └─ links to ─── Person (pid)
                     │
          ┌──────────┼──────────┐
          │          │          │
       posted     involved   authored
       events     in events  changelogs
          │          │
        Event ──── EventEventRelation (self-ref)
          │
          ├── EventTagRelation ──── Tag
          ├── EventPersonRelation ── Person
          └── ChangeLog (edit history)
```

## Notes on data types

- All timestamps are **Unix timestamps in seconds** (not milliseconds). JavaScript's `Date` expects milliseconds, so multiply by 1000 when converting.
- `color` is stored as a plain integer representing the RGB value. Convert with `(n >>> 0).toString(16).padStart(6, '0')` → `#rrggbb`.
- `eventDate1` for centered type is stored in `eventDateUnits` (could be minutes, hours, or days — not always seconds). For ranged type it is always **days**.
