import subprocess

from colors import RESET, SUBPROC_COL
from exceptions import Problem


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

    # It might be important to easily roll-back this file. So let the user know its contents if it may be changed
    scf.print_old = True


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
