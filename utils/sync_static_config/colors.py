import sys

# If we are in a terminal then colors probably work
RESET = "\033[0m" if sys.stdout.isatty() else ""
PATH_COL = "\033[94m" if sys.stdout.isatty() else ""

# git-style diff colouring
DIFF_ADD_COL = "\033[32m" if sys.stdout.isatty() else ""
DIFF_REMOVE_COL = "\033[31m" if sys.stdout.isatty() else ""
DIFF_HUNK_COL = "\033[36m" if sys.stdout.isatty() else ""
