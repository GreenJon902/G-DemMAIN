import json
import os

from colors import PATH_COL, RESET
from diffing import json_matches, line_diff, substitute_wildcards
from exceptions import AlreadyUpToDate, Skipped, Problem


def _read_dest_if_exists(dest_path):
    if not os.path.exists(dest_path):
        return None
    with open(dest_path, "r") as f:
        return f.read()


def compare(scf):
    """
    Compares the source and destination file - a nested JSON comparison for "json", a simple
    text comparison for every other extension.
    Returns (is_same, diff). If is_same is true then diff is always None. Otherwise, if diff is
    None then the destination file does not exist.
    """
    dest_contents = _read_dest_if_exists(scf.dest_path)
    if dest_contents is None:
        # TODO: Implement JSON native overwrites
        # Currently the writer will overwrite the dest json file with the source file (which contains wildcards...), so we just say this is unsupported
        if contains_wildcards:
            raise Problem(scf.source_path, f"Source JSON file contains wildcards and destination file does not exist. This must be manually fixed - {scf.source_path}")
        return False, None

    if scf.extension == "json":
        source_parsed, contains_wildcards = substitute_wildcards(json.loads(scf.contents))
        dest_parsed = json.loads(dest_contents)
        is_same = json_matches(source_parsed, dest_parsed)
        
        # TODO: Implement JSON native overwrites
        # Currently the writer will overwrite the dest json file with the source file (which contains wildcards...), so we just say this is unsupported
        if not is_same and contains_wildcards:
            raise Problem(scf.source_path, f"Source JSON file contains wildcards and does not match. This must be manually fixed - {scf.source_path}")
    else:
        is_same = dest_contents == scf.contents

    if is_same:
        return True, None
    return False, line_diff(dest_contents.splitlines(), scf.contents.splitlines(), scf.dest_path, scf.source_path)  # TODO: Proper JSON diff for json files


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
