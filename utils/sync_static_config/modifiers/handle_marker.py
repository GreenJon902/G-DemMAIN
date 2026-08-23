import json
import os

from constants import HEADER_LINE, JSON_MARKER_KEY, TEXT_EXTENSIONS
from exceptions import DestinationMissingMarker, MarkerExistsInSource


def _text_has_marker(contents):
    return contents.split("\n", 1)[0] == HEADER_LINE


def _json_has_marker(contents):
    try:
        parsed = json.loads(contents)
    except ValueError:
        return False
    return isinstance(parsed, dict) and JSON_MARKER_KEY in parsed


# One marker-presence check per supported extension - shared between this modifier's own
# destination check (below) and the post-write orphan scan in main.py.
MARKER_CHECKERS = {"json": _json_has_marker}
MARKER_CHECKERS.update({ext: _text_has_marker for ext in TEXT_EXTENSIONS})


def _read_dest_if_exists(dest_path):
    if not os.path.exists(dest_path):
        return None
    with open(dest_path, "r") as f:
        return f.read()


def _add_marker_and_find_problem(scf):
    """
    Adds the marker to scf.contents, and returns a Problem instance describing why the
    destination doesn't have one (or None), instead of raising it - shared by the before-func
    (which raises) and the test_prep-func (which returns).
    """
    dest_contents = _read_dest_if_exists(scf.dest_path)

    if scf.extension == "json":
        parsed = json.loads(scf.contents)
        if JSON_MARKER_KEY in parsed:
            problem = MarkerExistsInSource(scf.source_path)
        elif dest_contents is not None and not _json_has_marker(dest_contents):
            problem = DestinationMissingMarker(scf.source_path, scf.dest_path)
        else:
            problem = None
        parsed[JSON_MARKER_KEY] = HEADER_LINE
        scf.contents = json.dumps(parsed, indent=2)

    
    else:
        if dest_contents is not None and not _text_has_marker(dest_contents):
            problem = DestinationMissingMarker(scf.source_path, scf.dest_path)
        else:
            problem = None
        scf.contents = HEADER_LINE + "\n" + scf.contents

    return problem


def _before(scf):
    problem = _add_marker_and_find_problem(scf)
    if problem is not None:
        raise problem


def _nop(scf):
    pass


def _test_prep(scf):
    return _add_marker_and_find_problem(scf)


# Before/after/test_prep
HANDLE_MARKER_FUNCS = [_before, _nop, _test_prep]
