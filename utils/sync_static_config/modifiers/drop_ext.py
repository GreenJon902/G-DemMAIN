import os


def _before(scf):
    root, _ext = os.path.splitext(scf.dest_path)
    scf.dest_path = root


def _nop(scf):
    pass


# Before/after/test_prep - test_prep is identical to before, this modifier is already pure.
DROP_EXT_FUNCS = [_before, _nop, _before]
