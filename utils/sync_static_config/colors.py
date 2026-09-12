import sys

# If we are in a terminal then colors probably work
RESET = "\033[0m" if sys.stdout.isatty() else ""
PATH_COL = "\033[94m" if sys.stdout.isatty() else ""
WARNING = "\033[0;31m" if sys.stdout.isatty() else ""
UNIMPORTANT = "\033[38;5;240m" if sys.stdout.isatty() else ""
DIFF_NOTE = "\033[3m" if sys.stdout.isatty() else ""  # A diff cannot be shown, so show a note instead

# git-style diff colouring
DIFF_ADD_COL = "\033[32m" if sys.stdout.isatty() else ""
DIFF_REMOVE_COL = "\033[31m" if sys.stdout.isatty() else ""
DIFF_HUNK_COL = "\033[36m" if sys.stdout.isatty() else ""

# Marks output from a subprocess call rather than python
SUBPROC_COL = "\033[38;5;240m" if sys.stdout.isatty() else ""

# Marks a file's old contents, printed (see StaticConfigFile.print_old) right before it's overwritten
OLD_CONTENTS_COL = "\033[38;5;250m" if sys.stdout.isatty() else ""
