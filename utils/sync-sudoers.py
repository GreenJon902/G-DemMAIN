# TODO: Compare old and new config like we do with sync-static-config.py. And add header. Maybe we can just plug these two together into eachother

import subprocess
import os
import sys

SOURCE_PATH = "sudoers" #"/opt/infra/sudoers"
DESTINATION_PATH = "/etc/sudoers.d/g-demMAIN"

def checkSudoers():
    # Checks if the syntax of the currently installed sudoers file is correct.
    # The processes stdout and stderr is piped to python's stdout and stderr
    # Returns the error code
    proc = subprocess.run(['visudo', '-c'])
    return proc.returncode


# Check if sudoers is formatted correctly to begin with
code = checkSudoers()
if code == 0:
    print("Initial sudoers correctly formatted")
else:
    print(f"Sudoers check failed with code {code}")
    if input("Copy anyway (yes/no)? ") == "yes":
        pass
    else:
        print("Exiting")
        sys.exit()

# Output the old sudoers file (if it exists) as a backup that the user can revert back to
if not os.path.exists(DESTINATION_PATH):
    print("Old sudoers file does not exist!")
else:
    print("OLD SUDOERS FILE ----")
    print(open(DESTINATION_PATH, "r").read())
    print("---------------------")

# Copy the new file
open(DESTINATION_PATH, "w").write(open(SOURCE_PATH, "r").read())
os.chmod(DESTINATION_PATH, 0o0440)  # We require this permission on this file


# Check if it is still formatted correctly
code = checkSudoers()
if code == 0:
    print("Sudoers is formatted correctly")
else:
    print()
    print(f"WARNING: Sudoers is not formatted correctly, it is strongly recommended you roll back or remove {DESTINATION_PATH}")
    print()
