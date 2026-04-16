from configparser import ConfigParser
from argparse import ArgumentParser
import os
import sys


# Constants
HEADER_LINE = "# This is a G-DemMAIN synced config file, and may be overwritten when sync is run. Please do not modify this line, and leave it as the first line of this file."
DIFF_IND_LENGTH = 50

RESET = "\033[0m" if sys.stdout.isatty() else ""     # If we are in a terminal then colors probably work
PATH_COL = "\033[94m" if sys.stdout.isatty() else ""

# Parse arguments
parser = ArgumentParser(description="See README.md")
parser.add_argument("syncmap",
                    nargs   = "?",  # Declare this argument as optional
                    default = "sync-map.ini",
                    help    = "The path of the config map to use, defaults to ./sync-map.ini")  # The name we refer
parser.add_argument("-d", "--dry-run",
                    action  = "store_true",  # This sets default value to false
                    help    = "Is this a dry run (e.g. if this flag is set then no changes will be made)")
parser.add_argument("-v", "--verbose",
                    action  = "store_true",  # This sets default value to false
                    help    = "If set then we will print a lot more information")
args = parser.parse_args()

# Define verbose printing function
def vprint(*pargs, **pkw):
    if args.verbose:
        print(*pargs, **pkw)

# Log run-info
print("Executing in", os.getcwd())
print("Ran with args", sys.argv, "which parsed to", args)

# Load sync-map
config = ConfigParser()
if not os.path.exists(args.syncmap):
    raise Exception("Sync map file does not exist - " + args.syncmap + " - are you sure you're in the right folder?")
config.read(args.syncmap)
sync_map = dict(config["sync-map"])
print("Loaded map:", sync_map)

# Check source and destination folders exist
for (source, destination) in sync_map.items():
    if not os.path.exists(source):
        raise Exception("Source folder does not exist - " + source)
    if not os.path.exists(destination):
        raise Exception("Destination folder does not exist - " + destination)
    
# Check for any files that we have previously added to the destination folder that should no longer be there
for (source, destination) in sync_map.items():
    for (root, dirs, files) in os.walk(destination):
        for file in files:
            file = os.path.join(root, file)
            
            # If file is a symlink then ignore it
            if os.path.islink(file):
                vprint(f"Ignoring symlink at {PATH_COL}{file}{RESET}")
                continue
            
            # Check if file exists in both source and destination
            relpath = os.path.relpath(file, destination)
            expected_source_path = os.path.join(source, relpath)
            if not os.path.exists(expected_source_path):
                
                # Check if this script created the file (it has the header)
                try:
                    with open(file, "r") as f:
                        header = f.readline(len(HEADER_LINE))
                        if header != HEADER_LINE:
                            vprint(f"Ignoring file with no header at {PATH_COL}{file}{RESET}")
                            continue        
                except UnicodeDecodeError:  # File isn't text so we didn't sync it
                    vprint(f"Ignoring non-text file at {PATH_COL}{file}{RESET}")
                    continue    
                        
                # Handle this file
                while True:
                    action = input(f"{PATH_COL}{file}{RESET} has header, but was not found at {PATH_COL}{expected_source_path}{RESET}. Should this file be deleted[d] or ignored[i]? ")
                    if action == "d":
                        print(f"Removing {PATH_COL}{file}{RESET}")
                        if not args.dry_run:
                            os.remove(file)
                        break
                    elif action == "i":
                        print(f"Ignoring {PATH_COL}{file}{RESET}")
                        break
                    else:
                        print("Invalid option, expected d or i")
                        continue

# Check for any new or changed files
for (source_folder, destination_folder) in sync_map.items():
    for (root, dirs, files) in os.walk(source_folder):
        for source_file_just_name in files:
            
            # Paths
            source_file = os.path.join(root, source_file_just_name)
            relpath = os.path.relpath(source_file, source_folder)
            destination_file = os.path.join(destination_folder, relpath)
            
            # Find (if we need to) what to ask the user
            if not os.path.exists(destination_file):  # If the destination does not exist then ask the user if we want to copy the file
                prompt = f"{PATH_COL}{source_file}{RESET} not found at {PATH_COL}{destination_file}{RESET}, should it be coppied[c] or ignored[i]? "
            else:
                # The destination_file exists
            
                
                destination_fo = open(destination_file, "r")
                if (found_header_line := destination_fo.readline(len(HEADER_LINE))) != HEADER_LINE:  # Check if we created the destination file
                    raise Exception(f"A source file maps to a destination file that we did not create - source: {source_file}, destination: {destination_file}. The first line (partial): {found_header_line}")
                else:
                    # We created the destination file, so compare if their contents are the same
                    
                    # Load files
                    source = open(source_file, "r").read()
                    destination_fo.readline()
                    destination = destination_fo.read()
                    
                    if source != destination:
                        # Don't match so show diff and ask user if we want to replace it
                        print(f"Diff (without header) for {PATH_COL}{source_file_just_name}{RESET}:")
                        
                        # Print files next to eachother with line numbers
                        source = source.split("\n")
                        destination = destination.split("\n")
                        line_count = max(len(source), len(destination))
                        for i in range(line_count):
                            # Pad lines so they are the same length
                            source_line = source[i] if i < len(source) else ""
                            destination_line = destination[i] if i < len(destination) else ""
                            source_line = source_line.ljust(max_line_len := max(len(source_line), len(destination_line), DIFF_IND_LENGTH))
                            destination_line = destination_line.ljust(max_line_len)
                            # Print lines, while splitting them if they're too long
                            first_line = True
                            while source_line != "":
                                end = min(DIFF_IND_LENGTH, len(source_line))
                                line_numb = str(i+1) + "." if first_line else ""  # Only write line_numb on the start of the line
                                print(line_numb.ljust(len(str(line_count)) + 1),  # Pad line_number so all lines are aligned
                                      "  ",
                                      source_line[0:end].ljust(DIFF_IND_LENGTH), 
                                      "  ",
                                      destination_line[0:end].ljust(DIFF_IND_LENGTH))
                                source_line = source_line[end:]
                                destination_line = destination_line[end:]
                                first_line = False
                            
                        
                        

                        prompt = f"{PATH_COL}{source_file}{RESET} does not match {PATH_COL}{destination_file}{RESET}, should it be replaced[r] or ignored[i]? "
                    else: 
                        print(f"{PATH_COL}{source_file}{RESET} matches {PATH_COL}{destination_file}{RESET}")
                        continue  # Source and destination match so go to next file

                
            # Handle the users action
            while True:
                action = input(prompt)
                if action == "c" or action == "r":
                    print(f"Copying {PATH_COL}{source_file}{RESET} (with header) to {PATH_COL}{destination_file}{RESET}")
                    if not args.dry_run:
                        # Create folder if required
                        if not os.path.exists(parent := os.path.dirname(destination_file)):
                            print(f"Making parent folder {PATH_COL}{parent}{RESET}")
                            os.makedirs(parent)
                        # Add header to source file, then write to destination_file
                        open(destination_file, "w").write(HEADER_LINE + "\n" + open(source_file, "r").read())
                    break
                elif action == "i":
                    print(f"Ignoring {PATH_COL}{source_file}{RESET}")
                    break
                else:
                    print("Invalid option, expected d or i")
                    continue

print("Sync complete!")
