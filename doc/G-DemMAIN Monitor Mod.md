# G-DemMAIN Monitor Mod - `g_mc_monitor`

A Fabric server mod (`scripts/g_mc/g_mc_monitor`) that exposes live server stats and bridges the
console/chat to external tools. It targets Minecraft 26.2 / Fabric Loader 0.19.3 / Fabric API
0.154.2+26.2 / Java 25.

It has three parts:
- A **FUSE filesystem** exposing TPS, heap usage and the online player list as plain files.
- A **console socket** streaming everything printed to console (including chat and command
  feedback) and accepting commands, replacing RCON for interactive use.
- A **chat socket** relaying real chat messages both ways and one-way event notifications
  (join/leave/death/advancement/server start-stop).
- In-game commands (`/tps`, `/heap`) mirroring the filesystem's stats.

## Why not RCON?

RCON only returns the response to the command *you* sent - it doesn't stream chat, other
players' commands, or general log output, and it has no concept of "give me the last N lines".
The console socket here instead taps directly into the same log output the server itself
prints to stdout, and executes commands through the exact same `CommandSourceStack` the
dedicated server uses for typed console input (`MinecraftServer#createCommandSourceStack()`),
so its behaviour is as close to "typing at the real console" as possible.

## Config

The mod reads `${G_DEMMAIN_ROOT}/config/${G_DEMMAIN_MODE}/g_mc_monitor/config.json` - this file is
non-synced, read directly from the repo checkout in place (no server-run-directory-relative
resolution, no templating). It contains exactly four keys, **all required with no default**:

```json
{
  "consolePort": 25585,
  "chatPort": 25586,
  "socketBindAddress": "127.0.0.1",
  "fuseMountPath": "/var/lib/g_mc/monitor"
}
```

The mod refuses to start (`onInitializeServer` throws, which Fabric Loader surfaces as a startup
crash) if the config file is missing entirely, or if any of those four fields is absent. A made-up
port, bind address, or mount path that silently differs from what a client expects is a worse
failure mode than refusing to start. `fuseMountPath` may be given as a relative path, in which case
it resolves against `G_DEMMAIN_ROOT` rather than the repo-relative JSON path itself.

`consoleAuthKey` and `chatAuthKey` are **not** part of this file at all - they're read straight
from the `MINECRAFT_MONITOR_CONSOLE_AUTH_KEY`/`MINECRAFT_MONITOR_CHAT_AUTH_KEY` environment
variables (see [Environment Variables.md](Environment%20Variables.md)) and never written to any
file. They're separate secrets - each socket only accepts its own key, so a client that can reach
the console socket can't use that key to authenticate to the chat socket (or vice versa). The mod
refuses to start if either is missing/blank, the same fail-loud treatment as the four file fields
above.

`unsafe` (optional, default `false`) is also read from the environment - the
`G_MC_MONITOR_UNSAFE` variable - rather than the JSON file. It controls what happens if the FUSE
mount or the console/chat sockets fail to start: with the default `false`, either failure crashes
startup the same way a missing required field does. Set it to a truthy value to instead just log
the failure and keep running in a degraded state (the behaviour prior to this option existing) -
useful for local/dev setups where FUSE or the socket ports aren't always available.

`messageTemplates` (text templates used for chat-socket event/relay messages) still exists as a
Java-side-defaulted, optional field on the mod's in-memory config, but it is no longer expected to
appear in the shipped config file at all - if present it's honoured, but the four keys above are
the only ones the file should contain going forward.

`socketBindAddress`/`consolePort`/`chatPort` are loopback-only by convention (`127.0.0.1` in both
`config/prod` and `config/dev`). There is deliberately no firewall rule needed for them (unlike
RCON's port 25575) since nothing outside the machine should ever need to reach them directly.

## Filesystem layout

Mounted read-only at `fuseMountPath`. Every read computes the current value on the spot - nothing
is polled or written to disk in the background, so the overhead is however often something
actually reads a file.

```
<mount>/
├── tps                     # e.g. "19.98\n" - rolling average over the last 100 ticks, capped at 20
├── heap_used_bytes         # e.g. "812345600\n" - Runtime.totalMemory() - freeMemory()
├── heap_allocated_bytes    # e.g. "3221225472\n" - Runtime.maxMemory(), the -Xmx ceiling
└── players/
    ├── Notch                # one zero-byte file per online player, named after their username
    └── Jeb_                 # existence = online; there is nothing to read from the file itself
```

### FUSE prerequisites

The mount is done in-process via [jnr-fuse](https://github.com/SerCeMan/jnr-fuse) (bundled inside
the mod jar) with the `allow_other` mount option, so that `g_web`/`g_monitor`/other users can read
it even though `g_mc` is the process that mounted it. Two host-level things fall out of that:

1. **`fuse3` (or `fuse`) and `libfuse-dev` must be installed** and `/dev/fuse` must be accessible to the `g_mc` user
   (usually already true - check the `fuse` group or device permissions if mounting fails).
2. **`user_allow_other` must be uncommented in `/etc/fuse.conf`** - without it, a non-root mount
   with `-o allow_other` is rejected by libfuse itself, regardless of file permissions. This is
   synced automatically from [`config/prod/fuse/fuse.conf`](../config/prod/fuse/fuse.conf) by
   `utils/sync-static-config.py` (see [config/prod/README.md](../config/prod/README.md)) - run
   the sync script before first starting the server with this mod installed.

If the mount fails, what happens next depends on `unsafe` (see [Config](#config)): by default this
crashes startup; with `G_MC_MONITOR_UNSAFE=true` the mod instead logs an error and carries on
without it (console/chat sockets and in-game commands are unaffected) - check `journalctl -u g_mc`
for the failure reason either way.

## Socket handshake

The console socket (`consolePort`) and the chat socket (`chatPort`) share the same transport and
connection handshake; only what's exchanged afterwards differs, and is covered in each socket's
own section below.

**Transport:** TCP, newline-delimited JSON (UTF-8, one object per line).

**Incoming (client → server):**

- Immediately upon connecting, the client must send an auth line with the socket's configured key
  (`consoleAuthKey` for the console socket, `chatAuthKey` for the chat socket):
  ```json
  {"authKey": "supersecretkey123"}
  ```
  Anything else, or a wrong key, closes the connection with no response.
- After that, any line the client sends that isn't valid JSON, or doesn't match the shape expected
  by that socket (see each socket's own section below), is dropped and logged server-side as a
  warning - it never gets a response, and the connection is left open.

**Outgoing (server → client):**

- On successful auth, the server immediately sends the last 10 messages as history in a single
  envelope. Each entry in `lines` is the exact JSON object that socket would otherwise have
  streamed live - a `line` object for the console socket, `message`/`event` objects for the chat
  socket (see each socket's own section below for the shapes):
  ```json
  {"type": "history", "lines": [{...}, {...}]}
  ```

## Console socket protocol

Port `consolePort`. See [Socket handshake](#socket-handshake) for the transport/auth/history steps
that happen first - this section covers what's exchanged after that.

**Outgoing (server → client):**

- From then on, every new line printed to console at INFO level or above (log output, chat, command
  feedback - whatever actually goes to stdout) is streamed as it happens, as separate fields rather
  than one pre-formatted string:
  ```json
  {"type": "line", "datetime": "2026-07-20T14:07:00.123Z", "level": "INFO", "thread": "Server thread", "message": "<Notch> hello"}
  ```
  `datetime` is ISO 8601/RFC 3339 in UTC with millisecond precision, and (being fixed-width) also
  sorts correctly as a plain string - useful for ordering lines from multiple sources. `level` is
  one of Log4j2's standard level names (`TRACE`/`DEBUG`/`INFO`/`WARN`/`ERROR`/`FATAL`), though in
  practice only `INFO`/`WARN`/`ERROR`/`FATAL` are ever seen - DEBUG/TRACE are filtered out at the
  appender before reaching this mod at all (dev's `gradlew runServer` allows them through its own
  root logger level, but that's not something this mod exposes even there). The last-10 history
  buffer (see [Socket handshake](#socket-handshake)) shares this same INFO+ floor and otherwise uses
  this same shape.

**Incoming (client → server):**

- The client may send commands at any time (no response is sent back beyond whatever the command
  itself prints to console, which arrives as a normal `line` message):
  ```json
  {"type": "command", "command": "say hello from the bridge"}
  ```
  Commands run with full permissions, attributed the same way the server's own console input is.

Multiple clients may be connected at once; all of them receive every line.

## Chat socket protocol

Port `chatPort`. See [Socket handshake](#socket-handshake) for the transport/auth/history steps
that happen first - this section covers what's exchanged after that.

**Outgoing (server → client):**

- Real player chat, with `source` always `"Minecraft"`:
  ```json
  {"type": "message", "source": "Minecraft", "username": "Notch", "message": "hello"}
  ```
- One-way events - `event` is one of `player_joined`, `player_left`, `player_died`,
  `server_started`, `server_stopped`, `player_advancement`. `message` is the event's template
  already rendered; the raw fields used to render it are included alongside for convenience:
  ```json
  {"type": "event", "event": "player_joined", "player": "Notch", "message": "Notch joined the game"}
  {"type": "event", "event": "player_died", "player": "Notch", "message": "Notch fell from a high place"}
  {"type": "event", "event": "player_advancement", "player": "Notch", "advancement": "Stone Age", "message": "Notch has made the advancement Stone Age"}
  ```
  History entries (see [Socket handshake](#socket-handshake)) use these same shapes.

**Incoming (client → server):**

```json
{"type": "message", "source": "Web", "username": "Notch", "message": "hello from the web"}
{"type": "message", "source": "Discord", "username": "Notch", "message": "hello from discord"}
```

`source` identifies which bridge the message came from (e.g. `Web`, `Discord`) so players can tell
where it originated - it's a free-form string, not validated against a fixed list. This is
broadcast into the game via the `chatRelay` template (default `[{source}] <{username}>: {message}`,
e.g. `[Web] <Notch>: hello from the web`) as a **system chat message**, not a signed player
message - modern Minecraft requires real, connected player accounts to sign chat, so there is no
way to make an arbitrary external username show up as a genuine player message. It will look like
chat and appear in the normal chat log, but isn't cryptographically attributed to a player.

If there are other clients connected, the same `{"type": "message", ...}` object (`source` as sent,
unchanged) is also relayed straight back out to every other connected chat-socket client - but not
back to the client that sent it - so e.g. a Discord bridge sees a message a Web bridge sent, and
vice versa, without needing the game server to be reachable.

## In-game commands

| Command | Permission node        | Fallback (no permission plugin) | Output                                  |
|---------|-------------------------|----------------------------------|------------------------------------------|
| `/tps`  | `g_mc_monitor:tps`  | Permission level 2 (gamemaster/moderator) | Current TPS and average ms/tick. |
| `/heap` | `g_mc_monitor:heap` | Permission level 2 (gamemaster/moderator) | Heap used/allocated, human-readable. |

