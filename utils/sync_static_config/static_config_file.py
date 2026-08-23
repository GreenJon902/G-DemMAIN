import os

from constants import SUPPORTED_EXTENSIONS
from exceptions import UnsupportedExtension
from filename_parsing import parse_filename


class StaticConfigFile:
    """
    One file moving through the modifier chain from source to destination. Mutated in place
    by each modifier/checker/writer it's passed to.
    dest_path and has_marker are properties rather than plain fields: once lock_dest() has been
    called (by account_for_path, right after paths_accounted_for records this file's
    destination), both setters raise. That turns a modifier-ordering mistake - something trying
    to change either after the path's already been accounted for - into an immediate error
    instead of a silently wrong paths_accounted_for / orphan scan.
    """

    def __init__(self, contents, source_path, dest_path, extension, has_marker):
        self.contents = contents
        self.source_path = source_path
        self.extension = extension
        self._dest_path = dest_path
        self._has_marker = has_marker
        self._dest_locked = False

    @property
    def dest_path(self):
        return self._dest_path

    @dest_path.setter
    def dest_path(self, value):
        assert not self._dest_locked, "dest_path is locked after accounting"
        self._dest_path = value

    @property
    def has_marker(self):
        return self._has_marker

    @has_marker.setter
    def has_marker(self, value):
        assert not self._dest_locked, "has_marker is locked after accounting"
        self._has_marker = value

    def lock_dest(self):
        self._dest_locked = True


def build_scf(source_file, source_folder, destination_folder):
    """
    Parses a source file's flags/extension and constructs its StaticConfigFile, along with
    the flags that drive its modifier chain. Raises MalformedSyncFilename/UnsupportedExtension
    for a file the tool doesn't know how to handle.
    Flags are returned in FLAG_ORDER.
    """
    relpath = os.path.relpath(source_file, source_folder)
    reldir, filename = os.path.split(relpath)
    base_name, flags, extension = parse_filename(filename)
    if extension not in SUPPORTED_EXTENSIONS:
        raise UnsupportedExtension(source_file, extension)

    dest_relpath = os.path.join(reldir, f"{base_name}.{extension}") if reldir else f"{base_name}.{extension}"
    dest_path = os.path.join(destination_folder, dest_relpath)

    with open(source_file, "r") as f:
        contents = f.read()

    return StaticConfigFile(
        contents=contents,
        source_path=source_file,
        dest_path=dest_path,
        extension=extension,
        has_marker="omit_marker" not in flags,
    ), flags
