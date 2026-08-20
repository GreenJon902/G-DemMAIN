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

# List of discord.py gateway events that modules can bind to - the first arguement is the discord client, the rest will be the event arguements
NATIVE_EVENTS = ["ready", "message", "guild_channel_create"]

# List of events that don't come from discord.py's gateway - nothing binds these onto the client,
# they're only ever fired by an explicit dispatch_event call
EXTERNAL_EVENTS = [
    "stop"  # args=[], kwargs={}
]

# Map from event name to list of listener callbacks
_listeners: dict[str, list[Callable]] = {k: [] for k in NATIVE_EVENTS + EXTERNAL_EVENTS}

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

    for event in NATIVE_EVENTS:
        print(f"Registering binding for '{event}'")
        setattr(client, f"on_{event}", partial(_dispatch_event, event, client))  # Client arg is inserted here

async def _dispatch_event(event, *args, **kwargs):
    """
    Dispatches the given event to all relevant listeners, with first parameter client and the following being what was given by discord.py.
    """
    print(f"Dispatching '{event}' to {len(_listeners[event])} listener")
    for listener in _listeners[event]:
        await listener(*args, **kwargs)

async def dispatch_event(event, *args, **kwargs):
    """
    Publicly dispatches event to its listeners. 
    The given event must be in EXTERNAL_EVENTS - discord.py will dispatch NATIVE_EVENTS.
    """
    if event not in EXTERNAL_EVENTS:
        raise ValueError(f"Given '{event}' is not in EXTERNAL_EVENTS")
    await _dispatch_event(event, *args, **kwargs)

def subscribe_to(event):
    """
    A decorator to subscribe a function to a given event.
    The given event must occur in NATIVE_EVENTS or EXTERNAL_EVENTS.
    It is expected that the functions are asyncronous.
    """
    if event not in NATIVE_EVENTS and event not in EXTERNAL_EVENTS:
        raise ValueError(f"Given '{event}' is not in NATIVE_EVENTS or EXTERNAL_EVENTS")

    def handle_subscribe(callback):
        print(f"Subscribing {callback} to '{event}'")
        _listeners[event].append(callback)
        return callback

    return handle_subscribe
