import os
import sys
from argparse import ArgumentParser
from configparser import ConfigParser

import modifiers
from checkers import checker
from colors import OLD_CONTENTS_COL, PATH_COL, RESET, WARNING, UNIMPORTANT
from constants import BINARY_EXTENSIONS, MODIFIER_ORDER, MODIFIERS_TOUCHING_DEST_PATH, TEXT_EXTENSIONS
from exceptions import AlreadyUpToDate, Problem, Skipped
from modifiers import flags_to_modifiers
from modifiers.handle_marker import MARKER_CHECKERS
from static_config_file import build_scf
from diffing import drop_wildcard_lines

# Parse arguments
parser = ArgumentParser(description="See doc/Config Sync.md")
parser.add_argument("syncmap",
                    nargs   = "?",  # Declare this argument as optional
                    default = "sync-map.ini",
                    help    = "The path of the config map to use, defaults to ./sync-map.ini")
parser.add_argument("-d", "--dry-run",
                    action  = "store_true",  # This sets default value to false
                    help    = "Is this a dry run (e.g. if this flag is set then no changes will be made)")
parser.add_argument("-e", "--environ",
                    nargs   = "?",  # Declare this argument as optional
                    default = "/etc/g-demmain",
                    help    = "The path where populated environment files are stored when in production. Used for templating. Defaults to /etc/g-demmain")
parser.add_argument("-v", "--verbose",
                    action  = "store_true",  # This sets default value to false
                    help    = "If set then we will print a lot more information")
args = parser.parse_args()


def vprint(*pargs, **pkw):
    if args.verbose:
        print(*pargs, **pkw)


print("Executing in", os.getcwd())
print("Ran with args", sys.argv, "which parsed to", args)

# Load sync-map. [recursive] entries are walked into subfolders (e.g. systemd-services'
# mysql.service.d), [flat] entries only look at the immediate contents of the destination folder -
# needed for destinations like /etc or /etc/sudoers.d, where other packages may also own files, so
# walking recursively would mean scanning far more than the handful of files we actually manage.
config = ConfigParser()
if not os.path.exists(args.syncmap):
    raise Exception("Sync map file does not exist - " + args.syncmap + " - are you sure you're in the right folder?")
config.read(args.syncmap)
sync_map = [(source, destination, True) for (source, destination) in config.items("recursive")] if config.has_section("recursive") else []
sync_map += [(source, destination, False) for (source, destination) in config.items("flat")] if config.has_section("flat") else []
print("Loaded map:", sync_map)

for (source, destination, recursive) in sync_map:
    if not os.path.exists(source):
        raise Exception("Source folder does not exist - " + source)
    if not os.path.exists(destination):
        raise Exception("Destination folder does not exist - " + destination)


def list_files(folder, recursive):
    """
    Yields file paths directly inside folder. Recursive descends into subfolders like
    os.walk, flat only looks at folder's immediate contents (via os.listdir) and skips
    subfolders entirely.
    """
    if recursive:
        for (root, dirs, files) in os.walk(folder):
            for file in files:
                yield os.path.join(root, file)
    else:
        for entry in os.listdir(folder):
            full = os.path.join(folder, entry)
            if not os.path.isdir(full):
                yield full



# Three dictionaries mapping from modifier name to the respective hook
# These need to be built as data from args (e.g. environ_var) is only accessible in this file
MODIFIER_FUNCS = modifiers.build_funcs(args.environ, vprint)

paths_accounted_for = []


def build_call_chain(scf, flags):
    """
    Creates the list of functions required to copy a `scf`. This includes all the pre-hooks, check, write, and the post-hooks.
    Given `flags` must be in FLAG_ORDER.
    """

    active_modifiers = flags_to_modifiers(flags)

    def account_for_path(scf):
        paths_accounted_for.append(scf.dest_path)
        scf.lock_dest()

    call_chain = [
        *[MODIFIER_FUNCS["before"][mod] for mod in MODIFIER_ORDER[0:MODIFIERS_TOUCHING_DEST_PATH] if mod in active_modifiers],
        account_for_path,  # All modifiers before here may touch the destination path, so only after them can we extract the path. All modifiers before this should not crash (as then we don't know anything maps to the destination file, which may then be picked up and deleted)
        *[MODIFIER_FUNCS["before"][mod] for mod in MODIFIER_ORDER[MODIFIERS_TOUCHING_DEST_PATH:] if mod in active_modifiers],
        checker, write,
        *[MODIFIER_FUNCS["after"][mod] for mod in reversed(active_modifiers)]
    ]

    return call_chain


def print_problem(problem):
    print(f"Problem with {PATH_COL}{problem.source_path}{RESET}: {WARNING}{problem.message}{RESET}")


def write(scf):
    """
    Writes scf.contents to scf.dest_path. Only ever reached when the checker earlier in the
    chain didn't raise AlreadyUpToDate, so there's always something real to write here.
    """
    # Log the contents if the flag is set
    if scf.print_old and os.path.exists(scf.dest_path):
        print(f"Old contents of {PATH_COL}{scf.dest_path}{RESET} ---")
        with open(scf.dest_path, "r") as f:
            print(f"{OLD_CONTENTS_COL}{f.read()}{RESET}")
        print("---")

    # Write the file
    print(f"Writing {PATH_COL}{scf.dest_path}{RESET}")
    if scf.extension in TEXT_EXTENSIONS:  
        scf.contents = drop_wildcard_lines(scf.contents)  # TODO: Should dropping wildcards really happen here?
    if not args.dry_run:
        parent = os.path.dirname(scf.dest_path)
        if parent and not os.path.exists(parent):
            os.makedirs(parent)
        with open(scf.dest_path, "wb" if scf.extension in BINARY_EXTENSIONS else "w") as f:
            f.write(scf.contents)
    written.append(scf.dest_path)



# Normal run (dry-run aside): sync every file, then scan for orphaned managed files.
written, removed, skipped, problems, already_correct = [], [], [], [], []

 
# Sync all files from source to destination
for (source_folder, destination_folder, recursive) in sync_map:
    for source_file in list_files(source_folder, recursive):
        try:
            scf, flags = build_scf(source_file, source_folder, destination_folder)
            call_chain = build_call_chain(scf, flags)
            for call in call_chain:
                call(scf)
        except AlreadyUpToDate as a:
            already_correct.append(a.dest_path)
        except Skipped as s:
            print(f"Ignoring {PATH_COL}{s.source_path}{RESET}")
            skipped.append(s.dest_path)
        except Problem as p:
            print_problem(p)
            problems.append(p)

# Delete outdated previously synced files
for (source_folder, destination_folder, recursive) in sync_map:
    for file in list_files(destination_folder, recursive):
        if os.path.islink(file):
            vprint(f"Ignoring symlink at {PATH_COL}{file}{RESET}")
            continue
        if file in paths_accounted_for:
            continue

        ext = os.path.splitext(file)[1].lstrip(".") or "txt"
        if ext not in MARKER_CHECKERS:
            vprint(f"Ignoring unsupported extension at {PATH_COL}{file}{RESET}")
            continue

        try:
            with open(file, "r") as f:
                contents = f.read()
        except UnicodeDecodeError:
            vprint(f"Ignoring non-text file at {PATH_COL}{file}{RESET}")
            continue

        if not MARKER_CHECKERS[ext](contents):
            vprint(f"Ignoring file with no marker at {PATH_COL}{file}{RESET}")
            continue

        while True:
            action = input(f"{PATH_COL}{file}{RESET} has a marker, but was not synced this run. Should it be removed[d] or ignored[i]? ")
            if action == "d":
                print(f"Removing {PATH_COL}{file}{RESET}")
                if not args.dry_run:
                    os.remove(file)
                removed.append(file)
                break
            elif action == "i":
                print(f"Ignoring {PATH_COL}{file}{RESET}")
                skipped.append(file)
                break
            else:
                print("Invalid option, expected d or i")

# Print summary
total_synced = len(written) + len(removed) + len(already_correct)
print()
print(f"{total_synced} files synced ({len(written)} written, {len(removed)} removed, {len(already_correct)} remained the same), "
      f"{len(skipped)} files skipped, {len(problems)} errors occured.")


def print_path_list(label, paths):
    print(f"{label}:")
    if not paths:
        print(f"{UNIMPORTANT}(none){RESET}")
        return
    for path in paths:
        print(f"{PATH_COL}{path}{RESET}")


print_path_list("Written", written)
print_path_list("Removed", removed)
if args.verbose:
    print_path_list("Already correct", already_correct)
else:
    print("Already correct:")
    print(f"{UNIMPORTANT}(hidden){RESET}")
print_path_list("Skipped", skipped)

print("Problems:")
if not problems:
    print(f"{UNIMPORTANT}(none){RESET}")
else:
    for problem in problems:
        print(f"{WARNING}{problem.message}{RESET}")
