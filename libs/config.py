# Shared config/environ loading for every Python component. Resolves G_DEMMAIN_ROOT/G_DEMMAIN_MODE
# once at import time - both must already be set (by devUtils/prepDevEnv.sh in dev, or systemd's
# EnvironmentFile= in prod) before any Python component that imports this runs.

import json
import os


class ConfigError(Exception):
    pass


def _requireEnvironVar(name):
    # Reads a required environment variable, raising a clear error rather than a bare KeyError
    if name not in os.environ:
        raise ConfigError(f"Missing required environment variable {name}")
    return os.environ[name]


ROOT = _requireEnvironVar("G_DEMMAIN_ROOT")
MODE = _requireEnvironVar("G_DEMMAIN_MODE")

# Extension -> parser, so a second config format later doesn't touch the public API
_LOADERS = {
    ".json": json.load
}


def _configPath(relpath):
    # relpath is always resolved as {ROOT}/config/{MODE}/{relpath} - this is the only place a
    # config file is located; overriding *where* config comes from is done by overriding
    # G_DEMMAIN_ROOT/G_DEMMAIN_MODE, never by passing an absolute path in here
    assert not os.path.isabs(relpath), f"relpath must be relative, got {relpath!r}"
    return os.path.join(ROOT, "config", MODE, relpath)


def readConfigRaw(relpath, *keys):
    # Loads relpath (dispatching on extension) and traverses keys, existence-checking each hop.
    # Returns the raw parsed value with no type check - see readConfig/readConfigList for that.
    path = _configPath(relpath)
    ext = os.path.splitext(path)[1]
    loader = _LOADERS.get(ext)
    if loader is None:
        raise ConfigError(f"No config loader registered for extension {ext!r} (path: {path})")
    if not os.path.exists(path):
        raise ConfigError(f"Config file does not exist: {path}")
    with open(path, "r") as f:
        value = loader(f)

    walked = []
    for key in keys:
        if not isinstance(value, dict) or key not in value:
            raise ConfigError(f"Missing key {'.'.join(walked + [key])!r} in {path}")
        value = value[key]
        walked.append(key)
    return value


def readConfig(relpath, type_, *keys):
    # readConfigRaw, then assert the value is exactly type_ (expected, not cast) - except an int is
    # accepted where a float is requested (coerced to float), since JSON doesn't distinguish "1" from
    # "1.0" the way this function's callers want to
    value = readConfigRaw(relpath, *keys)
    if type_ is float and type(value) is int:
        value = float(value)
    if type(value) is not type_:
        raise ConfigError(f"Expected {type_.__name__} for {'.'.join(keys)!r} in {relpath}, got {type(value).__name__} ({value!r})")
    return value


def readConfigList(relpath, type_, *keys):
    # readConfigRaw, then assert the value is a list and every element is exactly type_
    value = readConfigRaw(relpath, *keys)
    if type(value) is not list or any(type(item) is not type_ for item in value):
        raise ConfigError(f"Expected a list of {type_.__name__} for {'.'.join(keys)!r} in {relpath}, got {value!r}")
    return value


def readEnviron(name, type_):
    # Reads os.environ[name], parsed into type_ (str passthrough, int(...), bool from common
    # truthy/falsy spellings). Always required - there is no optional/default variant.
    raw = _requireEnvironVar(name)
    if type_ is str:
        return raw
    if type_ is int:
        try:
            return int(raw)
        except ValueError:
            raise ConfigError(f"Environment variable {name}={raw!r} is not a valid int")
    if type_ is bool:
        lowered = raw.strip().lower()
        if lowered in ("1", "true", "yes", "on"):
            return True
        if lowered in ("0", "false", "no", "off", ""):
            return False
        raise ConfigError(f"Environment variable {name}={raw!r} is not a recognised bool")
    raise ConfigError(f"readEnviron does not support type {type_!r}")


def resolvePath(value):
    # Absolute values (all prod system paths) are used as-is; relative values (dev, inside the
    # repo) resolve against G_DEMMAIN_ROOT. Distinct from _configPath - this resolves a *value
    # already read out of* a config file, not which file to open.
    return value if os.path.isabs(value) else os.path.join(ROOT, value)
