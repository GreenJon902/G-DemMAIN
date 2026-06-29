import argparse
from datetime import datetime, timedelta
from random import randint, random, choice, seed
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

# Link the first half of the provided users each to a distinct person (1-based person IDs).
linked_users = user_ids[: ceil(len(user_ids) / 2)]
# Maps person id (1-based) → linked user id.
person_linked_user = {i + 1: uid for i, uid in enumerate(linked_users)}

out = open("./out.sql", "w")


def make_clear_tables():
    # FK checks must be disabled for TRUNCATE to work across referenced tables.
    # TRUNCATE resets AUTO_INCREMENT, which matches our explicit id values.
    tables = [
        "hisdoc_event_event",
        "hisdoc_event_person",
        "hisdoc_event_tag",
        "hisdoc_changelog",
        "hisdoc_event",
        "hisdoc_tag",
        "hisdoc_person",
    ]
    out.write("SET FOREIGN_KEY_CHECKS = 0;\n")
    for table in tables:
        out.write(f"TRUNCATE TABLE {table};\n")
    out.write("SET FOREIGN_KEY_CHECKS = 1;\n\n")


def make_person_list():
    string = "INSERT INTO hisdoc_person (id, type, data, linked_user_id) VALUES \n"

    for n, person in enumerate(persons):
        linked = person_linked_user.get(n + 1)
        linked_str = str(linked) if linked is not None else "NULL"
        string += f"({n + 1}, '{person[0]}', '{person[1]}', {linked_str}), \n"

    string = string.rstrip(", \n")
    string += ";\n"
    out.write(string)


def make_event_list():
    c_dates = (
        "INSERT INTO hisdoc_event"
        " (id, name, event_date_type, event_date1, event_date_units, event_date_diff,"
        " posted_at, description, posted_by_user_id, details, event_date_time_offset)"
        " VALUES \n"
    )
    r_dates = (
        "INSERT INTO hisdoc_event"
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
        # NULL with the same probability as any single user.
        posted_by = choice(user_ids + [None])
        posted_by_str = str(posted_by) if posted_by is not None else "NULL"
        detail = "'" + choice(details) + "'" if randint(0, 1) == 1 else "NULL"
        event_date_offset = randint(minEventDateTimeOffset, maxEventDateTimeOffset)

        if randint(0, 1) == 0:  # Centered
            date_units = ["d", "h", "m"][randint(0, 2)]
            date_diff = randint(0, date_c_max_diff)
            c_dates += (
                f"({eid}, '{name}', 'centered', {date1}, '{date_units}', {date_diff},"
                f" '{posted_at}', '{description}', {posted_by_str}, {detail}, {event_date_offset}), \n"
            )
        else:  # Ranged
            date2 = date1 + randint(min_event_date, max_event_date)
            r_dates += (
                f"({eid}, '{name}', 'ranged', {date1}, {date2},"
                f" '{posted_at}', '{description}', {posted_by_str}, {detail}, {event_date_offset}), \n"
            )

        eid += 1

    c_dates = c_dates.rstrip(", \n")
    c_dates += ";\n"
    out.write(c_dates)

    r_dates = r_dates.rstrip(", \n")
    r_dates += ";\n"
    out.write(r_dates)


def make_tag_list():
    string = "INSERT INTO hisdoc_tag (id, name, description, color) VALUES \n"

    for n, tag in enumerate(tags):
        string += f"({n + 1}, '{tag[0]}', '{tag[1]}', {randint(tagColMin, tagColMax)}), \n"

    string = string.rstrip(", \n")
    string += ";\n"
    out.write(string)


def make_event_event_relation():
    # event_a_id < event_b_id is enforced by the table constraint.
    string = "INSERT INTO hisdoc_event_event (event_a_id, event_b_id) VALUES \n"

    done = set()

    for n1 in range(len(event_texts) - 1):
        for n2 in range(0, len(event_texts) - 1, randint(*eventeventrelation_step_val)):
            if n1 != n2:
                pair = (min(n1 + 1, n2 + 1), max(n1 + 1, n2 + 1))
                if pair not in done:
                    if random() < eventeventrelation_val:
                        string += f"({pair[0]}, {pair[1]}), \n"
                        done.add(pair)
        print(n1 + 1, "/", len(event_texts) - 1)

    string = string.rstrip(", \n")
    string += ";\n"
    out.write(string)


def make_event_person_relation():
    string = "INSERT INTO hisdoc_event_person (event_id, person_id) VALUES \n"

    done = set()

    for n1 in range(len(event_texts) - 1):
        for n2 in range(len(persons) - 1):
            pair = (n1 + 1, n2 + 1)
            if pair not in done:
                if random() < eventpersonrelation_val:
                    string += f"({pair[0]}, {pair[1]}), \n"
                    done.add(pair)

    string = string.rstrip(", \n")
    string += ";\n"
    out.write(string)


def make_event_tag_relation():
    string = "INSERT INTO hisdoc_event_tag (event_id, tag_id) VALUES \n"

    done = set()

    for n1 in range(len(event_texts) - 1):
        for n2 in range(len(tags) - 1):
            pair = (n1 + 1, n2 + 1)
            if pair not in done:
                if random() < eventtagrelation_val:
                    string += f"({pair[0]}, {pair[1]}), \n"
                    done.add(pair)

    string = string.rstrip(", \n")
    string += ";\n"
    out.write(string)


def make_changelogs():
    string = "INSERT INTO hisdoc_changelog (event_id, description, author_user_id, created_at) VALUES \n"

    for i in range(len(event_texts) - 1):
        count = randint(0, len(changelogs))
        for _ in range(count - 1):
            author_id = choice(user_ids)
            created_at = random_datetime()
            string += f"({i + 1}, '{choice(changelogs)}', {author_id}, '{created_at}'), \n"

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
