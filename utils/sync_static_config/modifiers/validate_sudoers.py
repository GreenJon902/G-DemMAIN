import os
import subprocess

from colors import RESET, SUBPROC_COL
from exceptions import Problem, Skipped


def _sudoers_is_valid():
    """
    Checks if the syntax of the currently-installed sudoers file is correct. visudo's own
    stdout/stderr is piped straight through to ours, coloured so it's visually distinct from our
    own output.
    """
    
    print("Sudoers output: ---", SUBPROC_COL, flush=True)  # Following text (the subproc call) is grey
    proc = subprocess.run(["/usr/sbin/visudo", "-c"])
    print(RESET, "---", flush=True)  # Reset so next printed isn't also grey
    return proc.returncode == 0


def _before(scf):
    if _sudoers_is_valid():
        print("Initial sudoers correctly formatted")
    else:
        print("Sudoers check failed")

    # Print the old file as the only backup taken - the caller must capture this output
    # themselves (e.g. by redirecting this script's output) if they want to restore it later.
    if os.path.exists(scf.dest_path):
        print("OLD SUDOERS FILE ----")
        with open(scf.dest_path, "r") as f:
            print(f.read())
        print("---------------------")
    else:
        print("Old sudoers file does not exist!")


def _after(scf):
    if _sudoers_is_valid():
        print("Sudoers is formatted correctly")
    else:
        raise Problem(
            scf.source_path,
            f"Sudoers is not formatted correctly after write - strongly recommended you roll back or remove {scf.dest_path}",
        )


def _test_prep(scf):
    if _sudoers_is_valid():
        return None
    return Problem(scf.source_path, "Sudoers check failed (visudo -c) before any change was made")


VALIDATE_SUDOERS_FUNCS = [_before, _after, _test_prep]
