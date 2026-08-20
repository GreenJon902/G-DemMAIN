# The discord.py module only supports registering each event once. 
# The g_discord packages aims to be modular, and hence we need a robust way of allowing multiple different packages to subscribe to the same event.
#
# We assume each command only has one listener, so we expse the raw tree instance.
# We need to do this as modules need to somehow access the tree variable.
#
# The event flow is this:
#   Initialisation: g_discord ---registers-client-instance-with---> event_subscriptor.py
#   Initialisation: module ---registers-event-with---> event_subscriptor.py
#                                                   /---> module_1.py
#   On event: g_discord.py ---> event_subscriptor.py ---> module_2.py
#                                                   \---> module_3.py

import discord
from functools import partial
from typing import Callable

# List of events that modules can bind to
SUPPORTED_EVENTS = ["ready", "message"]

# Map from event name to list of listener callbacks
_listeners: dict[str, list[Callable[discord.Client, ...]]] = {}

# Accessible by import
tree: discord.app_commands.CommandTree = None

def register_client_instance(client: discord.Client):
    """
    Register the discord client instance and command-tree instance with this module.

    This procedurally generates bindings for the supported events.
    This should only be called once, and NO external bindings should be made on the client.
    """
    global tree
    tree = discord.app_commands.CommandTree(client)

    for event in SUPPORTED_EVENTS:
        print(f"Registering binding for '{event}'")
        setattr(client, f"on_{event}", partial(_dispatch_event, event, client))
        _listeners[event] = []

async def _dispatch_event(event, client, *args, **kwargs):
    """
    Dispatches the given event to all relevant listeners, with first parameter client and the following being what was given by discord.py.
    """
    print(f"Dispatching '{event}' to {len(_listeners[event])} listener")
    for listener in _listeners[event]:
        await listener(client, *args, **kwargs)

def subscribe_to(event):
    """
    A decorator to subscribe a function to a given event.
    The given event must occur in SUPPORTED_EVENTS.
    It is expected that the functions are asyncronous.
    """
    if event not in SUPPORTED_EVENTS:
        raise ValueError(f"Given '{event_name}' is not in SUPPORTED_EVENTS")

    def handle_subscribe(callback):
        print(f"Subscribing {callback} to '{event}'")
        _listeners[event].append(callback)
        return callback

    return handle_subscribe
