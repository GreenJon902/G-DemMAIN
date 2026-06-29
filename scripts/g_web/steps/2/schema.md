# HisDoc JS Architecture — Database Schema Plan

## Source of Truth

`doc/Databases.md` is the source of truth for the database schema, not `schema.prisma`. The workflow for any schema change is:

1. Write or update the SQL in `doc/Databases.md`
2. Apply the change to the live MySQL database manually
3. In `scripts/g_web/com/`, run `npm run schema:pull` (`npx prisma db pull`) to regenerate `schema.prisma`
4. Run `npm run build` in `com/` to regenerate the Prisma TypeScript client
5. Restart Next.js

All SQL below follows the `doc/Databases.md` conventions: `lower_snake_case` names, `CREATE OR REPLACE TABLE`, column-level `COMMENT` strings.

---

## Changes to the Existing `user` Table

One new column is added to `user`:

```sql
-- Add to user table:
has_hisdoc_access BOOLEAN NOT NULL DEFAULT false
    COMMENT 'Is this user allowed to add and edit HisDoc events?'
```

Full table after the addition — for reference when comparing to `doc/Databases.md`:

```sql
CREATE OR REPLACE TABLE user (
    id INT AUTO_INCREMENT PRIMARY KEY
        COMMENT 'User id.',

    username VARCHAR(50) UNIQUE KEY NOT NULL
        COMMENT 'Unique login name.',

    password_hash VARCHAR(255) NOT NULL
        COMMENT 'Argon2 hash of the password. This is formatted like "$argon2id$v...".',

    has_panel_access BOOLEAN NOT NULL DEFAULT false
        COMMENT 'Is this user allowed to view and interact with the g_web system management panel?',

    has_hisdoc_access BOOLEAN NOT NULL DEFAULT false
        COMMENT 'Is this user allowed to add and edit HisDoc events?',

    tfa_secret VARCHAR(32) NULL
        COMMENT 'Secret for TOPT/2FA. This should be 32 base32 characters. If this is null then the user does not have 2fa'
);
```

---

## New HisDoc Tables

### `hisdoc_person`

```sql
CREATE OR REPLACE TABLE hisdoc_person (
    id INT AUTO_INCREMENT PRIMARY KEY
        COMMENT 'Person id.',

    type ENUM('MINECRAFT', 'NPC') NOT NULL
        COMMENT 'MINECRAFT for real MC accounts identified by UUID; NPC for named non-player entities.',

    data VARCHAR(255) NOT NULL
        COMMENT 'For MINECRAFT: the Minecraft account UUID in hyphenated format (e.g. "550e8400-e29b-41d4-a716-446655440000"). For NPC: the display name. Unique per type via uq_hisdoc_person_data.',

    linked_user_id INT NULL
        COMMENT 'Optional one-to-one link to a g_web user account.',

    UNIQUE KEY uq_hisdoc_person_data (type, data),
    UNIQUE KEY uq_hisdoc_person_linked_user (linked_user_id),
    -- If type is minecraft then data must be a valid UUID
    CONSTRAINT chk_hisdoc_person_minecraft_uuid CHECK (
        type != 'MINECRAFT' OR (
            CHAR_LENGTH(data) = 36 AND
            data REGEXP '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        )
    ),
    FOREIGN KEY (linked_user_id) REFERENCES user(id)
);
```

### `hisdoc_tag`

```sql
CREATE OR REPLACE TABLE hisdoc_tag (
    id INT AUTO_INCREMENT PRIMARY KEY
        COMMENT 'Tag id.',

    name VARCHAR(255) NOT NULL
        COMMENT 'Display name (e.g. "Combat", "Politics").',

    description LONGTEXT NOT NULL
        COMMENT 'Description of what events belong under this tag.',

    color INT NOT NULL
        COMMENT 'RGB colour packed as a signed integer (e.g. 16711680 = #FF0000). Converted to CSS hex by the application.'
);
```

### `hisdoc_event`

```sql
CREATE OR REPLACE TABLE hisdoc_event (
    id INT AUTO_INCREMENT PRIMARY KEY
        COMMENT 'Event id.',

    name VARCHAR(255) NOT NULL
        COMMENT 'Short, unique event title shown in listings and as the page heading.',

    description LONGTEXT NOT NULL
        COMMENT 'Full description of the event.',

    details LONGTEXT NULL
        COMMENT 'Optional notes about unknowns, uncertainties, or things needing clarification.',

    posted_by_user_id INT NULL
        COMMENT 'The g_web user who submitted this event. Nullable for events imported from the legacy system.',

    posted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        COMMENT 'When this event was submitted to the system.',

    -- FlexiDate: represents when the historical event occurred, with deliberate uncertainty.
    -- See doc/flexidate.md for full semantics.
    event_date_type ENUM('centered', 'ranged') NOT NULL
        COMMENT 'centered: event_date1 ± event_date_diff in event_date_units. ranged: anywhere between event_date1 and event_date2 in days.',

    event_date1 BIGINT NOT NULL
        COMMENT 'For centered: centre value in event_date_units since epoch. For ranged: start of range in days since epoch.',

    event_date_time_offset SMALLINT NOT NULL
        COMMENT 'UTC offset in minutes (e.g. 60 = UTC+1). Applied when formatting the date for display.',

    event_date_units ENUM('d', 'h', 'm') NULL
        COMMENT 'Unit for event_date1 and event_date_diff: d=days, h=hours, m=minutes. NULL for ranged events.',

    event_date_diff BIGINT UNSIGNED NULL
        COMMENT 'Margin of error for centered events (same units as event_date_units). NULL for ranged events.',

    event_date2 BIGINT UNSIGNED NULL
        COMMENT 'End of range in days since epoch for ranged events. NULL for centered events.',

    sort_key BIGINT GENERATED ALWAYS AS (
        event_date1 * CASE event_date_type
            WHEN 'centered' THEN CASE event_date_units
                WHEN 'd' THEN 86400
                WHEN 'h' THEN 3600
                WHEN 'm' THEN 60
                ELSE 1
            END
            WHEN 'ranged' THEN 86400
            ELSE 1
        END
    ) STORED
        COMMENT 'Computed sort key for timeline ordering (event_date1 converted to seconds since epoch) (as ordering by flexidate is more complex). Maintained automatically by MariaDB as a STORED generated column; do not write manually.',

    UNIQUE KEY uq_hisdoc_event_name (name),
    KEY idx_hisdoc_event_sort (sort_key),
    FOREIGN KEY (posted_by_user_id) REFERENCES user(id),

    -- FlexiDate integrity: centered events must have units+diff and no date2; ranged events the inverse.
    CONSTRAINT chk_flexidate_centered_units CHECK (event_date_type != 'centered' OR event_date_units IS NOT NULL),
    CONSTRAINT chk_flexidate_centered_diff  CHECK (event_date_type != 'centered' OR event_date_diff IS NOT NULL),
    CONSTRAINT chk_flexidate_centered_date2 CHECK (event_date_type != 'centered' OR event_date2 IS NULL),
    CONSTRAINT chk_flexidate_ranged_units   CHECK (event_date_type != 'ranged'   OR event_date_units IS NULL),
    CONSTRAINT chk_flexidate_ranged_diff    CHECK (event_date_type != 'ranged'   OR event_date_diff IS NULL),
    CONSTRAINT chk_flexidate_ranged_date2   CHECK (event_date_type != 'ranged'   OR event_date2 IS NOT NULL),
    CONSTRAINT chk_flexidate_ranged_order   CHECK (event_date_type != 'ranged'   OR event_date1 <= event_date2)
);
```

### `hisdoc_changelog`

```sql
CREATE OR REPLACE TABLE hisdoc_changelog (
    id INT AUTO_INCREMENT PRIMARY KEY
        COMMENT 'Changelog entry id.',

    event_id INT NOT NULL
        COMMENT 'The event that was edited.',

    description LONGTEXT NOT NULL
        COMMENT 'Human-written summary of what changed in this edit.',

    author_user_id INT NOT NULL
        COMMENT 'The g_web user who made this edit.',

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        COMMENT 'When the edit was made.',

    FOREIGN KEY (event_id) REFERENCES hisdoc_event(id),
    FOREIGN KEY (author_user_id) REFERENCES user(id)
);
```

### Junction Tables

```sql
CREATE OR REPLACE TABLE hisdoc_event_tag (
    event_id INT NOT NULL
        COMMENT 'The event.',
    tag_id INT NOT NULL
        COMMENT 'The tag applied to this event.',
    PRIMARY KEY (event_id, tag_id),
    FOREIGN KEY (event_id) REFERENCES hisdoc_event(id),
    FOREIGN KEY (tag_id) REFERENCES hisdoc_tag(id)
);

CREATE OR REPLACE TABLE hisdoc_event_person (
    event_id INT NOT NULL
        COMMENT 'The event.',
    person_id INT NOT NULL
        COMMENT 'The person involved in this event.',
    PRIMARY KEY (event_id, person_id),
    FOREIGN KEY (event_id) REFERENCES hisdoc_event(id),
    FOREIGN KEY (person_id) REFERENCES hisdoc_person(id)
);

CREATE OR REPLACE TABLE hisdoc_event_event (
    event_a_id INT NOT NULL
        COMMENT 'One event in the relation. Always stored with event_a_id < event_b_id.',
    event_b_id INT NOT NULL
        COMMENT 'The other event in the relation. Always stored with event_b_id > event_a_id.',
    PRIMARY KEY (event_a_id, event_b_id),
    CONSTRAINT chk_hisdoc_event_event_no_self CHECK (event_a_id != event_b_id),
    FOREIGN KEY (event_a_id) REFERENCES hisdoc_event(id),
    FOREIGN KEY (event_b_id) REFERENCES hisdoc_event(id)
);
```

---

## Prisma Schema (`schema.prisma`) After `db pull`

After applying the SQL above and running `prisma db pull`, Prisma will generate model stubs. The relation fields (which Prisma infers from FKs) and enum types will need to be verified. The Prisma model names follow the table names: `hisdoc_person`, `hisdoc_event`, `hisdoc_tag`, `hisdoc_changelog`, `hisdoc_event_tag`, `hisdoc_event_person`, `hisdoc_event_event`.

**Self-referential relation on `hisdoc_event`**: Prisma requires explicit `@relation` names for the two directions of `hisdoc_event_event`. These must be added manually after `db pull`:

```prisma
model hisdoc_event_event {
  event_a_id Int
  event_b_id Int
  event_a    hisdoc_event @relation("event_relation_a", fields: [event_a_id], references: [id])
  event_b    hisdoc_event @relation("event_relation_b", fields: [event_b_id], references: [id])
  @@id([event_a_id, event_b_id])
}

// On hisdoc_event:
related_events_a  hisdoc_event_event[]  @relation("event_relation_a")
related_events_b  hisdoc_event_event[]  @relation("event_relation_b")
```

**Back-relations on `user`** must also be added manually:
```prisma
model user {
  // ... existing fields ...
  has_hisdoc_access        Boolean           @default(false)
  hisdoc_person            hisdoc_person?
  hisdoc_posted_events     hisdoc_event[]
  hisdoc_changelog_entries hisdoc_changelog[]
}
```

---

## TypeScript Types

Key select shapes used across HisDoc pages:

```typescript
// FlexiDate fields, reused across multiple selects
const flexiDateSelect = {
  event_date_type: true, event_date1: true, event_date_time_offset: true,
  event_date_units: true, event_date_diff: true, event_date2: true
} as const;

// Timeline event (for API response and timeline rendering)
type TimelineEvent = Pick<hisdoc_event,
  'id' | 'name' | 'description' |
  'event_date_type' | 'event_date1' | 'event_date_time_offset' |
  'event_date_units' | 'event_date_diff' | 'event_date2'
> & {
  tags: { tag: Pick<hisdoc_tag, 'id' | 'name' | 'color'> }[],
  persons: { person: Pick<hisdoc_person, 'id' | 'data' | 'type'> }[]
}
```
