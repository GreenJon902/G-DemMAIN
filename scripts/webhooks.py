# WIP for sending updates to a discord channel via webhooks

import requests
import os
from argparse import ArgumentParser

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

def generate_test(intended_recipient):
    # Content for a testing webhook.
    return {"username": "G-DemMAIN",
            "content": f"Test success? :thinking:\nThis should be the webhook for {intended_recipient}!"}
    
def send(webhook, json):
    # Send the given json to the given webhook
    response = requests.post(webhook, json=json)
    print(f"Sent webhook, got {response.status_code} {response.content}")


# Get webhooks
class NoWebhookInEnviron(Exception): pass
def _get_webhook(name):
    # Gets the webhook url for the given name, otherwise crashes.
    # We load these late so that we can test the file even if we don't have all webhooks installed
    if (hook_url := os.environ.get(name)) is None:
        raise NoWebhookInEnviron(f"Needs environment variable {name}=...")
    return hook_url
webhook_getters = {
    "STATUS": lambda: _get_webhook("STATUS_WEBHOOK"),
    "WEBLOGIN": lambda: _get_webhook("WEBLOGIN_WEBHOOK"),
    "WEBCOMMAND": lambda: _get_webhook("WEBCOMMAND_WEBHOOK")
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
test_parser = subparsers.add_parser("test", help="Test that the webhooks are working")
args = parser.parse_args()

# Handle args
if args.action == "status":
    # Extract args
    name = args.name
    service_name = args.service
    status = args.status
    # Try and get systemd exit information
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

elif args.action == "test":
    # Just try and call all webhooks
    for (name, func) in webhook_getters.items():
        try:
            send(func(), generate_test(name))
        except NoWebhookInEnviron as e:
            print(f"Failed, got {str(e)}")

else:
    raise Exception(f"Unknown action {args.action}")

