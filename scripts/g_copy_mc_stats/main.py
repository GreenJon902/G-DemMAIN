"""
Takes a weekly snapshot of the Minecraft server's per-player stats files into a new timestamped folder.

To avoid storing large amounts of byte-identical data for players who rarely change, a run of
snapshots where a player's file is unchanged is collapsed down to just its first and last
occurrence: every snapshot still gets a full copy of the current file (so each snapshot folder
stays a complete, self-contained view), but the *previous* snapshot's copy is deleted once it's
confirmed to have also been unchanged from the one before that.
"""

import json
import os
import shutil
from datetime import datetime

from libs.config import readConfig, resolvePath


def list_stat_files(folder):
    """ Returns the sorted list of <uuid>.json filenames directly inside folder. """
    return sorted(entry for entry in os.listdir(folder) if os.path.isfile(os.path.join(folder, entry)))


def list_snapshot_folders(dest_path):
    """ Returns the sorted (oldest first) list of existing timestamp-named snapshot folder names in dest_path. """
    if not os.path.isdir(dest_path):
        return []
    return sorted(entry for entry in os.listdir(dest_path) if os.path.isdir(os.path.join(dest_path, entry)))


def load_json(path):
    """ Parses path as JSON. """
    with open(path, "r") as f:
        return json.load(f)


def find_previous_containing(dest_path, folders, before_folder, filename):
    """
    Walks folders (oldest to newest) backwards from just before before_folder, returning the
    name of the nearest one that also contains filename - or None if none do.
    """
    index = folders.index(before_folder)
    for folder in reversed(folders[:index]):
        if os.path.exists(os.path.join(dest_path, folder, filename)):
            return folder
    return None


def main():
    """ Snapshots source_path into a new timestamped folder under dest_path, per the module docstring. """
    source_path = resolvePath(readConfig("g_copy_mc_stats/config.json", str, "source_path"))
    dest_path = resolvePath(readConfig("g_copy_mc_stats/config.json", str, "dest_path"))

    filenames = list_stat_files(source_path)
    if not filenames:
        print(f"g_copy_mc_stats: nothing found under {source_path}, skipping")
        return

    folders = list_snapshot_folders(dest_path)
    newest_folder = folders[-1] if folders else None

    new_folder_name = datetime.now().strftime("%Y-%m-%d-%H-%M-%S")  # We don't necessarily need time, however the snapshot rate may be increased in the future
    new_folder_path = os.path.join(dest_path, new_folder_name)
    if os.path.exists(new_folder_path):
        raise Exception(f"Can't copy to an already existing path {new_folder_path}")
    os.makedirs(new_folder_path)

    # Folders a file was pruned from this run - checked for emptiness once we're done
    touched_folders = set()

    new_count, changed_count, unchanged_count, pruned_count = 0, 0, 0, 0
    for filename in filenames:
        source_file = os.path.join(source_path, filename)
        newest_file = os.path.join(dest_path, newest_folder, filename) if newest_folder else None
        newest_file_exists = newest_file is not None and os.path.exists(newest_file)

        # Copy the stats file to todays folder
        shutil.copy2(source_file, os.path.join(new_folder_path, filename))
        
        # Figure out if stats have changed, and if collapsing needs to be done
        if not newest_file_exists:
            new_count += 1
        elif load_json(source_file) != load_json(newest_file):
            changed_count += 1
        else:
            unchanged_count += 1
            # Check if the second newest file for this player needs pruning
            previous_folder = find_previous_containing(dest_path, folders, newest_folder, filename)
            if previous_folder is not None:
                previous_file = os.path.join(dest_path, previous_folder, filename)
                if load_json(newest_file) == load_json(previous_file):
                    os.remove(newest_file)
                    touched_folders.add(newest_folder)
                    pruned_count += 1

    # A folders where no players' stats changed may now be entierly empty, so folder itself can be dropped
    for folder in touched_folders:
        folder_path = os.path.join(dest_path, folder)
        if not os.listdir(folder_path):
            os.rmdir(folder_path)

    print(f"g_copy_mc_stats: snapshotted {len(filenames)} file(s) into {new_folder_path} "
          f"({new_count} new, {changed_count} changed, {unchanged_count} unchanged, {pruned_count} pruned from {newest_folder})")


if __name__ == "__main__":
    main()
