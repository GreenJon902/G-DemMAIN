from modifiers.drop_ext import DROP_EXT_FUNCS
from modifiers.handle_marker import HANDLE_MARKER_FUNCS
from modifiers.template import build_template_funcs
from modifiers.validate_sudoers import VALIDATE_SUDOERS_FUNCS


def build_funcs(environ_dir, vprint):
    """
    This functions is the central location to get the all the modifier hooks.
    This generalises away which modifiers require data from environ_dir and vprint and which
    don't (as these are dependant on args which is only accessible in main).
    """
    TEMPLATE_FUNCS = build_template_funcs(environ_dir, vprint)
    # handle_marker's funcs are identical for every extension - the branch on scf.extension is
    # internal to the functions themselves - so any entry in HANDLE_MARKER_FUNCS works here.
    HANDLE_MARKER = HANDLE_MARKER_FUNCS

    return {
        "before": {
            "template": TEMPLATE_FUNCS[0],
            "handle_marker": HANDLE_MARKER[0],
            "validate_sudoers": VALIDATE_SUDOERS_FUNCS[0],
            "drop_ext": DROP_EXT_FUNCS[0],
        },
        "after": {
            "template": TEMPLATE_FUNCS[1],
            "handle_marker": HANDLE_MARKER[1],
            "validate_sudoers": VALIDATE_SUDOERS_FUNCS[1],
            "drop_ext": DROP_EXT_FUNCS[1],
        },
        "test_prep": {
            "template": TEMPLATE_FUNCS[2],
            "handle_marker": HANDLE_MARKER[2],
            "validate_sudoers": VALIDATE_SUDOERS_FUNCS[2],
            "drop_ext": DROP_EXT_FUNCS[2],
        },
    }


def flags_to_modifiers(flags):
    """
    Converts a list of flag names to a list of modifier names.        
    Expects all flags to be valid.
    Returned list is in FLAG_ORDER.
    """
    return [
        *(["drop_ext"] if "drop_ext" in flags else []),
        *(["template"] if "template" in flags else []),
        *([] if "omit_marker" in flags else ["handle_marker"]),
        *(["validate_sudoers"] if "validate_sudoers" in flags else [])
    ]
    
        
    
