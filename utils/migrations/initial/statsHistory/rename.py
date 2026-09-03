"""
See ../README.md.
"""

import sys, os, re, shutil

# Get source and destination paths
if len(sys.argv) != 3:
    raise Exception("Invalid number of arguements")
source_path, dest_path = sys.argv[1:]

if not os.path.exists(source_path):
    raise Exception("Source path does not exist")
if os.path.exists(dest_path):
    raise Exception("Dest path already exists")
os.makedirs(dest_path)

NAME_PATTERN = re.compile(r"^(\d{4})\.(\d{2})\.(\d{2})$")
DEFAULT_TIME = "00-00-00"  # Assume taken at midnight, we have no better data

# Convert data
backup_count = 0
for name in os.listdir(source_path):
    # Validate name
    match = NAME_PATTERN.match(name)
    if match is None:
        print(f"\"{name}\" does not match the expected date format, skipping")
        continue
    year, month, day = match.groups()

    # Copy contents under the new name
    new_name = f"{year}-{month}-{day}-{DEFAULT_TIME}"
    print(f"Copying \"{name}\" to \"{new_name}\"...")
    shutil.copytree(os.path.join(source_path, name), os.path.join(dest_path, new_name))
    backup_count += 1

# Save data
print(f"Finished migrating {backup_count} backups")
