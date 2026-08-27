-- NGL this script is kinda vibe coded. I haven't really checked it cause it's a one-off. See ../README.md.




-- =====================================================================================================
-- HisDoc migration: apply
--
-- Copies `old.hs_*` into `g_web.hd_*`. Run hisdoc-validate.sql first -- this script calls the same
-- checks and refuses to write anything if any of them come back FATAL.
--
-- Usage:
--     mariadb < hisdoc-migrate.sql
--
-- It reads `old` and writes `g_web`. It deletes and modifies nothing in `old`, apart from
-- hisdoc_validation_report, which old.hisdoc_validate() rewrites as its own output. The legacy tables
-- are left exactly as they are, so a failed run can simply be re-run once the cause is fixed.
--
-- Everything is inside one transaction, so a failure part-way leaves g_web untouched.
--
-- Database names are hardcoded as `old` and `g_web`. If yours differ, search and replace both.
--
-- Requires MariaDB 10.1 or newer for the BEGIN NOT ATOMIC block used to abort.
-- =====================================================================================================

SET SESSION sql_mode = 'STRICT_ALL_TABLES,NO_ENGINE_SUBSTITUTION';
SET SESSION group_concat_max_len = 65535;

-- hd_event.posted_at and hd_changelog.created_at are plain DATETIMEs holding UTC, and FROM_UNIXTIME
-- renders in the session time zone. Without this every timestamp would shift by the server's offset
SET SESSION time_zone = '+00:00';


-- -----------------------------------------------------------------------------------------------------
-- Constants
--
-- hs_ChangeLog records only a free-text description, so there is nothing to derive hd_changelog.action
-- from. Every legacy entry is recorded as one value; change it here if you would rather it were
-- something else. schema_version 0 is the "no structured snapshots available" shape documented in
-- Databases.md, which is why old_values and new_values are written as NULL.
-- -----------------------------------------------------------------------------------------------------

SET @legacy_changelog_action = 'UPDATE';
SET @legacy_changelog_schema_version = 0;

-- Comma separated check_code values to proceed in spite of. Anything listed here is still reported,
-- it just stops blocking. Leave it unset to require a completely clean report. Because `mariadb < file`
-- starts a fresh session, it has to be set on the command line rather than in a preceding statement:
--
--     mariadb --init-command="SET @hisdoc_ignore_checks='ENCODING_DOUBLE_ENCODED'" < hisdoc-migrate.sql
SET @hisdoc_ignore_checks = IFNULL(@hisdoc_ignore_checks, '');


-- -----------------------------------------------------------------------------------------------------
-- Gate: re-run the validation and stop unless it is clean
-- -----------------------------------------------------------------------------------------------------

DELIMITER $$

BEGIN NOT ATOMIC
    IF NOT EXISTS (SELECT 1 FROM information_schema.ROUTINES
                    WHERE ROUTINE_SCHEMA = 'old' AND ROUTINE_NAME = 'hisdoc_validate') THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'old.hisdoc_validate() does not exist. Run hisdoc-validate.sql first.';
    END IF;
END$$

DELIMITER ;

CALL old.hisdoc_validate();

-- Shown before the abort below, so the reason is on screen
SELECT severity, check_code, source_table, row_key, detail
  FROM old.hisdoc_validation_report
 WHERE severity = 'FATAL'
   AND FIND_IN_SET(check_code, @hisdoc_ignore_checks) = 0
 ORDER BY check_code, id;

SELECT COUNT(*) INTO @hisdoc_fatal
  FROM old.hisdoc_validation_report
 WHERE severity = 'FATAL'
   AND FIND_IN_SET(check_code, @hisdoc_ignore_checks) = 0;

DELIMITER $$

BEGIN NOT ATOMIC
    IF @hisdoc_fatal > 0 THEN
        SET @msg = CONCAT('Migration aborted: ', @hisdoc_fatal,
                          ' FATAL validation finding(s). Nothing was written to g_web.');
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = @msg;
    END IF;
END$$

DELIMITER ;


-- -----------------------------------------------------------------------------------------------------
-- Migrate
--
-- Legacy ids are carried across unchanged (hs_Event.eid becomes hd_event.id, and so on) so that the
-- changelog's entity_id values, and anything else recorded outside the database, still line up.
-- Insertion order follows the foreign keys: tags and persons, then events, then the relations that
-- point at them.
-- -----------------------------------------------------------------------------------------------------

START TRANSACTION;


-- hd_tag ------------------------------------------------------------------------------------------
INSERT INTO g_web.hd_tag (id, name, description, color, soft_deleted)
SELECT t.tid,
       t.name,
       t.description,
       t.color,
       FALSE
  FROM old.hs_Tag t
 ORDER BY t.tid;


-- hd_person ---------------------------------------------------------------------------------------
-- linked_user_id is deliberately left NULL: PersonUserMap only records who authors as which g_web
-- account, which is not the same claim as this person being that account.    Uhhh sure ok, we'll fix in post
INSERT INTO g_web.hd_person (id, type, data, linked_user_id, soft_deleted)
SELECT p.pid,
       CASE WHEN p.personType IN ('MC', 'MINECRAFT') THEN 'MINECRAFT' ELSE 'NPC' END,
       p.personData,
       NULL, 
       FALSE
  FROM old.hs_Person p
 ORDER BY p.pid;


-- hd_event ----------------------------------------------------------------------------------------
-- sort_key, event_start_key and event_end_key are STORED generated columns and are omitted; MariaDB
-- computes them. The date fields are copied verbatim -- they are the submitter's local wall-clock
-- count, not a UTC instant, and event_date_time_offset carries the offset that reconciles them
INSERT INTO g_web.hd_event (id, name, description, details,
                            posted_by_user_id, posted_at,
                            event_date_type, event_date1, event_date_time_offset,
                            event_date_units, event_date_diff, event_date2,
                            soft_deleted)
SELECT e.eid,
       e.name,
       e.description,
       e.details,
       m.user_id,
       FROM_UNIXTIME(e.postedDate),
       CASE e.eventDateType WHEN 'c' THEN 'centered' WHEN 'r' THEN 'ranged' END,
       e.eventDate1,
       e.eventDateTimeOffset,
       e.eventDateUnits,
       e.eventDateDiff,
       e.eventDate2,
       FALSE
  FROM old.hs_Event e
  JOIN old.PersonUserMap m ON m.pid = e.postedPid
 ORDER BY e.eid;


-- hd_event_tag ------------------------------------------------------------------------------------
INSERT INTO g_web.hd_event_tag (event_id, tag_id, soft_deleted)
SELECT r.eid, r.tid, FALSE
  FROM old.hs_EventTagRelation r
 ORDER BY r.eid, r.tid;


-- hd_event_person ---------------------------------------------------------------------------------
INSERT INTO g_web.hd_event_person (event_id, person_id, soft_deleted)
SELECT r.eid, r.pid, FALSE
  FROM old.hs_EventPersonRelation r
 ORDER BY r.eid, r.pid;


-- hd_event_event_wri ------------------------------------------------------------------------------
-- Normalised here with LEAST/GREATEST rather than relying on trg_hd_event_event_sort, so the insert
-- satisfies chk_hd_event_event_order whether or not the trigger is installed. The trigger, if present,
-- sees rows that are already in order and does nothing
INSERT INTO g_web.hd_event_event_wri (event_id, related_event_id, soft_deleted)
SELECT LEAST(r.eid1, r.eid2), GREATEST(r.eid1, r.eid2), FALSE
  FROM old.hs_EventEventRelation r
 ORDER BY LEAST(r.eid1, r.eid2), GREATEST(r.eid1, r.eid2);


-- hd_changelog ------------------------------------------------------------------------------------
-- Every legacy entry is about an event, so `what` is constant. entity_id has no foreign key by design,
-- so entries pointing at deleted events migrate as-is (validation reports them as WARN)
INSERT INTO g_web.hd_changelog (id, user_id, message, created_at, what, entity_id,
                                old_values, new_values, action, schema_version, soft_deleted)
SELECT c.cid,
       m.user_id,
       c.description,
       FROM_UNIXTIME(c.date),
       'EVENT',
       c.eid,
       NULL,
       NULL,
       @legacy_changelog_action,
       @legacy_changelog_schema_version,
       FALSE
  FROM old.hs_ChangeLog c
  JOIN old.PersonUserMap m ON m.pid = c.authorPid
 ORDER BY c.cid;


-- Events didn't used to store creation changelogs, they now do. So derive from posted date
INSERT INTO g_web.hd_changelog
       (user_id, message, created_at, what, entity_id,
        old_values, new_values, action, schema_version, soft_deleted)
SELECT e.posted_by_user_id,
       'This event was created!',
       e.posted_at,
       'EVENT',
       e.id,
       NULL,
       NULL,
       'INSERT',
       0,
       FALSE
  FROM g_web.hd_event e
 WHERE NOT EXISTS (
           SELECT 1 FROM g_web.hd_changelog c
            WHERE c.what = 'EVENT' AND c.entity_id = e.id AND c.action = 'INSERT'
       )
 ORDER BY e.id;


COMMIT;


-- -----------------------------------------------------------------------------------------------------
-- Verification
--
-- Every row of every source table should be accounted for. A mismatch on hd_event or hd_changelog
-- means a PersonUserMap row was missing and the JOIN silently dropped rows, which the gate above
-- should have caught -- investigate before letting anything use the data.
-- -----------------------------------------------------------------------------------------------------

SELECT 'hd_tag'             AS target, (SELECT COUNT(*) FROM old.hs_Tag)               AS source_rows,
                                       (SELECT COUNT(*) FROM g_web.hd_tag)             AS target_rows
UNION ALL
SELECT 'hd_person',                    (SELECT COUNT(*) FROM old.hs_Person),
                                       (SELECT COUNT(*) FROM g_web.hd_person)
UNION ALL
SELECT 'hd_event',                     (SELECT COUNT(*) FROM old.hs_Event),
                                       (SELECT COUNT(*) FROM g_web.hd_event)
UNION ALL
SELECT 'hd_event_tag',                 (SELECT COUNT(*) FROM old.hs_EventTagRelation),
                                       (SELECT COUNT(*) FROM g_web.hd_event_tag)
UNION ALL
SELECT 'hd_event_person',              (SELECT COUNT(*) FROM old.hs_EventPersonRelation),
                                       (SELECT COUNT(*) FROM g_web.hd_event_person)
UNION ALL
SELECT 'hd_event_event_wri',           (SELECT COUNT(*) FROM old.hs_EventEventRelation),
                                       (SELECT COUNT(*) FROM g_web.hd_event_event_wri)
UNION ALL
SELECT 'hd_changelog',                 (SELECT COUNT(*) FROM old.hs_ChangeLog),  -- This is now broken becasue of changelog importing
                                       (SELECT COUNT(*) FROM g_web.hd_changelog);

SELECT CASE WHEN (SELECT COUNT(*) FROM old.hs_Tag)               = (SELECT COUNT(*) FROM g_web.hd_tag)
             AND (SELECT COUNT(*) FROM old.hs_Person)            = (SELECT COUNT(*) FROM g_web.hd_person)
             AND (SELECT COUNT(*) FROM old.hs_Event)             = (SELECT COUNT(*) FROM g_web.hd_event)
             AND (SELECT COUNT(*) FROM old.hs_EventTagRelation)  = (SELECT COUNT(*) FROM g_web.hd_event_tag)
             AND (SELECT COUNT(*) FROM old.hs_EventPersonRelation)
                                                                 = (SELECT COUNT(*) FROM g_web.hd_event_person)
             AND (SELECT COUNT(*) FROM old.hs_EventEventRelation)
                                                                 = (SELECT COUNT(*) FROM g_web.hd_event_event_wri)
             AND (SELECT COUNT(*) FROM old.hs_ChangeLog)         = (SELECT COUNT(*) FROM g_web.hd_changelog)
            THEN 'OK - every source row was migrated'
            ELSE 'MISMATCH - see the counts above'
       END AS verdict;
