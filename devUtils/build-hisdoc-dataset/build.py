import argparse
import json
from datetime import datetime, timedelta
from random import randint, random, choice, sample, seed
from math import ceil

seed(1)  # So it's slightly repeatable

persons_file = "./persons.txt"
event_text_file = "./event_text.txt"
tags_text_file = "./tag_text.txt"
details_file = "./details.txt"
changelogs_file = "./changelogs.txt"

date_c_max_diff = 100
min_event_date = 100
max_event_date = 10000

# Real-world datetime range for posted_at / created_at
base_datetime = datetime(2020, 1, 1)
max_datetime_offset_seconds = 6 * 365 * 24 * 3600

eventeventrelation_val = 0.05
eventeventrelation_step_val = (1, 50)
eventtagrelation_val = 0.25
eventpersonrelation_val = 0.03
tagColMin = 0
tagColMax = 16581375
minEventDateTimeOffset = -1440
maxEventDateTimeOffset = 1440

# Low-frequency chance that an event changelog's "old" relation entries carry a different tag
# colour / person data / related-event name than the current one — simulates that item having
# since been recoloured/renamed, independent of whether it was also added or removed
relation_attr_drift_val = 0.08

changelog_schema_version = 1  # Must match CURRENT_SCHEMA_VERSION in com/lib/prisma/hisdoc/changelog.ts


def parse_args():
    parser = argparse.ArgumentParser(description="Build a HisDoc dev dataset.")
    parser.add_argument(
        "--users",
        required=True,
        # Comma-separated g_web user IDs used as event/changelog authors.
        help="Comma-separated list of g_web user IDs (e.g. 1,2,3)"
    )
    return parser.parse_args()


def random_datetime():
    """Returns a random DATETIME string in the 6 years following 2020-01-01."""
    offset = timedelta(seconds=randint(0, max_datetime_offset_seconds))
    return (base_datetime + offset).strftime("%Y-%m-%d %H:%M:%S")


def parse_persons(path):
    """Reads persons.txt — one TAB-separated (type, data) pair per line."""
    persons = []
    with open(path, "r") as f:
        for line in f:
            line = line.strip()
            if line:
                ptype, pdata = line.split("\t", 1)
                persons.append((ptype, pdata))
    return persons


def parse_text_info(path):
    """
    Parses a text file of name/description pairs.
    Format: name, description, blank line — repeated.
    """
    texts = open(path, "r").read().replace("?", "").replace("'", "").split("\n")
    i = 0
    used_names = []
    while i < len(texts):
        if texts[i] in used_names:
            print(f'Tried to reuse name "{texts[i]}"')
        else:
            yield texts[i], texts[i + 1]
            used_names.append(texts[i])
        assert texts[i + 2] == "", "line should be empty at " + str(i)
        i += 3


args = parse_args()
user_ids = [int(x.strip()) for x in args.users.split(",")]

persons = parse_persons(persons_file)
event_texts = list(parse_text_info(event_text_file))
tags = list(parse_text_info(tags_text_file))
details = list(open(details_file, "r").read().split("\n"))
changelogs = list(open(changelogs_file, "r").read().split("\n"))

# Generated once so make_tag_list and the changelog snapshots agree on each tag's colour
tag_colors = [randint(tagColMin, tagColMax) for _ in tags]

# Link the first half of the provided users each to a distinct person (1-based person IDs).
linked_users = user_ids[: ceil(len(user_ids) / 2)]
# Maps person id (1-based) → linked user id.
person_linked_user = {i + 1: uid for i, uid in enumerate(linked_users)}

out = open("./out.sql", "w")

# Populated by make_event_list/make_event_*_relation as they run, then reused by make_changelogs
# to build realistic "current state" snapshots for changelog entries
event_records = []
event_tags = {}
event_persons = {}
event_related = {}


def make_clear_tables():
    # FK checks must be disabled for TRUNCATE to work across referenced tables.
    # TRUNCATE resets AUTO_INCREMENT, which matches our explicit id values.
    tables = [
        "hd_event_event_wri",
        "hd_event_person",
        "hd_event_tag",
        "hd_changelog",
        "hd_event",
        "hd_tag",
        "hd_person",
    ]
    out.write("SET FOREIGN_KEY_CHECKS = 0;\n")
    for table in tables:
        out.write(f"TRUNCATE TABLE {table};\n")
    out.write("SET FOREIGN_KEY_CHECKS = 1;\n\n")


def make_person_list():
    string = "INSERT INTO hd_person (id, type, data, linked_user_id) VALUES \n"

    for n, person in enumerate(persons):
        linked = person_linked_user.get(n + 1)
        linked_str = str(linked) if linked is not None else "NULL"
        string += f"({n + 1}, '{person[0]}', '{person[1]}', {linked_str}), \n"

    string = string.rstrip(", \n")
    string += ";\n"
    out.write(string)


def make_event_list():
    c_dates = (
        "INSERT INTO hd_event"
        " (id, name, event_date_type, event_date1, event_date_units, event_date_diff,"
        " posted_at, description, posted_by_user_id, details, event_date_time_offset)"
        " VALUES \n"
    )
    r_dates = (
        "INSERT INTO hd_event"
        " (id, name, event_date_type, event_date1, event_date2,"
        " posted_at, description, posted_by_user_id, details, event_date_time_offset)"
        " VALUES \n"
    )

    eid = 1
    for event_text in event_texts:
        name = event_text[0]
        description = event_text[1]
        date1 = randint(min_event_date, max_event_date)
        posted_at = random_datetime()
        # posted_by_user_id is NOT NULL, so always pick a real user.
        posted_by_user_id = choice(user_ids)
        detail = choice(details) if randint(0, 1) == 1 else None
        event_date_offset = randint(minEventDateTimeOffset, maxEventDateTimeOffset)

        if randint(0, 1) == 0:  # Centered
            date_type = "centered"
            date_units = ["d", "h", "m"][randint(0, 2)]
            date_diff = randint(0, date_c_max_diff)
            date2 = None
        else:  # Ranged
            date_type = "ranged"
            date_units = None
            date_diff = None
            date2 = date1 + randint(min_event_date, max_event_date)

        # Kept around so make_changelogs can build "current state" snapshots without re-rolling
        # (and disagreeing with) the values actually written to hd_event below
        event_records.append({
            "id": eid,
            "name": name,
            "description": description,
            "details": detail,
            "posted_by_user_id": posted_by_user_id,
            "posted_at": posted_at,
            "event_date_type": date_type,
            "event_date1": date1,
            "event_date_time_offset": event_date_offset,
            "event_date_units": date_units,
            "event_date_diff": date_diff,
            "event_date2": date2,
        })

        detail_sql = "'" + detail + "'" if detail is not None else "NULL"
        if date_type == "centered":
            c_dates += (
                f"({eid}, '{name}', 'centered', {date1}, '{date_units}', {date_diff},"
                f" '{posted_at}', '{description}', {posted_by_user_id}, {detail_sql}, {event_date_offset}), \n"
            )
        else:
            r_dates += (
                f"({eid}, '{name}', 'ranged', {date1}, {date2},"
                f" '{posted_at}', '{description}', {posted_by_user_id}, {detail_sql}, {event_date_offset}), \n"
            )

        eid += 1

    c_dates = c_dates.rstrip(", \n")
    c_dates += ";\n"
    out.write(c_dates)

    r_dates = r_dates.rstrip(", \n")
    r_dates += ";\n"
    out.write(r_dates)


def make_tag_list():
    string = "INSERT INTO hd_tag (id, name, description, color) VALUES \n"

    for n, tag in enumerate(tags):
        string += f"({n + 1}, '{tag[0]}', '{tag[1]}', {tag_colors[n]}), \n"

    string = string.rstrip(", \n")
    string += ";\n"
    out.write(string)


def make_event_event_relation():
    # event_id < related_event_id is enforced by chk_hd_event_event_order (and would otherwise
    # be normalised by trg_hd_event_event_sort on insert anyway).
    string = "INSERT INTO hd_event_event_wri (event_id, related_event_id) VALUES \n"

    done = set()

    for n1 in range(len(event_texts) - 1):
        for n2 in range(0, len(event_texts) - 1, randint(*eventeventrelation_step_val)):
            if n1 != n2:
                pair = (min(n1 + 1, n2 + 1), max(n1 + 1, n2 + 1))
                if pair not in done:
                    if random() < eventeventrelation_val:
                        string += f"({pair[0]}, {pair[1]}), \n"
                        done.add(pair)
                        event_related.setdefault(pair[0], set()).add(pair[1])
                        event_related.setdefault(pair[1], set()).add(pair[0])
        print(n1 + 1, "/", len(event_texts) - 1)

    string = string.rstrip(", \n")
    string += ";\n"
    out.write(string)


def make_event_person_relation():
    string = "INSERT INTO hd_event_person (event_id, person_id) VALUES \n"

    done = set()

    for n1 in range(len(event_texts) - 1):
        for n2 in range(len(persons) - 1):
            pair = (n1 + 1, n2 + 1)
            if pair not in done:
                if random() < eventpersonrelation_val:
                    string += f"({pair[0]}, {pair[1]}), \n"
                    done.add(pair)
                    event_persons.setdefault(pair[0], set()).add(pair[1])

    string = string.rstrip(", \n")
    string += ";\n"
    out.write(string)


def make_event_tag_relation():
    string = "INSERT INTO hd_event_tag (event_id, tag_id) VALUES \n"

    done = set()

    for n1 in range(len(event_texts) - 1):
        for n2 in range(len(tags) - 1):
            pair = (n1 + 1, n2 + 1)
            if pair not in done:
                if random() < eventtagrelation_val:
                    string += f"({pair[0]}, {pair[1]}), \n"
                    done.add(pair)
                    event_tags.setdefault(pair[0], set()).add(pair[1])

    string = string.rstrip(", \n")
    string += ";\n"
    out.write(string)


def to_json_sql(value):
    """
    Serialises a changelog snapshot dict to a single-quoted SQL string literal, or NULL.
    Backslashes must be escaped before quotes — otherwise a JSON escape sequence like \" (from a
    literal " in event/tag text) survives quote-escaping unchanged, and MySQL's own backslash
    handling then swallows that backslash while parsing the string literal, corrupting the JSON.
    """
    if value is None:
        return "NULL"
    text = json.dumps(value).replace("\\", "\\\\").replace("'", "\\'")
    return "'" + text + "'"


def tweak_relation_list(current_ids, all_ids, max_changes=2):
    """
    Derives a "before" relation set from a "current" one by adding/removing a handful of items
    rather than swapping the whole list — most real edits only touch one or two relations, they
    don't replace the entire tag/person/related-event set at once.
    """
    result = set(current_ids)
    for _ in range(randint(0, max_changes)):
        if result and random() < 0.5:
            result.discard(choice(list(result)))
        else:
            candidates = [i for i in all_ids if i not in result]
            if candidates:
                result.add(choice(candidates))
    return result


def random_action():
    """Picks a changelog action, weighted towards UPDATE since that's the common case."""
    r = random()
    if r < 0.15:
        return "INSERT"
    if r < 0.85:
        return "UPDATE"
    return "DELETE"


def tag_snapshot(tag_id):
    name, description = tags[tag_id - 1]
    return {
        "id": tag_id,
        "name": name,
        "description": description,
        "color": tag_colors[tag_id - 1],
        "soft_deleted": False,
    }


def mutate_tag_scalars(current):
    changed = dict(current)
    fields = sample(["name", "description", "color"], randint(0, 3))
    for field in fields:
        if field == "name":
            changed["name"] = choice(tags)[0]
        elif field == "description":
            changed["description"] = choice(tags)[1]
        else:
            changed["color"] = randint(tagColMin, tagColMax)
    return changed


def person_snapshot(person_id):
    ptype, pdata = persons[person_id - 1]
    return {
        "id": person_id,
        "type": ptype,
        "data": pdata,
        "linked_user_id": person_linked_user.get(person_id),
        "soft_deleted": False,
    }


def mutate_person_scalars(current):
    changed = dict(current)
    fields = sample(["data", "linked_user_id"], randint(0, 2))
    for field in fields:
        if field == "data":
            # Swap in another person's data of the same type — a fresh made-up value isn't
            # needed, this just needs to plausibly differ from the current one
            same_type = [p for p in persons if p[0] == current["type"] and p[1] != current["data"]]
            if same_type:
                changed["data"] = choice(same_type)[1]
        else:
            changed["linked_user_id"] = choice(user_ids) if random() < 0.5 else None
    return changed


def event_snapshot(event_id):
    rec = event_records[event_id - 1]
    return {
        **rec,
        "posted_at": rec["posted_at"].replace(" ", "T"),
        "soft_deleted": False,
        "tags": [
            {"id": tid, "name": tags[tid - 1][0], "color": tag_colors[tid - 1]}
            for tid in sorted(event_tags.get(event_id, ()))
        ],
        "persons": [
            {"id": pid, "type": persons[pid - 1][0], "data": persons[pid - 1][1]}
            for pid in sorted(event_persons.get(event_id, ()))
        ],
        "relatedEvents": [
            {"id": rid, "name": event_records[rid - 1]["name"]}
            for rid in sorted(event_related.get(event_id, ()))
        ],
    }


def mutate_event_scalars(snap):
    """Swaps a random handful of scalar fields for plausible alternates. posted_at, id, and the
    relation lists are left to their own callers — every field changing every time would make
    the diffs meaningless."""
    changed = dict(snap)
    fields = ["name", "description", "details", "posted_by_user_id", "event_date_time_offset"]
    fields += ["event_date1", "event_date_diff", "event_date_units"] if snap["event_date_type"] == "centered" \
        else ["event_date1", "event_date2"]

    for field in sample(fields, randint(0, min(3, len(fields)))):
        if field == "name":
            changed["name"] = choice(event_texts)[0]
        elif field == "description":
            changed["description"] = choice(event_texts)[1]
        elif field == "details":
            changed["details"] = choice(details) if randint(0, 1) == 1 else None
        elif field == "posted_by_user_id":
            changed["posted_by_user_id"] = choice(user_ids)
        elif field == "event_date_time_offset":
            changed["event_date_time_offset"] = randint(minEventDateTimeOffset, maxEventDateTimeOffset)
        elif field == "event_date1":
            changed["event_date1"] = randint(min_event_date, max_event_date)
        elif field == "event_date_diff":
            changed["event_date_diff"] = randint(0, date_c_max_diff)
        elif field == "event_date_units":
            changed["event_date_units"] = choice(["d", "h", "m"])
        elif field == "event_date2":
            changed["event_date2"] = changed["event_date1"] + randint(min_event_date, max_event_date)

    # Low-frequency, independent of the field sampling above — represents this UPDATE also being
    # the point the event was soft-deleted/restored, distinct from a dedicated DELETE action
    if random() < relation_attr_drift_val:
        changed["soft_deleted"] = not snap["soft_deleted"]

    return changed


def old_tag_entry(tag_id):
    """A tag's old snapshot entry — its colour occasionally drifts from the current one, at low
    frequency, independent of whether the tag was also added/removed from the list."""
    color = tag_colors[tag_id - 1]
    if random() < relation_attr_drift_val:
        color = randint(tagColMin, tagColMax)
    return {"id": tag_id, "name": tags[tag_id - 1][0], "color": color}


def old_person_entry(person_id):
    """A person's old snapshot entry — their data (username/NPC name) occasionally drifts from
    the current one, at low frequency, independent of whether they were also added/removed."""
    ptype, data = persons[person_id - 1]
    if random() < relation_attr_drift_val:
        same_type = [p for p in persons if p[0] == ptype and p[1] != data]
        if same_type:
            data = choice(same_type)[1]
    return {"id": person_id, "type": ptype, "data": data}


def old_related_event_entry(event_id):
    """A related event's old snapshot entry — its name occasionally drifts from the current one,
    at low frequency, independent of whether it was also added/removed from the list."""
    name = event_records[event_id - 1]["name"]
    if random() < relation_attr_drift_val:
        name = choice(event_texts)[0]
    return {"id": event_id, "name": name}


def mutate_event(current):
    old = mutate_event_scalars(current)
    old_tags = tweak_relation_list({t["id"] for t in current["tags"]}, range(1, len(tags) + 1))
    old_persons = tweak_relation_list({p["id"] for p in current["persons"]}, range(1, len(persons) + 1))
    old_related = tweak_relation_list(
        {e["id"] for e in current["relatedEvents"]},
        [i for i in range(1, len(event_texts) + 1) if i != current["id"]]
    )
    old["tags"] = [old_tag_entry(tid) for tid in sorted(old_tags)]
    old["persons"] = [old_person_entry(pid) for pid in sorted(old_persons)]
    old["relatedEvents"] = [old_related_event_entry(rid) for rid in sorted(old_related)]
    return old


def changelog_values(snapshot, mutate_old):
    """
    Given an entity's current-state snapshot, randomly picks an action and derives the
    (old_values, new_values, action) triple to log. INSERT/DELETE bracket the entity's lifecycle
    around that same snapshot; UPDATE derives a plausible "before" state via mutate_old.
    """
    action = random_action()
    if action == "INSERT":
        return None, snapshot, "INSERT"
    if action == "DELETE":
        before = dict(snapshot)
        after = {**snapshot, "soft_deleted": True}
        return before, after, "DELETE"
    return mutate_old(snapshot), snapshot, "UPDATE"


def make_changelogs():
    # hd_changelog is generic (what/entity_id rather than a dedicated event_id column) — cover
    # all three trackable entity kinds here
    string = (
        "INSERT INTO hd_changelog"
        " (user_id, message, created_at, what, entity_id, old_values, new_values, action, schema_version)"
        " VALUES \n"
    )

    entity_kinds = [
        ("EVENT", len(event_texts), lambda eid: changelog_values(event_snapshot(eid), mutate_event)),
        ("TAG", len(tags), lambda eid: changelog_values(tag_snapshot(eid), mutate_tag_scalars)),
        ("PERSON", len(persons), lambda eid: changelog_values(person_snapshot(eid), mutate_person_scalars)),
    ]

    for what, entity_count, build_values in entity_kinds:
        for entity_id in range(1, entity_count):
            count = randint(0, len(changelogs))
            for _ in range(count - 1):
                author_id = choice(user_ids)
                created_at = random_datetime()
                message = choice(changelogs)
                old_values, new_values, action = build_values(entity_id)
                string += (
                    f"({author_id}, '{message}', '{created_at}', '{what}', {entity_id},"
                    f" {to_json_sql(old_values)}, {to_json_sql(new_values)}, '{action}', {changelog_schema_version}), \n"
                )

    string = string.rstrip(", \n")
    string += ";\n"
    out.write(string)


make_clear_tables()
make_person_list()
print("Made persons")
make_event_list()
print("Made events")
make_tag_list()
print("Made tags")
make_event_event_relation()
print("Made event event")
make_event_tag_relation()
print("Made event tag")
make_event_person_relation()
print("Made event person")
make_changelogs()
print("Made changelogs")
out.close()
