import difflib

from colors import DIFF_ADD_COL, DIFF_HUNK_COL, DIFF_REMOVE_COL, RESET
from constants import JSON_WILDCARD_SENTINEL, JSON_WILDCARD_TOKEN


def _colorize_diff_line(line):
    if line.startswith("@@"):
        return f"{DIFF_HUNK_COL}{line}{RESET}"
    if line.startswith("+") and not line.startswith("+++"):
        return f"{DIFF_ADD_COL}{line}{RESET}"
    if line.startswith("-") and not line.startswith("---"):
        return f"{DIFF_REMOVE_COL}{line}{RESET}"
    return line


def line_diff(dest_lines, source_lines, dest_label, source_label):
    """ Git-style unified diff showing what changes if dest_lines is replaced by source_lines. """
    diff = difflib.unified_diff(dest_lines, source_lines, fromfile=dest_label, tofile=source_label, lineterm="")
    return [_colorize_diff_line(line) for line in diff]


def substitute_wildcards(value):
    """
    Recursively replaces every literal JSON_WILDCARD_TOKEN value in a parsed JSON structure
    with the wildcard sentinel object. Source side only - see json_matches for how the
    destination is handled.
    Returns (new_obj, contains_wildcards: bool)
    """
    if value == JSON_WILDCARD_TOKEN:
        return JSON_WILDCARD_SENTINEL, True
    if isinstance(value, dict):
        rec_ret = {key: substitute_wildcards(v) for key, v in value.items()}  # {key: [obj, contains_wildcards]}
        if len(rec_ret) == 0:
            return {}, False
        return {k: v[0] for k, v in rec_ret.items()}, any(x[1] for x in rec_ret.values())
    if isinstance(value, list):
        rec_ret = [substitute_wildcards(v) for v in value]  # [[obj, contains_wildcards], ...]
        if len(rec_ret) == 0:
            return [], False
        unzipped = list(zip(*rec_ret))  # [obj, ...], [contains_wildcards, ...]
        return list(unzipped[0]), any(unzipped[1])

    return value, False
 

def json_matches(source_value, dest_value):
    """
    Recursively compares a (wildcard-substituted) source value against a destination value.
    A wildcarded field still requires its key to be present in the destination, just not any
    particular value - that's enforced by the dict/list branches below rejecting on a
    keys()/length mismatch *before* ever recursing into a value, so by the time a wildcard
    sentinel is checked here, its key's presence in the destination is already guaranteed.
    """
    if source_value == JSON_WILDCARD_SENTINEL:
        return True

    if isinstance(source_value, dict) and isinstance(dest_value, dict):
        if source_value.keys() != dest_value.keys():
            print(source_value, dest_value)
            return False
        return all(json_matches(source_value[key], dest_value[key]) for key in source_value)

    if isinstance(source_value, list) and isinstance(dest_value, list):
        if len(source_value) != len(dest_value):
            print(source_value, dest_value)
            return False
        return all(json_matches(sv, dv) for sv, dv in zip(source_value, dest_value))

    print(source_value == dest_value, source_value, dest_value)
    return source_value == dest_value
