"""
Checks whether an update is available for the JDK (any openjdk-* package) that g_mc runs on.
Sends a webhook ("checkmc jdk") listing the upgradable packages when there are any; otherwise does nothing.
This repeats every run until the JDK is upgraded, as the JDK is blacklisted from unattended-upgrades (see config/prod/apt).

NOTE: This only knows about updates apt already knows about, so it lags behind by up to the time between apt lists refreshes (apt-daily.timer).
"""

import json
import os
import re
import subprocess
import sys

from libs.config import ROOT

WEBHOOKS_FILE = os.path.join(ROOT, "scripts", "webhooks.py")

# Matches a line of `apt-get -s upgrade` like: Inst openjdk-21-jre-headless [21.0.1+12-1] (21.0.2+13-1 Debian-Security:stable-security [amd64])
RE_INST = re.compile(r"^Inst (?P<package>openjdk-\S+) \[(?P<installed>[^\]]+)\] \((?P<candidate>\S+)", re.MULTILINE)


def list_upgradable_jdk_packages():
    """ Returns a list of {"package", "installed", "candidate"} dicts, one per upgradable openjdk-* package. """
    # apt-get -s only simulates (needs no root), and unlike `apt list` its output is stable for scripts
    result = subprocess.run(
        ["apt-get", "-s", "upgrade"],
        check=True,  # Raises an error if apt-get fails
        capture_output=True,
        text=True,
        env={**os.environ, "LC_ALL": "C"},  # Make sure the output is not translated
    )
    return [m.groupdict() for m in RE_INST.finditer(result.stdout)]


def run():
    """ Runs the JDK update check, sending a webhook if an update is available. """
    packages = list_upgradable_jdk_packages()

    if packages:
        print(f"g_check_mc jdk check found {len(packages)} upgradable package(s)")
        for p in packages:
            print(f"{p['package']}: {p['installed']} -> {p['candidate']}")
        subprocess.run(
            [sys.executable, WEBHOOKS_FILE, "checkmc", "jdk", json.dumps(packages)],
            check=True,  # Check raises an error if webhooks.py crashes
        )
    else:
        print("g_check_mc jdk check: no JDK updates available")
