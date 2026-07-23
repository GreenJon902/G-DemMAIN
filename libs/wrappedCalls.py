# Wrappers that apply a consistent "catch, log" (or "catch, log, then die") policy around calling
# other code, so individual call sites don't each hand-roll their own error handling/formatting

import os
import sys
import traceback


def log_exception(message: str = None, fallback: str = None):
    """
    Prints message (or fallback, if message is None), followed by the currently-handled
    exception's traceback (and error message) indented under it. Must be called from inside an except block.
    """
    print(message if message is not None else fallback)
    print(*["\t" + line for line in traceback.format_exc().split("\n")], sep="\n")  # This prints the actual error message too


def safe_call(func: callable, *args: list[any], on_error_msg: str = None, **kwargs: dict[str, any]):
    """
    Calls func(*args, **kwargs), returning its return-value.
    If it raises, the exception is logged to console (with a traceback) and None is returned instead.
    on_error_msg, if given, is printed as the first line of the error log instead of the default message.
    """
    try:
        return func(*args, **kwargs)
    except Exception:
        log_exception(on_error_msg, f"Failed to call '{func}': ")
        return None


async def exit_all_on_fail(async_func: callable, *args: list[any], on_error_msg: str = None, **kwargs: dict[str, any]):
    """
    Awaits async_func(*args, **kwargs), returning its return-value.
    If it raises, the exception is logged to console (with a traceback) and the whole process is
    killed immediately via os._exit. Use this for setup the rest of the process can't meaningfully
    run without, at a call site (e.g. an event-loop callback) whose own error handling would
    otherwise just log the failure and keep running in a broken state.
    on_error_msg, if given, is printed as the first line of the error log instead of the default message.
    """
    try:
        return await async_func(*args, **kwargs)
    except Exception:
        log_exception(on_error_msg, f"Failed to call '{async_func}', exiting: ")
        # os._exit, not sys.exit/raise: call sites are typically scheduled tasks (e.g. discord.py
        # event callbacks) whose own exception handling would just log this and keep running -
        # os._exit bypasses that entirely and kills the whole process
        sys.stdout.flush()
        sys.stderr.flush()
        os._exit(1)
