"""
Routinely (triggered by systemd timer) runs the g_check_mc checks, each of which sends its own webhook ("checkmc") when it finds something:
- check_config.py - checks the minecraft server's config files have not drifted from the config source.
- check_jdk.py - checks whether a JDK update is available (g_mc must be stopped before updating it).

Every check is run even if an earlier one crashes, and the exit code is non-zero if any crashed so that OnFailure still fires.
"""

import sys
import traceback

import check_config
import check_jdk


def main():
    """ Runs every check, exiting non-zero if any of them crashed. """
    failed = []
    for name, check in (("config", check_config.run), ("jdk", check_jdk.run)):
        try:
            check()
        except Exception:
            traceback.print_exc()
            failed.append(name)

    if failed:
        print(f"g_check_mc: check(s) crashed: {', '.join(failed)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
