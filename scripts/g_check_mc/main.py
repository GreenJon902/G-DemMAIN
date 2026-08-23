"""
Routinely (triggered by systemd timer) checks the config files for the minecraft server to ensure they have not drifted from the config source.
Sends a webhook ("checkmc") listing problems and failed files when anything doesn't match; otherwise does nothing.

NOTE: Templated (.template) source files are not supported yet.
"""

import json
import os
import subprocess
import sys

from libs.config import ROOT, readConfig, resolvePath

# TODO: Find another solution to replace having to modify path
# utils/sync_static_config uses flat imports between its own files (see its main.py), so it needs its own directory on sys.path too
sys.path.insert(0, os.path.join(ROOT, "utils", "sync_static_config"))
import modifiers
from checkers import compare
from exceptions import Problem
from modifiers import flags_to_modifiers
from static_config_file import build_scf

WEBHOOKS_FILE = os.path.join(ROOT, "scripts", "webhooks.py")

# environ_dir is never actually read - template files are excluded before any test_prep hook runs (see module docstring)
# Use print as vprint as more info is better than less if I have to debug a historic run of this
MODIFIER_FUNCS = modifiers.build_funcs(None, print)


def list_source_files(folder):
    """ Yields every file path under folder, recursively. """
    for (root, dirs, files) in os.walk(folder):
        for file in files:
            yield os.path.join(root, file)


def check_file(source_file, source_folder, destination_folder):
    """
    Checks a single source file against its expected destination, without writing or prompting.
    Returns (dest_path, problem_messages, diff) - problem_messages is a list (possibly empty), and
    diff is None whenever there's nothing meaningful to show (a match, or the destination file is
    simply missing rather than differing).
    """
    scf, flags = build_scf(source_file, source_folder, destination_folder)

    problem_messages = []
    for mod in flags_to_modifiers(flags):
        if mod == "template":
            problem_messages.append(f"Templated files are not supported by g_check_mc yet - \"{source_file}\"")
            continue
        result = MODIFIER_FUNCS["test_prep"][mod](scf)
        if result is not None:
            problem_messages.append(result.message)

    matches, diff = compare(scf)
    if not matches and diff is None:
        problem_messages.append(f"Missing from destination - \"{scf.dest_path}\"")

    return scf.dest_path, problem_messages, diff


def main():
    source_path = resolvePath(readConfig("g_check_mc/config.json", str, "source_path"))
    dest_path = resolvePath(readConfig("g_check_mc/config.json", str, "dest_path"))

    problems, failed_files = [], []
    for source_file in list_source_files(source_path):
        try:
            dest_file, problem_messages, diff = check_file(source_file, source_path, dest_path)
        except Problem as p:
            problems.append(p.message)
            failed_files.append(source_file)
            continue

        if problem_messages or diff is not None:
            problems.extend(problem_messages)
            failed_files.append(dest_file)
            if diff is not None:
                print(f"Diff for {dest_file}:")
                print("\n".join(diff))

    if problems or failed_files:
        print(f"g_check_mc found {len(problems)} problem(s) across {len(failed_files)} failed file(s)")
        for problem in problems:
            print(problem)
        subprocess.run(
            [sys.executable, WEBHOOKS_FILE, "checkmc", source_path, dest_path, json.dumps(problems), json.dumps(failed_files)],
            check=True,  # Check raises an error if webhooks.py crashes
        )
    else:
        print(f"g_check_mc: everything under {source_path} matches {dest_path}")


if __name__ == "__main__":
    main()
