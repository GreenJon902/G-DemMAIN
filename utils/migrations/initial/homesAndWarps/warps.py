"""
See README.md in parent folder.
"""

import sys, os, yaml, json
from shared import WORLD_MAP

GLOBAL_DEFAULT = False  # This default value provides the same behavior as before

# Get source and destination paths
if len(sys.argv) != 3:
    raise Exception("Invalid number of arguements")
source_path, dest_path = sys.argv[1:]

if not os.path.exists(source_path):
    raise Exception("Source path does not exist")
if os.path.exists(dest_path):
    raise Exception("Dest path already exists")

# Convert data
output = []  # Output is a single file
for file in os.listdir(source_path):
    # Validate name
    if not file.endswith(".yml"):
        print(f"\"{file}\" is not a yaml file, skipping")
        continue
    
    # Validate contents
    print(f"Opening \"{file}\"...")
    contents = yaml.safe_load(open(os.path.join(source_path, file)))
    # Keys:
    if not set(contents.keys()) == {"world", "world-name", "x", "y", "z", "yaw", "pitch", "name", "lastowner"}:
        print("Contents has invalid keys")
        continue
    # Value checks:
    if contents["name"] != file[:-4]:
        print("Internal world name does not match file name")
        continue
    if (world := contents["world-name"]) not in WORLD_MAP:
        print(f"Unknown world \"{world}\"")
        continue
    
    # Add to output
    output.append({
        "name": contents["name"],
        "owner": contents["lastowner"],
        "x": contents["x"], "y": contents["y"], "z": contents["z"],
        "yaw": contents["yaw"], "pitch": contents["pitch"],
        "global": GLOBAL_DEFAULT,
        "world": WORLD_MAP[contents["world-name"]]
    })

# Save data
print(f"Finished migrating {len(output)} warps")
json.dump(output, open(dest_path, "w"), indent=4)
