# Ensures that all the keys defined in /environ/** are defined in the environment folder. It will also check for extraneous keys, and unset values.

from argparse import ArgumentParser
import os
import re
import sys

SOURCE_REGEX = r"^([A-Z_]+)\n((?:# .+\n?)*)\n"
SOURCE_REGEX_FLAGS = re.MULTILINE
DEST_REGEX = r"^([A-Z_]+)=(.*?) *$"
DEST_REGEX_FLAGS = re.MULTILINE 

# Parse arguments
parser = ArgumentParser(description="See README.md")
parser.add_argument("syncdest",
                    nargs   = "?",  # Declare this argument as optional
                    default = "/etc/g-demmain",
                    help    = "The path where the populated environment files are stored when in production")
parser.add_argument("-v", "--verbose",
                    action  = "store_true",  # This sets default value to false
                    help    = "If set then we will print a lot more information")
args = parser.parse_args()

# Define verbose printing function
def vprint(*pargs, **pkw):
    if args.verbose:
        print(*pargs, **pkw)

# Log run-info
print("Executing in", os.getcwd())
print("Ran with args", sys.argv, "which parsed to", args)

# Create destination folder if necessary
if not os.path.exists(args.syncdest):
    print(f"Creating {args.syncdest}")
    os.mkdir(args.syncdest)

# Run the syncing:
for file in os.listdir("."):

    # Skip README
    if file == "README.md":
        vprint(f"Skipping {file}")
        continue

    # Figure out dest path and log
    dest = os.path.join(args.syncdest, file + ".env")
    print(f"Syncing {file} to {dest}...")

    # Parse the source file
    source = open(file, "r").read()
    # Clean up newlines for parsing:
    source += "\n"
    while "\n\n" in source:
        source = source.replace("\n\n", "\n")
    # Parse each variable:
    vars = [match.groups() for match in re.finditer(SOURCE_REGEX, source, SOURCE_REGEX_FLAGS)]  # [(var_name, doc)]
    vprint("\tLoaded", vars)
    # Ensure that we have parsed all the content:
    assert "\n".join(f"{a}\n{b}" for (a,b) in vars) + "\n" == source, "Source doesn't match what was parsed, is there a formatting error that is tripping regex up?"

    # Load the keys in the destination file. This is a function so we can reparse the file after making changes
    def parse_dest():
        if os.path.exists(dest):
            destvars = [(match.groups()[0], match.groups()[1] != "") for match in re.finditer(DEST_REGEX, open(dest, "r").read(), DEST_REGEX_FLAGS)]  # [(var_name, is_given)]
            vprint("\tLoaded from dest - ", destvars)
        else:
            destvars = []
            vprint("\tDest does not exist")
        return destvars
    destvars = parse_dest()

    # Check if any new variables need to be added to the destination
    for (name, doc) in vars:
        if name not in [v[0] for v in destvars]:
            print(f"\t{name} is not given, adding!")
            with open(dest, "a") as destfile:
                destfile.write("\n")
                destfile.write(doc)
                destfile.write("\n")
                destfile.write(f"{name}=")
                destfile.write("\n")
    destvars = parse_dest()
    
    # Check if any variables are extraneous (exist but are not specified in the source)
    for (name, _) in destvars:
        if name not in [v[0] for v in vars]:
            print(f"\t{name} exists in the destination file but is not specified in the source file")

    # Check if any variables have no value
    for (name, given) in destvars:
        if not given:
            print(f"\tWARNING: {name} has no value")
