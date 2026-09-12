import json
import os

from colors import PATH_COL, RESET, DIFF_NOTE
from constants import BINARY_EXTENSIONS, JSON_EXTENSIONS, TEXT_EXTENSIONS, TEXT_WILDCARD_TOKEN
from diffing import json_matches, line_diff, substitute_wildcards, text_matches, drop_wildcard_lines
from exceptions import AlreadyUpToDate, Skipped, Problem


def _read_dest_if_exists(dest_path, binary):
    if not os.path.exists(dest_path):
        return None
    with open(dest_path, "rb" if binary else "r") as f:
        return f.read()


def compare(scf):
    """
    Compares the source and destination file - a nested JSON comparison for "json", a wildcard-
    aware line-by-line comparison for the plain-text extensions, and a byte comparison for the
    binary extensions.
    Returns (is_same, diff). If is_same is true then diff is always None. Otherwise, if diff is
    None then the destination file does not exist.
    Diff uses source with TEXT_WILDCARD_DROP_TOKEN replaced.
    """
    is_binary = scf.extension in BINARY_EXTENSIONS
    source_display_contents = scf.contents  # We show the diff after TEXT_WILDCARD_DROP_TOKEN has already happened
    dest_contents = _read_dest_if_exists(scf.dest_path, is_binary)
    if dest_contents is None:



        # TODO: Implement JSON native overwrites
        # Currently the writer will overwrite the dest json file with the source file (which contains wildcards...), so we just say this is unsupported
        if scf.extension in JSON_EXTENSIONS:
            source_parsed, contains_wildcards = substitute_wildcards(json.loads(scf.contents))
            if contains_wildcards:
                raise Problem(scf.source_path, f"Source JSON file contains wildcards and destination does not exist. This must be manually fixed - {scf.source_path}")

        # TODO: Native overwrites?? Is this even worth implementing for the number file types????
        # A (non-dropped) wildcard line means we don't have a real value to write, so a fresh destination value can't be created automatically
        elif scf.extension in TEXT_EXTENSIONS:
            if TEXT_WILDCARD_TOKEN in scf.contents.splitlines():
                raise Problem(scf.source_path, f"Source text file contains a wildcard line and destination does not exist. This must be manually fixed - {scf.source_path}")

        return False, None

    if scf.extension in JSON_EXTENSIONS:
        source_parsed, contains_wildcards = substitute_wildcards(json.loads(scf.contents))
        dest_parsed = json.loads(dest_contents)
        is_same = json_matches(source_parsed, dest_parsed)

        # TODO: Implement JSON native overwrites
        # Currently the writer will overwrite the dest json file with the source file (which contains wildcards...), so we just say this is unsupported
        if not is_same and contains_wildcards:
            raise Problem(scf.source_path, f"Source JSON file contains wildcards and does not match. This must be manually fixed - {scf.source_path}")

    elif scf.extension in TEXT_EXTENSIONS:
        is_same, contains_wildcard = text_matches(scf.contents.splitlines(), dest_contents.splitlines())

        # TODO: Native overwrites?? Is this even worth implementing for the number file types????
        # A (non-dropped) wildcard line means we don't have a real value to write in its place, so an actual mismatch elsewhere can't be auto-fixed
        if not is_same and contains_wildcard:
            raise Problem(scf.source_path, f"Source text file contains a wildcard line and does not match destination. This must be manually fixed - {scf.source_path}")
        
        # We show what we'll overwrite with, which is the result of this function
        source_display_contents = drop_wildcard_lines(source_display_contents)

    else:
        # Binary comparison, check for byte-exact equality
        is_same = dest_contents == scf.contents

    if is_same:
        return True, None
    # Files are different
    if is_binary:  # We can't (easily) show a (useful) diff for binary
        return False, [f"{DIFF_NOTE}Binary files {scf.dest_path} ({len(dest_contents)} bytes) and {scf.source_path} ({len(scf.contents)} bytes) differ{RESET}"]
    if dest_contents.rstrip() == source_display_contents.rstrip():
        return False, [f"{DIFF_NOTE}Files have differing trailing whitespace{RESET}"] 

    return False, line_diff(dest_contents.splitlines(), source_display_contents.splitlines(), scf.dest_path, scf.source_path)  # TODO: Proper JSON diff for json files


def checker(scf):
    """
    User-interactable check function. Raises AlreadyUpToDate if the destination already matches.
    """
    dest_exists = os.path.exists(scf.dest_path)
    matches, diff = compare(scf)
    if matches:
        print(f"{PATH_COL}{scf.source_path}{RESET} matches {PATH_COL}{scf.dest_path}{RESET}")
        raise AlreadyUpToDate(scf.source_path, scf.dest_path)

    if diff is not None:
        print(f"Diff for {PATH_COL}{scf.dest_path}{RESET}:")
        print("\n".join(diff))
    if not scf.has_marker:
        print(
            f"Warning: no marker will be applied to {PATH_COL}{scf.dest_path}{RESET} - "
            "future runs won't be able to recognise this file as managed"
        )

    accept, verb = ("r", "replaced") if dest_exists else ("c", "copied")
    prompt = (
        f"{PATH_COL}{scf.source_path}{RESET} "
        f"{'does not match' if dest_exists else 'not found at'} "
        f"{PATH_COL}{scf.dest_path}{RESET}, should it be {verb}[{accept}] or ignored[i]? "
    )
    while True:
        action = input(prompt)
        if action == accept:
            return
        if action == "i":
            raise Skipped(scf.source_path, scf.dest_path)
        print(f"Invalid option, expected {accept} or i")
