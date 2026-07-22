# Ensures that all the keys defined in /environ/** are defined in the destination environment
# folder for the given mode (prod/dev). Supports per-mode forced values and per-mode
# "must not be set" rejections (see README.md), plus (as before) checks for extraneous
# destination-only keys and unset values.

from argparse import ArgumentParser
import os
import re
import sys

SOURCE_REGEX = r"^([A-Z_]+)((?: [a-zA-Z]+=\"[^\"]*\"| ![a-zA-Z]+)*)\n((?:# .+\n?)*)\n"
SOURCE_REGEX_FLAGS = re.MULTILINE
TOKEN_REGEX = r' (?:([a-zA-Z]+)="([^"]*)"|!([a-zA-Z]+))'
DEST_REGEX = r"^([A-Z_]+)=(.*?) *$"
DEST_REGEX_FLAGS = re.MULTILINE

RESET = "\033[0m" if sys.stdout.isatty() else ""     # If we are in a terminal then colors probably work
PATH_COL = "\033[94m" if sys.stdout.isatty() else ""

# Parse arguments
parser = ArgumentParser(description="See README.md")
parser.add_argument("mode",
                    choices = ["prod", "dev"],
                    help    = "Which mode's per-variable spec to apply (controls forced values / rejected vars, and the syncdest default)")
parser.add_argument("syncdest",
                    nargs   = "?",  # Declare this argument as optional
                    default = None,
                    help    = "The path where the populated environment files are stored. Defaults to /etc/g-demmain when mode is prod; required when mode is dev")
parser.add_argument("-v", "--verbose",
                    action  = "store_true",  # This sets default value to false
                    help    = "If set then we will print a lot more information")
args = parser.parse_args()

# Dev has no sensible shared destination (unlike prod's /etc/g-demmain), so it must be given explicitly
if args.syncdest is None:
    if args.mode == "dev":
        parser.error("syncdest is required when mode is 'dev'")
    args.syncdest = "/etc/g-demmain"

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

# Parses a NAME line's trailing token list (e.g. ' prod="/opt/infra" !dev') into per-mode forced
# values and per-mode rejections
def parse_tokens(name, tokens):
    forced = {}       # mode -> forced value
    rejected = set()  # modes where this var must not be set
    matches = list(re.finditer(TOKEN_REGEX, tokens))
    # Ensure that we have parsed all the tokens (catches malformed/unquoted tokens instead of silently dropping them)
    assert "".join(match.group(0) for match in matches) == tokens, f"Malformed mode token list for {name}: {tokens!r}"
    for (mode_eq, value, mode_bang) in (match.groups() for match in matches):
        if mode_eq is not None:
            forced[mode_eq] = value
        else:
            rejected.add(mode_bang)
    return forced, rejected

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
    vars = [match.groups() for match in re.finditer(SOURCE_REGEX, source, SOURCE_REGEX_FLAGS)]  # [(var_name, tokens, doc)]
    vprint("\tLoaded", vars)
    # Ensure that we have parsed all the content:
    assert "\n".join(f"{name}{tokens}\n{doc}" for (name, tokens, doc) in vars) + "\n" == source, "Source doesn't match what was parsed, is there a formatting error that is tripping regex up?"

    # Load the keys in the destination file. This is a function so we can reparse the file after making changes
    def parse_dest():
        if os.path.exists(dest):
            destvars = [match.groups() for match in re.finditer(DEST_REGEX, open(dest, "r").read(), DEST_REGEX_FLAGS)]  # [(var_name, value)]
            vprint("\tLoaded from dest - ", destvars)
        else:
            destvars = []
            vprint("\tDest does not exist")
        return destvars
    destvars = parse_dest()

    # Rewrites an existing NAME=... line in dest to the given value in place, preserving the rest of the file
    def rewrite_dest_var(name, value):
        contents = open(dest, "r").read()
        contents, count = re.subn(rf"^{name}=.*$", f"{name}={value}", contents, flags=DEST_REGEX_FLAGS)
        assert count == 1, f"Expected exactly one {name}= line in {dest} to rewrite, found {count}"
        open(dest, "w").write(contents)

    # Check if any new variables need to be added to the destination, and that any forced-value
    # variables already present match what the current mode forces
    for (name, tokens, doc) in vars:
        forced, rejected = parse_tokens(name, tokens)
        forced_value = forced.get(args.mode)
        is_rejected = args.mode in rejected
        dest_value = next((value for (n, value) in destvars if n == name), None)
        present = dest_value is not None

        if is_rejected:
            if present:
                print(f"\tWARNING: {name} must not be set in {args.mode} mode, but is present in {PATH_COL}{dest}{RESET}")
            continue

        if forced_value is not None:
            if not present:
                print(f"\t{name} is not given, adding with the forced {args.mode} value!")
                with open(dest, "a") as destfile:
                    destfile.write("\n")
                    destfile.write(doc)
                    destfile.write("\n")
                    destfile.write(f"{name}={forced_value}")
                    destfile.write("\n")
            elif dest_value != forced_value:
                print(f"\tWARNING: {name} is {dest_value!r} in {PATH_COL}{dest}{RESET} but {args.mode} forces {forced_value!r}")
                while True:
                    action = input("\tOverwrite with the forced value[o] or keep the current value[k]? ")
                    if action == "o":
                        rewrite_dest_var(name, forced_value)
                        print(f"\tOverwrote {name} in {PATH_COL}{dest}{RESET}")
                        break
                    elif action == "k":
                        print(f"\tKept {name}'s current value in {PATH_COL}{dest}{RESET}")
                        break
                    else:
                        print("Invalid option, expected o or k")
            else:
                vprint(f"\t{name} already matches the forced {args.mode} value")
            continue

        # Unspecified for this mode - today's existing behaviour (manual-fill path for real secrets)
        if not present:
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
    for (name, value) in destvars:
        if not value:
            print(f"\tWARNING: {name} has no value")
