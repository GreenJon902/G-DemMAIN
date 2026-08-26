# Marker embedded in every file this tool manages - as the first line for text files, or as the
# G_MARKER field for JSON files. This is the exact string previously used as sync-static-config.py's
# HEADER_LINE - do not change it without considering every already-synced file, since a changed
# marker would look identical to "no marker" to files synced by an older version of this tool.
HEADER_LINE = "# This is a G-DemMAIN synced config file, and may be overwritten when sync is run. Please do not modify this line, and leave it as the first line of this file."

JSON_MARKER_KEY = "G_MARKER"

# Source JSON may use this literal string as a field's value to mean "match anything here". It
# gets substituted for the sentinel object below before comparison (see diffing.py).
JSON_WILDCARD_TOKEN = "*wildcard*"  # TODO: Do we still need the sentinel object because the source json is json complient with the current impl?

JSON_WILDCARD_SENTINEL = {"thiscanbeanything": "ignoreme123123"}

# Whole-line wildcard tokens for text files - see diffing.py's text_matches/drop_wildcard_lines
# and doc/Config Sync.md for the exact rules.
TEXT_WILDCARD_TOKEN = "*wildcard*"
TEXT_WILDCARD_DROP_TOKEN = "*wildcard-drop*"
TEXT_COMMENT_PREFIX = "#"

# Filename flag tokens, in the fixed order they must appear in a source filename:
# <filename>[.drop_ext][.template][.omit_marker][.validate_sudoers].<extension>
#
# This is the same order that modifiers are applied (handle_marker applied where omit_marker is)
FLAG_ORDER = ["drop_ext", "template", "omit_marker", "validate_sudoers"]
MODIFIERS_TOUCHING_DEST_PATH = 1  # The number of modifiers (from the start of flag order) that touch the destination path. It is expected these never throw ANY errors
MODIFIER_ORDER = ["drop_ext", "template", "handle_marker", "validate_sudoers"]  # Index of item corresponds to FLAG_ORDER

# Extensions sharing the plain-text line-diff checker/marker
TEXT_EXTENSIONS = {"conf", "cnf", "txt", "properties", "service", "timer", "sudoers", "toml"}

# Extensions read/written as bytes and compared for exact equality
BINARY_EXTENSIONS = {"png"}

SUPPORTED_EXTENSIONS = {"json", *TEXT_EXTENSIONS, *BINARY_EXTENSIONS}
