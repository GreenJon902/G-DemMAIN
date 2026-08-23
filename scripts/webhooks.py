# WIP for sending updates to a discord channel via webhooks

import requests
import os
import json
from argparse import ArgumentParser

from libs.config import readEnviron, ConfigError

# Functions
def generate_status(name, service_name, status, service_result, exit_code, exit_status, invocation_id):
    # Generate the json for a message about the status of the server changing.
    # Name should be human-readable - e.g. Minecraft - and service_name should be the service_name - e.g. g_mc.
    # Status should be one of "starting", "stopped", "crashed".
    # The other variables should be strings or None
    
    status_emoji = {
        "starting": "green_circle",
        "stopped": "orange_circle",
        "crashed": "red_circle"
    }[status]
    color = {
        "starting": 5685341,
        "stopped": 16747271,
        "crashed": 16121919
    }[status]
    note = "(You should also see a \"Server Stopped\" message along with this one, they refer to the same event.)\n\n" if status == "crashed" else ""
    service_result = f"service_result: {service_result}\n" if service_result is not None else ""
    exit_code = f"exit_code: {exit_code}\n" if exit_code is not None else ""
    exit_status = f"exit_status: {exit_status}\n" if exit_status is not None else ""
    invocation_id = f"invocation_id: {invocation_id}\n" if invocation_id is not None else ""
    
    return {
            "username": "G-DemMAIN",
            "embeds": [{
                "title": f":{status_emoji}: {name} {status.title()} :{status_emoji}:",
                "description": "".join([note, f"service: {service_name}\n", service_result, exit_code, exit_status, invocation_id]),
                "color": color
                }]
    }

WEBCOLOR = 4363765
def generate_weblogin(name):
    # Generate the json for a message about someone logging into the website.
    # Name should be the username of the user.
    return {
            "username": "G-DemMAIN - G-Web",
            "embeds": [{
                "title": f"'{name}' logged in",
                "color": WEBCOLOR
                }]
    }
def generate_webcommand(name, command):
    # Generate the json for a message about someone sending a minecraft command from the panel-console.
    # Name should be the username of the user who sent the command.
    # Command should be the command that was sent, this should not start with a slash.
    return {
            "username": "G-DemMAIN - G-Web",
            "embeds": [{
                "title": f"'{name}' sent a command",
                "description": f"`/{command}`",  # TODO: Escape this
                "color": WEBCOLOR
                }]
    }

def generate_hisdoc(entity_type, action, entity_id, entity_name, actor_id, actor_name, note):
    # Generate the json for a message about a hisdoc entity being added, edited or deleted.
    # entity_type should be one of "event", "person", "tag"; action one of "add", "edit", "delete".
    # entity_name should be human-readable (event/tag name, person display name).
    # note is the changelog message for the change.
    emoji = {
        "add": "heavy_plus_sign",
        "edit": "pencil2",
        "delete": "wastebasket"
    }[action]
    verb = {
        "add": "added",
        "edit": "edited",
        "delete": "deleted"
    }[action]
    return {
            "username": "G-DemMAIN - G-Web",
            "embeds": [{
                "title": f":{emoji}: {entity_type.title()} {verb} — {entity_name} (#{entity_id})",  # TODO: Escape this
                "fields": [
                    {"name": "By", "value": f"{actor_name} (#{actor_id})", "inline": True},
                    {"name": "Note", "value": note, "inline": True}
                ],
                "color": WEBCOLOR
                }]
    }

SYSWARNCOLOR = 16753920
def generate_syswarn(resource, used_fraction, threshold_fraction):
    # Generate the json for a message about system RAM or a drive running low on space.
    # resource should be human-readable, e.g. "RAM" or "Disk (/)".
    # used_fraction and threshold_fraction are fractions in [0, 1].
    return {
            "username": "G-DemMAIN",
            "embeds": [{
                "title": f":warning: {resource} usage high :warning:",
                "description": f"Currently at {used_fraction:.1%}, threshold is {threshold_fraction:.1%}",
                "color": SYSWARNCOLOR
                }]
    }

CHECKMCCOLOR = 16753920
def generate_checkmc(source_path, dest_path, problems, failed_files):
    # Generate the json for a message about g_check_mc finding source_path and dest_path out of sync.
    # problems and failed_files are lists of human-readable strings.
    problems_text = "\n".join([f"- {p}" for p in problems[:6]]) if problems else "(None)"
    failed_files_text = "\n".join([f"- {f}" for f in failed_files]) if failed_files else "(None)"
    
    # Webhook JSON can be at most 2000 chars long, so crop if need be
    if len(problems_text) > 700:
        problems_text = problems_text[:697] + "..."
    if len(failed_files_text) > 700:
        failed_files_text = failed_files_text[:697] + "..."

    return {
            "username": "G-DemMAIN",
            "embeds": [{
                "title": ":warning: g_check_mc found a discrepancy :warning:",
                "description": f"Active config (`{dest_path}`) has drifted from source (`{source_path}`).\nHave you re-configured something without commiting the changes to the repo?\n\nOtherwise this could be a tracking bug..",
                "fields": [
                    {"name": "Errors", "value": problems_text, "inline": False},
                    {"name": "Failed files", "value": failed_files_text, "inline": False}
                ],
                "color": CHECKMCCOLOR
                }]
    }

def generate_test(intended_recipient):
    # Content for a testing webhook.
    return {"username": "G-DemMAIN",
            "content": f"Test success? :thinking:\nThis should be the webhook for {intended_recipient}!"}
    
def send(webhook, json):
    # Send the given json to the given webhook
    response = requests.post(webhook, json=json)
    print(f"Sent webhook, got {response.status_code} {response.content}")


# Get webhooks
# We load these late (lambdas) so that we can test the file even if we don't have all webhooks installed
webhook_getters = {
    "STATUS": lambda: readEnviron("STATUS_WEBHOOK", str),
    "WEBLOGIN": lambda: readEnviron("WEBLOGIN_WEBHOOK", str),
    "WEBCOMMAND": lambda: readEnviron("WEBCOMMAND_WEBHOOK", str),
    "HISDOC": lambda: readEnviron("HISDOC_WEBHOOK", str),
    "SYSWARN": lambda: readEnviron("SYSWARN_WEBHOOK", str),
    "CHECKMC": lambda: readEnviron("CHECK_MC_WEBHOOK", str)
}

# Parse arguments
parser = ArgumentParser(description="Send messages to the discord using webhooks")
subparsers = parser.add_subparsers(help="Action", required=True, dest="action")
status_parser = subparsers.add_parser("status", help="Send a service status update")
status_parser.add_argument("name", help="The name of what this update pertains to, e.g. Minecraft")
status_parser.add_argument("service", help="The name of the service this update pertains to, e.g. g_mc")
status_parser.add_argument("status", choices=["starting", "stopped", "crashed"], help="What actually happened")
weblogin_parser = subparsers.add_parser("weblogin", help="Send a notification that someone logged into the website")
weblogin_parser.add_argument("name", help="The username of the user that logged in")
webcommand_parser = subparsers.add_parser("webcommand", help="Send a notification that on the panel sent a command")
webcommand_parser.add_argument("name", help="The username of the user that sent the command")
webcommand_parser.add_argument("command", help="The command that was sent, without the prefix (/)")
hisdoc_parser = subparsers.add_parser("hisdoc", help="Send a notification that a hisdoc entity was added, edited or deleted")
hisdoc_parser.add_argument("entity_type", choices=["event", "person", "tag"], help="Which kind of hisdoc entity was changed")
hisdoc_parser.add_argument("hisdoc_action", choices=["add", "edit", "delete"], help="What was done to the entity")  # Must call it 'hisdoc_action' as 'action' is used for `subparsers` object
hisdoc_parser.add_argument("entity_id", help="The entity's database id")
hisdoc_parser.add_argument("entity_name", help="Human-readable name for the entity (event/tag name, person display name)")
hisdoc_parser.add_argument("actor_id", help="The database id of the user who made the change")
hisdoc_parser.add_argument("actor_username", help="The username of the user who made the change")
hisdoc_parser.add_argument("note", help="The changelog message for the change")
syswarn_parser = subparsers.add_parser("syswarn", help="Send a notification that system RAM or a tracked drive is running low on space")
syswarn_parser.add_argument("resource", help="Human-readable resource name, e.g. RAM or 'Disk (/)'")
syswarn_parser.add_argument("used", type=float, help="Current usage as a fraction in [0, 1]")
syswarn_parser.add_argument("threshold", type=float, help="The configured warn threshold as a fraction in [0, 1]")
checkmc_parser = subparsers.add_parser("checkmc", help="Send a notification that g_check_mc found a discrepancy between its source and destination")
checkmc_parser.add_argument("source_path", help="The source path (folder, not files) that was checked")
checkmc_parser.add_argument("dest_path", help="The destination path (folder, not files) that was checked")
checkmc_parser.add_argument("problems", help="JSON-encoded list of human-readable problem messages")
checkmc_parser.add_argument("failed_files", help="JSON-encoded list of paths that failed the check")
test_parser = subparsers.add_parser("test", help="Test that the webhooks are working")
args = parser.parse_args()

# Handle args
if args.action == "status":
    # Extract args
    name = args.name
    service_name = args.service
    status = args.status
    # Try and get systemd exit information - use os.environ rather than readEnviron as these aren't config values and may not be present
    service_result = os.environ.get("SERVICE_RESULT")
    exit_code = os.environ.get("EXIT_CODE")
    exit_status = os.environ.get("EXIT_STATUS")
    invocation_id = os.environ.get("INVOCATION_ID")
    # Send webhook
    send(webhook_getters["STATUS"](), generate_status(name, service_name, status, service_result, exit_code, exit_status, invocation_id))

elif args.action == "weblogin":
    # Extract args
    name = args.name
    # Send webhook
    send(webhook_getters["WEBLOGIN"](), generate_weblogin(name))
elif args.action == "webcommand":
    # Extract args
    name = args.name
    command = args.command
    # Send webhook
    send(webhook_getters["WEBCOMMAND"](), generate_webcommand(name, command))
elif args.action == "hisdoc":
    # Send webhook
    send(webhook_getters["HISDOC"](), generate_hisdoc(args.entity_type, args.hisdoc_action, args.entity_id, args.entity_name, args.actor_id, args.actor_username, args.note))
elif args.action == "syswarn":
    # Extract args
    resource = args.resource
    used = args.used
    threshold = args.threshold
    # Send webhook
    send(webhook_getters["SYSWARN"](), generate_syswarn(resource, used, threshold))
elif args.action == "checkmc":
    # Send webhook
    print(json.dumps(generate_checkmc(args.source_path, args.dest_path, json.loads(args.problems), json.loads(args.failed_files)), indent=4))
    print(len(json.dumps(generate_checkmc(args.source_path, args.dest_path, json.loads(args.problems), json.loads(args.failed_files)))))
    send(webhook_getters["CHECKMC"](), generate_checkmc(args.source_path, args.dest_path, json.loads(args.problems), json.loads(args.failed_files)))

elif args.action == "test":
    # Just try and call all webhooks
    for (name, func) in webhook_getters.items():
        try:
            send(func(), generate_test(name))
        except ConfigError as e:
            print(f"Failed, got \"{str(e)}\"")

else:
    raise Exception(f"Unknown action {args.action}")

