from constants import FLAG_ORDER


class MalformedSyncFilename(Exception):
    """ A source filename's flag tokens don't match the supported set/order. """


def parse_filename(filename):
    """
    Splits a source filename like "name.drop_ext.validate_sudoers.sudoers" into
    (base_name, flags, extension). Flag tokens must be drawn from FLAG_ORDER and appear in that
    fixed order - anything else raises MalformedSyncFilename.
    Flags are returned in FLAG_ORDER.
    """
    segments = filename.split(".")
    if len(segments) < 2:
        raise MalformedSyncFilename(f'"{filename}" has no extension')
    base_name, *middle, extension = segments
    recognised = [flag for flag in FLAG_ORDER if flag in middle]
    if recognised != middle:
        raise MalformedSyncFilename(
            f'"{filename}" has unrecognised or out-of-order flags {middle!r} - expected a subset of {FLAG_ORDER!r} in that order'
        )
    return base_name, set(middle), extension
