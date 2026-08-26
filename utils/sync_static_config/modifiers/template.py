import os
import re

from constants import BINARY_EXTENSIONS
from exceptions import ModifierUnsupportedForExtension

TEMPLATE_ITEM_PATTERN = r"\$\{([a-zA-Z_-]+)/([a-zA-Z_-]+)\}"
ENVVAR_PATTERN = r"^{VAR_NAME}=(.*)$"
ENVVAR_PATTERN_FLAGS = re.MULTILINE

# Prepended (underneath the marker, since template's before-func runs before handle_marker's)
# for every templated file - matches the note the old script added.
TEMPLATE_NOTE = "# This file was populated with environment variables."


def build_template_funcs(environ_dir, vprint):
    """
    Builds TEMPLATE_FUNCS bound to a specific --environ directory (and verbose-print
    function), since template substitution needs to know where to read env values from.
    These are un-supported for binary-files.
    """

    def substitute(scf):
        if scf.extension in BINARY_EXTENSIONS:
            raise ModifierUnsupportedForExtension(scf.source_path, scf.extension, "template")

        def sub(match):
            file, var = match.groups()
            pattern = ENVVAR_PATTERN.replace("{VAR_NAME}", var)
            with open(os.path.join(environ_dir, file + ".env"), "r") as f:
                env_contents = f.read()
            found = re.search(pattern, env_contents, ENVVAR_PATTERN_FLAGS)
            assert found is not None, f"Could not find {var} in {file} using {pattern!r}"
            value = found.group(1)
            vprint(f"Substituting {var} with {value!r}")
            return value

        scf.contents = TEMPLATE_NOTE + "\n" + re.sub(TEMPLATE_ITEM_PATTERN, sub, scf.contents)

    def nop(scf):
        pass

    # Before/after/test_prep - test_prep is identical to before, this modifier is already pure.
    return [substitute, nop, substitute]
