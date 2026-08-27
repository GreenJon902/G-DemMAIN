-- NGL this script is kinda vibe coded. I haven't really checked it cause it's a one-off. See ../README.md.



-- =====================================================================================================
-- HisDoc migration: validation
--
-- Checks the legacy `old.hs_*` tables against every constraint the new `g_web.hd_*` schema imposes,
-- and reports what would go wrong. It changes no `hs_*` data and deletes no rows -- the only things it
-- writes are its own two working tables, `old.PersonUserMap` and `old.hisdoc_validation_report`.
--
-- Usage:
--     mariadb < hisdoc-validate.sql
--
-- Intended workflow:
--     1. Run this. It creates PersonUserMap and reports what is wrong.
--     2. Fill in PersonUserMap by hand and fix the reported data problems by hand.
--     3. Run this again until it reports no FATAL rows.
--     4. Run hisdoc-migrate.sql, which re-runs these same checks before touching g_web.
--
-- Database names are hardcoded as `old` and `g_web`. If yours differ, search and replace both.
--
-- Requires CREATE ROUTINE on `old` (it defines the procedure `old.hisdoc_validate`, which
-- hisdoc-migrate.sql calls) and SELECT on `g_web`.
--
-- Severities:
--     FATAL  the migration will not run until this is resolved
--     WARN   worth looking at, but the new schema tolerates it and the migration will proceed
-- =====================================================================================================

SET SESSION sql_mode = 'STRICT_ALL_TABLES,NO_ENGINE_SUBSTITUTION';
SET SESSION time_zone = '+00:00';
SET SESSION group_concat_max_len = 65535;

USE old;


-- -----------------------------------------------------------------------------------------------------
-- PersonUserMap
--
-- `hs_Event.postedPid` and `hs_ChangeLog.authorPid` hold hs_Person ids, but the new
-- `hd_event.posted_by_user_id` and `hd_changelog.user_id` reference `g_web.user(id)`. This table is the
-- bridge, and has to be filled in by hand because nothing in the legacy data records which Minecraft
-- account belongs to which g_web login.
--
-- Only pids that are actually used as an author need a row; the validation below seeds exactly those.
-- Existing rows are never modified or removed, so it is safe to re-run.
-- -----------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS PersonUserMap (
    pid INT NOT NULL
        COMMENT 'hs_Person.pid of an author.',

    user_id INT NULL
        COMMENT 'The g_web user.id this person posts as. NULL means not yet mapped; validation reports it as FATAL.',

    PRIMARY KEY (pid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Manual map from legacy hisdoc author to g_web user account.';

-- Seed any author pid that has no row yet. INSERT IGNORE is safe here because the primary key is the
-- only constraint on the table, so the sole thing it can swallow is the duplicate we are avoiding
INSERT IGNORE INTO PersonUserMap (pid)
SELECT pid FROM (
    SELECT DISTINCT postedPid AS pid FROM hs_Event      WHERE postedPid  IS NOT NULL
    UNION
    SELECT DISTINCT authorPid AS pid FROM hs_ChangeLog  WHERE authorPid  IS NOT NULL
) AS authors;


-- -----------------------------------------------------------------------------------------------------
-- Report table
-- -----------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS hisdoc_validation_report (
    id INT AUTO_INCREMENT PRIMARY KEY,

    severity ENUM('FATAL', 'WARN') NOT NULL
        COMMENT 'FATAL blocks the migration; WARN does not.',

    check_code VARCHAR(48) NOT NULL
        COMMENT 'Stable identifier for the check, usable in @hisdoc_ignore_checks.',

    source_table VARCHAR(64) NOT NULL
        COMMENT 'The table the finding is about.',

    row_key TEXT NULL
        COMMENT 'Primary key(s) of the offending row(s), comma separated.',

    detail TEXT NOT NULL
        COMMENT 'What is wrong and what to do about it.',

    checked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Output of old.hisdoc_validate(). Rewritten on every run.';


-- -----------------------------------------------------------------------------------------------------
-- The checks
--
-- Defined as a procedure so that hisdoc-migrate.sql can re-run exactly these checks rather than
-- carrying its own copy that could drift out of step.
-- -----------------------------------------------------------------------------------------------------

DELIMITER $$

CREATE OR REPLACE PROCEDURE hisdoc_validate()
    COMMENT 'Rewrites old.hisdoc_validation_report with every problem blocking the hs_* -> hd_* migration.'
BEGIN
    -- SIGNAL only accepts a literal or a variable for MESSAGE_TEXT, never an expression, so the
    -- message has to be built into `msg` first
    DECLARE missing TEXT;
    DECLARE msg TEXT;

    -- Fail loudly rather than half-checking if the schema is not as expected
    SELECT GROUP_CONCAT(t.want)
      INTO missing
      FROM (
              SELECT 'old'   AS db, 'hs_Event'               AS want
        UNION SELECT 'old',         'hs_Person'
        UNION SELECT 'old',         'hs_Tag'
        UNION SELECT 'old',         'hs_ChangeLog'
        UNION SELECT 'old',         'hs_EventTagRelation'
        UNION SELECT 'old',         'hs_EventPersonRelation'
        UNION SELECT 'old',         'hs_EventEventRelation'
        UNION SELECT 'g_web',       'user'
        UNION SELECT 'g_web',       'hd_person'
        UNION SELECT 'g_web',       'hd_tag'
        UNION SELECT 'g_web',       'hd_event'
        UNION SELECT 'g_web',       'hd_changelog'
        UNION SELECT 'g_web',       'hd_event_tag'
        UNION SELECT 'g_web',       'hd_event_person'
        UNION SELECT 'g_web',       'hd_event_event_wri'
      ) AS t
      LEFT JOIN information_schema.TABLES i
             ON i.TABLE_SCHEMA = t.db AND i.TABLE_NAME = t.want
     WHERE i.TABLE_NAME IS NULL;

    IF missing IS NOT NULL THEN
        SET msg = CONCAT('hisdoc_validate: missing table(s): ', missing);
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = msg;
    END IF;

    -- Clears this procedure's own output only. No hs_* row is ever deleted
    DELETE FROM hisdoc_validation_report;


    -- =================================================================================================
    -- PersonUserMap completeness
    -- =================================================================================================

    -- An author with no row at all. Only possible if hs_* changed since the seeding step above ran
    INSERT INTO hisdoc_validation_report (severity, check_code, source_table, row_key, detail)
    SELECT 'FATAL', 'MAP_MISSING_ROW', 'PersonUserMap', CAST(a.pid AS CHAR),
           CONCAT('hs_Person pid ', a.pid, ' is used as an author but has no PersonUserMap row. ',
                  'Re-run hisdoc-validate.sql to seed it.')
      FROM (
        SELECT DISTINCT postedPid AS pid FROM hs_Event     WHERE postedPid IS NOT NULL
        UNION
        SELECT DISTINCT authorPid AS pid FROM hs_ChangeLog WHERE authorPid IS NOT NULL
      ) AS a
      LEFT JOIN PersonUserMap m ON m.pid = a.pid
     WHERE m.pid IS NULL;

    -- Seeded but not filled in. This is the expected finding on a first run
    INSERT INTO hisdoc_validation_report (severity, check_code, source_table, row_key, detail)
    SELECT 'FATAL', 'MAP_USER_ID_NULL', 'PersonUserMap', CAST(m.pid AS CHAR),
           CONCAT('PersonUserMap.user_id is NULL for pid ', m.pid,
                  ' (', IFNULL(p.personType, '?'), ' ', IFNULL(p.personData, '?'), ')',
                  ' which authors ',
                  (SELECT COUNT(*) FROM hs_Event     e WHERE e.postedPid = m.pid), ' event(s) and ',
                  (SELECT COUNT(*) FROM hs_ChangeLog c WHERE c.authorPid = m.pid), ' changelog entry(s).',
                  ' Set it: UPDATE old.PersonUserMap SET user_id = <g_web.user.id> WHERE pid = ', m.pid, ';')
      FROM PersonUserMap m
      LEFT JOIN hs_Person p ON p.pid = m.pid
     WHERE m.user_id IS NULL;

    -- Filled in with an id that does not exist, which would fail the hd_event / hd_changelog foreign key
    INSERT INTO hisdoc_validation_report (severity, check_code, source_table, row_key, detail)
    SELECT 'FATAL', 'MAP_USER_ID_UNKNOWN', 'PersonUserMap', CAST(m.pid AS CHAR),
           CONCAT('PersonUserMap maps pid ', m.pid, ' to g_web user id ', m.user_id,
                  ', which does not exist in g_web.user.')
      FROM PersonUserMap m
      LEFT JOIN g_web.user u ON u.id = m.user_id
     WHERE m.user_id IS NOT NULL AND u.id IS NULL;

    -- A mapping for a pid that is not a real person. Harmless but almost certainly a typo
    INSERT INTO hisdoc_validation_report (severity, check_code, source_table, row_key, detail)
    SELECT 'WARN', 'MAP_PID_UNKNOWN', 'PersonUserMap', CAST(m.pid AS CHAR),
           CONCAT('PersonUserMap has a row for pid ', m.pid, ', which does not exist in hs_Person.')
      FROM PersonUserMap m
      LEFT JOIN hs_Person p ON p.pid = m.pid
     WHERE p.pid IS NULL;


    -- =================================================================================================
    -- Relations: self-relations, both-direction duplicates, orphaned children
    -- =================================================================================================

    -- hd_event_event_wri's CHECK is event_id < related_event_id, so a self-relation cannot be stored
    INSERT INTO hisdoc_validation_report (severity, check_code, source_table, row_key, detail)
    SELECT 'FATAL', 'REL_EVENT_EVENT_SELF', 'hs_EventEventRelation',
           CONCAT(r.eid1, ',', r.eid2),
           CONCAT('Event ', r.eid1, ' is related to itself. hd_event_event_wri forbids this ',
                  '(chk_hd_event_event_order requires event_id < related_event_id).')
      FROM hs_EventEventRelation r
     WHERE r.eid1 = r.eid2;

    -- The new table stores one canonical row per pair, so both directions collide on the primary key
    INSERT INTO hisdoc_validation_report (severity, check_code, source_table, row_key, detail)
    SELECT 'FATAL', 'REL_EVENT_EVENT_BOTH_WAYS', 'hs_EventEventRelation',
           CONCAT(a.eid1, ',', a.eid2),
           CONCAT('The pair (', a.eid1, ',', a.eid2, ') is stored in both directions. ',
                  'hd_event_event_wri keeps one canonical row per pair, so delete whichever ',
                  'direction you do not want to keep.')
      FROM hs_EventEventRelation a
      JOIN hs_EventEventRelation b
        ON b.eid1 = a.eid2 AND b.eid2 = a.eid1
     WHERE a.eid1 < a.eid2;

    INSERT INTO hisdoc_validation_report (severity, check_code, source_table, row_key, detail)
    SELECT 'FATAL', 'REL_EVENT_EVENT_ORPHAN', 'hs_EventEventRelation',
           GROUP_CONCAT(CONCAT(o.eid1, ',', o.eid2) SEPARATOR ' | '),
           CONCAT('Relation(s) reference event id(s) that do not exist in hs_Event: ',
                  GROUP_CONCAT(DISTINCT o.missing ORDER BY o.missing), '. ',
                  'hd_event_event_wri has foreign keys to hd_event.')
      FROM (
        SELECT r.eid1, r.eid2, r.eid1 AS missing FROM hs_EventEventRelation r
          LEFT JOIN hs_Event e ON e.eid = r.eid1 WHERE e.eid IS NULL
        UNION ALL
        SELECT r.eid1, r.eid2, r.eid2 FROM hs_EventEventRelation r
          LEFT JOIN hs_Event e ON e.eid = r.eid2 WHERE e.eid IS NULL
      ) AS o
      HAVING COUNT(*) > 0;

    INSERT INTO hisdoc_validation_report (severity, check_code, source_table, row_key, detail)
    SELECT 'FATAL', 'REL_EVENT_TAG_ORPHAN_EVENT', 'hs_EventTagRelation',
           GROUP_CONCAT(CONCAT(r.eid, ',', r.tid) SEPARATOR ' | '),
           CONCAT('Rows reference event id(s) not in hs_Event: ',
                  GROUP_CONCAT(DISTINCT r.eid ORDER BY r.eid),
                  '. hd_event_tag has a foreign key to hd_event.')
      FROM hs_EventTagRelation r
      LEFT JOIN hs_Event e ON e.eid = r.eid
     WHERE e.eid IS NULL
      HAVING COUNT(*) > 0;

    INSERT INTO hisdoc_validation_report (severity, check_code, source_table, row_key, detail)
    SELECT 'FATAL', 'REL_EVENT_TAG_ORPHAN_TAG', 'hs_EventTagRelation',
           GROUP_CONCAT(CONCAT(r.eid, ',', r.tid) SEPARATOR ' | '),
           CONCAT('Rows reference tag id(s) not in hs_Tag: ',
                  GROUP_CONCAT(DISTINCT r.tid ORDER BY r.tid),
                  '. hd_event_tag has a foreign key to hd_tag.')
      FROM hs_EventTagRelation r
      LEFT JOIN hs_Tag t ON t.tid = r.tid
     WHERE t.tid IS NULL
      HAVING COUNT(*) > 0;

    INSERT INTO hisdoc_validation_report (severity, check_code, source_table, row_key, detail)
    SELECT 'FATAL', 'REL_EVENT_PERSON_ORPHAN_EVENT', 'hs_EventPersonRelation',
           GROUP_CONCAT(CONCAT(r.eid, ',', r.pid) SEPARATOR ' | '),
           CONCAT('Rows reference event id(s) not in hs_Event: ',
                  GROUP_CONCAT(DISTINCT r.eid ORDER BY r.eid),
                  '. hd_event_person has a foreign key to hd_event.')
      FROM hs_EventPersonRelation r
      LEFT JOIN hs_Event e ON e.eid = r.eid
     WHERE e.eid IS NULL
      HAVING COUNT(*) > 0;

    INSERT INTO hisdoc_validation_report (severity, check_code, source_table, row_key, detail)
    SELECT 'FATAL', 'REL_EVENT_PERSON_ORPHAN_PERSON', 'hs_EventPersonRelation',
           GROUP_CONCAT(CONCAT(r.eid, ',', r.pid) SEPARATOR ' | '),
           CONCAT('Rows reference person id(s) not in hs_Person: ',
                  GROUP_CONCAT(DISTINCT r.pid ORDER BY r.pid),
                  '. hd_event_person has a foreign key to hd_person.')
      FROM hs_EventPersonRelation r
      LEFT JOIN hs_Person p ON p.pid = r.pid
     WHERE p.pid IS NULL
      HAVING COUNT(*) > 0;

    -- hd_changelog.entity_id deliberately has no foreign key, so this does not block the migration
    INSERT INTO hisdoc_validation_report (severity, check_code, source_table, row_key, detail)
    SELECT 'WARN', 'CHANGELOG_ORPHAN_EVENT', 'hs_ChangeLog',
           GROUP_CONCAT(c.cid ORDER BY c.cid),
           CONCAT('Changelog entries reference event id(s) not in hs_Event: ',
                  GROUP_CONCAT(DISTINCT c.eid ORDER BY c.eid),
                  '. hd_changelog.entity_id has no foreign key, so these will migrate as-is and ',
                  'point at nothing. Delete them first if you would rather they did not.')
      FROM hs_ChangeLog c
      LEFT JOIN hs_Event e ON e.eid = c.eid
     WHERE e.eid IS NULL
      HAVING COUNT(*) > 0;


    -- =================================================================================================
    -- Columns that are nullable in hs_* but NOT NULL in hd_*
    -- =================================================================================================

    INSERT INTO hisdoc_validation_report (severity, check_code, source_table, row_key, detail)
    SELECT 'FATAL', 'EVENT_POSTED_PID_NULL', 'hs_Event',
           GROUP_CONCAT(eid ORDER BY eid),
           'postedPid is NULL, but hd_event.posted_by_user_id is NOT NULL.'
      FROM hs_Event WHERE postedPid IS NULL HAVING COUNT(*) > 0;

    INSERT INTO hisdoc_validation_report (severity, check_code, source_table, row_key, detail)
    SELECT 'FATAL', 'EVENT_POSTED_DATE_NULL', 'hs_Event',
           GROUP_CONCAT(eid ORDER BY eid),
           'postedDate is NULL, but hd_event.posted_at is NOT NULL.'
      FROM hs_Event WHERE postedDate IS NULL HAVING COUNT(*) > 0;

    INSERT INTO hisdoc_validation_report (severity, check_code, source_table, row_key, detail)
    SELECT 'FATAL', 'PERSON_DATA_NULL', 'hs_Person',
           GROUP_CONCAT(pid ORDER BY pid),
           'personData is NULL, but hd_person.data is NOT NULL.'
      FROM hs_Person WHERE personData IS NULL HAVING COUNT(*) > 0;


    -- =================================================================================================
    -- Enum values that have to be translated
    -- =================================================================================================

    -- MC/MINECRAFT -> MINECRAFT and MISC/MISCELLANEOUS -> NPC. Anything else has no target value
    INSERT INTO hisdoc_validation_report (severity, check_code, source_table, row_key, detail)
    SELECT 'FATAL', 'PERSON_TYPE_UNMAPPABLE', 'hs_Person',
           GROUP_CONCAT(pid ORDER BY pid),
           CONCAT('personType is not one of MC/MINECRAFT/MISC/MISCELLANEOUS, so it cannot be ',
                  'mapped onto hd_person.type ENUM(''MINECRAFT'',''NPC''). Values seen: ',
                  GROUP_CONCAT(DISTINCT CONCAT('''', personType, '''')))
      FROM hs_Person
     WHERE personType NOT IN ('MC', 'MINECRAFT', 'MISC', 'MISCELLANEOUS')
      HAVING COUNT(*) > 0;

    INSERT INTO hisdoc_validation_report (severity, check_code, source_table, row_key, detail)
    SELECT 'FATAL', 'EVENT_DATE_TYPE_UNMAPPABLE', 'hs_Event',
           GROUP_CONCAT(eid ORDER BY eid),
           CONCAT('eventDateType is not ''c'' or ''r'', so it cannot be mapped onto ',
                  'hd_event.event_date_type ENUM(''centered'',''ranged'').')
      FROM hs_Event WHERE eventDateType NOT IN ('c', 'r') HAVING COUNT(*) > 0;

    INSERT INTO hisdoc_validation_report (severity, check_code, source_table, row_key, detail)
    SELECT 'FATAL', 'EVENT_DATE_UNITS_UNMAPPABLE', 'hs_Event',
           GROUP_CONCAT(eid ORDER BY eid),
           'eventDateUnits is set but is not one of ''d'', ''h'', ''m''.'
      FROM hs_Event
     WHERE eventDateUnits IS NOT NULL AND eventDateUnits NOT IN ('d', 'h', 'm')
      HAVING COUNT(*) > 0;


    -- =================================================================================================
    -- The flexidate CHECK constraints on hd_event
    -- =================================================================================================

    INSERT INTO hisdoc_validation_report (severity, check_code, source_table, row_key, detail)
    SELECT 'FATAL', v.code, 'hs_Event', GROUP_CONCAT(v.eid ORDER BY v.eid), v.detail
      FROM (
        SELECT eid, 'EVENT_FLEXIDATE_CENTERED_UNITS' AS code,
               'eventDateType = ''c'' but eventDateUnits IS NULL (chk_flexidate_centered_units).' AS detail
          FROM hs_Event WHERE eventDateType = 'c' AND eventDateUnits IS NULL
        UNION ALL
        SELECT eid, 'EVENT_FLEXIDATE_CENTERED_DIFF',
               'eventDateType = ''c'' but eventDateDiff IS NULL (chk_flexidate_centered_diff).'
          FROM hs_Event WHERE eventDateType = 'c' AND eventDateDiff IS NULL
        UNION ALL
        SELECT eid, 'EVENT_FLEXIDATE_CENTERED_DATE2',
               'eventDateType = ''c'' but eventDate2 IS NOT NULL (chk_flexidate_centered_date2).'
          FROM hs_Event WHERE eventDateType = 'c' AND eventDate2 IS NOT NULL
        UNION ALL
        SELECT eid, 'EVENT_FLEXIDATE_RANGED_UNITS',
               'eventDateType = ''r'' but eventDateUnits IS NOT NULL (chk_flexidate_ranged_units).'
          FROM hs_Event WHERE eventDateType = 'r' AND eventDateUnits IS NOT NULL
        UNION ALL
        SELECT eid, 'EVENT_FLEXIDATE_RANGED_DIFF',
               'eventDateType = ''r'' but eventDateDiff IS NOT NULL (chk_flexidate_ranged_diff).'
          FROM hs_Event WHERE eventDateType = 'r' AND eventDateDiff IS NOT NULL
        UNION ALL
        SELECT eid, 'EVENT_FLEXIDATE_RANGED_DATE2',
               'eventDateType = ''r'' but eventDate2 IS NULL (chk_flexidate_ranged_date2).'
          FROM hs_Event WHERE eventDateType = 'r' AND eventDate2 IS NULL
        UNION ALL
        SELECT eid, 'EVENT_FLEXIDATE_RANGED_ORDER',
               'eventDateType = ''r'' but eventDate1 > eventDate2 (chk_flexidate_ranged_order).'
          FROM hs_Event WHERE eventDateType = 'r' AND eventDate2 IS NOT NULL AND eventDate1 > eventDate2
      ) AS v
     GROUP BY v.code, v.detail;


    -- =================================================================================================
    -- Uniqueness under the target collation
    --
    -- The hs_* tables are latin1 (latin1_swedish_ci) and the hd_* tables are utf8mb4_unicode_ci, which
    -- treats a different set of strings as equal. Two names that coexist happily today can therefore
    -- collide on the new UNIQUE key, so these are checked under the collation that will apply.
    -- =================================================================================================

    INSERT INTO hisdoc_validation_report (severity, check_code, source_table, row_key, detail)
    SELECT 'FATAL', 'EVENT_NAME_DUPLICATE', 'hs_Event',
           GROUP_CONCAT(eid ORDER BY eid),
           CONCAT('These events collide on uq_hd_event_name under utf8mb4_unicode_ci: ',
                  GROUP_CONCAT(DISTINCT CONCAT('''', name, '''') SEPARATOR ', '))
      FROM hs_Event
     GROUP BY CONVERT(name USING utf8mb4) COLLATE utf8mb4_unicode_ci
     HAVING COUNT(*) > 1;

    INSERT INTO hisdoc_validation_report (severity, check_code, source_table, row_key, detail)
    SELECT 'FATAL', 'TAG_NAME_DUPLICATE', 'hs_Tag',
           GROUP_CONCAT(tid ORDER BY tid),
           CONCAT('These tags collide on uq_hd_tag_name under utf8mb4_unicode_ci: ',
                  GROUP_CONCAT(DISTINCT CONCAT('''', name, '''') SEPARATOR ', '))
      FROM hs_Tag
     GROUP BY CONVERT(name USING utf8mb4) COLLATE utf8mb4_unicode_ci
     HAVING COUNT(*) > 1;

    -- MC and MINECRAFT are distinct in hs_Person's unique key but both become MINECRAFT, so rows that
    -- were legally distinct can collide on uq_hd_person_data
    INSERT INTO hisdoc_validation_report (severity, check_code, source_table, row_key, detail)
    SELECT 'FATAL', 'PERSON_DATA_DUPLICATE', 'hs_Person',
           GROUP_CONCAT(pid ORDER BY pid),
           CONCAT('These persons collide on uq_hd_person_data (type, data) after MC -> MINECRAFT and ',
                  'MISC -> NPC folding: ', GROUP_CONCAT(DISTINCT CONCAT(personType, ' ', personData)
                                                        SEPARATOR ', '))
      FROM hs_Person
     GROUP BY CASE WHEN personType IN ('MC', 'MINECRAFT') THEN 'MINECRAFT' ELSE 'NPC' END,
              CONVERT(personData USING utf8mb4) COLLATE utf8mb4_unicode_ci
     HAVING COUNT(*) > 1;


    -- =================================================================================================
    -- hd_person's UUID CHECK constraint
    -- =================================================================================================

    INSERT INTO hisdoc_validation_report (severity, check_code, source_table, row_key, detail)
    SELECT 'FATAL', 'PERSON_UUID_MALFORMED', 'hs_Person',
           GROUP_CONCAT(pid ORDER BY pid),
           CONCAT('MINECRAFT persons whose personData is not a hyphenated 36-character UUID, which ',
                  'chk_hd_person_minecraft_uuid rejects. Values: ',
                  GROUP_CONCAT(DISTINCT CONCAT('''', IFNULL(personData, 'NULL'), '''') SEPARATOR ', '))
      FROM hs_Person
     WHERE personType IN ('MC', 'MINECRAFT')
       AND (personData IS NULL
            OR CHAR_LENGTH(personData) <> 36
            OR personData NOT REGEXP
               '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')
      HAVING COUNT(*) > 0;


    -- =================================================================================================
    -- Likely double-encoded text
    --
    -- The bug being looked for is UTF-8 bytes written into a latin1 column: a curly apostrophe that
    -- should be one character (U+2019) is stored as the three characters "a-circumflex, euro, trade"
    -- and will migrate to g_web looking exactly like that.
    --
    -- Detection maps the text back down to its cp1252 bytes with CONVERT(... USING latin1) and asks
    -- whether those bytes form a valid UTF-8 multi-byte sequence. Text that is stored correctly cannot
    -- -- a real U+2019 is the single byte 0x92 in cp1252, which is not a UTF-8 lead byte. Going via
    -- HEX() keeps this working whether `old` was loaded as latin1 or as utf8mb4, and the ^(..)* prefix
    -- keeps the match aligned to byte boundaries.
    -- =================================================================================================

    INSERT INTO hisdoc_validation_report (severity, check_code, source_table, row_key, detail)
    SELECT 'FATAL', 'ENCODING_DOUBLE_ENCODED', d.tbl, CAST(d.id AS CHAR),
           CONCAT(d.col, ' looks double-encoded. Currently: ', LEFT(d.shown, 200),
                  ' -- should probably be: ',
                  LEFT(CONVERT(CAST(CONVERT(d.raw USING latin1) AS BINARY) USING utf8mb4), 200))
      FROM (
        SELECT 'hs_Event' AS tbl, eid AS id, 'name' AS col, name AS raw, name AS shown FROM hs_Event
        UNION ALL
        SELECT 'hs_Event', eid, 'description', description, description FROM hs_Event
        UNION ALL
        SELECT 'hs_Event', eid, 'details', details, details FROM hs_Event WHERE details IS NOT NULL
        UNION ALL
        SELECT 'hs_Tag', tid, 'name', name, name FROM hs_Tag
        UNION ALL
        SELECT 'hs_Tag', tid, 'description', description, description FROM hs_Tag
        UNION ALL
        SELECT 'hs_ChangeLog', cid, 'description', description, description FROM hs_ChangeLog
        UNION ALL
        SELECT 'hs_Person', pid, 'personData', personData, personData FROM hs_Person
          WHERE personData IS NOT NULL
      ) AS d
     WHERE HEX(CONVERT(d.raw USING latin1)) REGEXP
           '^(..)*((C[2-9A-F]|D[0-9A-F])[89AB].|E[0-9A-F]([89AB].){2}|F[0-4]([89AB].){3})';


    -- =================================================================================================
    -- Target must be empty
    --
    -- The migration inserts explicit ids so that hs_* ids survive into hd_*. Anything already there
    -- would collide, or silently end up interleaved.
    -- =================================================================================================

    INSERT INTO hisdoc_validation_report (severity, check_code, source_table, row_key, detail)
    SELECT 'FATAL', 'TARGET_NOT_EMPTY', t.name, NULL,
           CONCAT('g_web.', t.name, ' already contains ', t.n, ' row(s). The migration inserts ',
                  'explicit ids and expects an empty table. Follow the Databases.md procedure: ',
                  'copy it to ', t.name, 'Old, then empty it.')
      FROM (
              SELECT 'hd_tag'             AS name, COUNT(*) AS n FROM g_web.hd_tag
        UNION SELECT 'hd_person',                  COUNT(*)      FROM g_web.hd_person
        UNION SELECT 'hd_event',                   COUNT(*)      FROM g_web.hd_event
        UNION SELECT 'hd_changelog',               COUNT(*)      FROM g_web.hd_changelog
        UNION SELECT 'hd_event_tag',               COUNT(*)      FROM g_web.hd_event_tag
        UNION SELECT 'hd_event_person',            COUNT(*)      FROM g_web.hd_event_person
        UNION SELECT 'hd_event_event_wri',         COUNT(*)      FROM g_web.hd_event_event_wri
      ) AS t
     WHERE t.n > 0;
END$$

DELIMITER ;


CALL hisdoc_validate();


-- -----------------------------------------------------------------------------------------------------
-- Output
-- -----------------------------------------------------------------------------------------------------

SELECT severity, check_code, source_table, row_key, detail
  FROM hisdoc_validation_report
 ORDER BY FIELD(severity, 'FATAL', 'WARN'), check_code, id;

SELECT
    SUM(severity = 'FATAL') AS fatal,
    SUM(severity = 'WARN')  AS warn,
    CASE WHEN SUM(severity = 'FATAL') = 0
         THEN 'OK - no FATAL findings, hisdoc-migrate.sql will run'
         ELSE 'BLOCKED - fix the FATAL findings above, then re-run this script'
    END AS verdict
  FROM hisdoc_validation_report;
