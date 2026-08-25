"""
See README.md in parent folder.
"""

import sys, os, yaml, json
from shared import WORLD_MAP

GLOBAL_DEFAULT = False  # This default value provides the same behavior as before
MAX_HOMES_DEAULT = 2  # This is the default for a 'non' (unranked player)

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
    # Type & presence of "homes"
    if "homes" not in contents:
        print(f"Contents does not contain \"homes\" key")
        continue
    if type(contents["homes"]) is not dict:
        print("\"homes\" is not a dict")
        continue
    contents = contents["homes"]

    output_homes = []
    for home_name, home_data in contents.items():
        # If no world-name key then world is world-name
        if "world-name" not in home_data and "world" in home_data:
            home_data["world-name"] = home_data["world"]  # We don't use "world" so it's fine that it isn't an id

        # Validate home_data
        # Keys:
        if not set(home_data.keys()) == {"world", "world-name", "x", "y", "z", "yaw", "pitch"}:
            print("Contents has invalid keys")
            continue
        # Value checks:
        if (world := home_data["world-name"]) not in WORLD_MAP:
            print(f"Unknown world \"{world}\"")
            contents
    
        # Add to output
        output_homes.append({
            "name": home_name,
            "x": home_data["x"], "y": home_data["y"], "z": home_data["z"],
            "yaw": home_data["yaw"], "pitch": home_data["pitch"],
            "world": WORLD_MAP[home_data["world-name"]]
        })

    # Add output_homes to output if at least one home
    if len(output_homes) == 0:
        continue
    output.append({"uuid": file[:-4], "homes": output_homes, "maxHomes": MAX_HOMES_DEAULT})

# Save data
print(f"Finished migrating {len(output)} players")
json.dump(output, open(dest_path, "w"), indent=4)
