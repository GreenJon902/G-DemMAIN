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

The mod reads `config/g_mc_monitor.json` (relative to the server run directory, i.e.
`/var/lib/g_mc/config/g_mc_monitor.json`). Unlike most Fabric mods, **it does not create this file
or fill in defaults for it** for four of its fields:

```json
{
  "consoleAuthKey": "...",
  "chatAuthKey": "...",
  "socketBindAddress": "127.0.0.1",
  "consolePort": 25585,
  "chatPort": 25586,
  "fuseMountPath": "/var/lib/g_mc/monitor",
  "unsafe": false,
  "messageTemplates": {
    "playerJoined": "{player} joined the game",
    "playerLeft": "{player} left the game",
    "playerDied": "{message}",
    "serverStarted": "Server started",
    "serverStopped": "Server stopped",
    "playerAdvancement": "{player} has made the advancement {advancement}",
    "chatRelay": "[{source}] <{username}>: {message}"
  }
}
```

`consoleAuthKey`, `chatAuthKey`, `consolePort` and `chatPort` have **no default** - the mod
refuses to start (`onInitializeServer` throws, which Fabric Loader surfaces as a startup crash)
if the config file is missing entirely, or if any of those four fields is absent. A made-up port
or shared key that silently differs from what a client expects is a worse failure mode than
refusing to start. Every other field (`socketBindAddress`, `fuseMountPath`, `unsafe`,
`messageTemplates`) does get the default shown above if left out.

`unsafe` (default `false`) controls what happens if the FUSE mount or the console/chat sockets
fail to start. With the default `false`, either failure crashes startup the same way a missing
required field does. Set it to `true` to instead just log the failure and keep running in a
degraded state (the behaviour prior to this option existing) - useful for local/dev setups where
FUSE or the socket ports aren't always available.

`consoleAuthKey` and `chatAuthKey` are separate secrets - each socket only accepts its own key, so
a client that can reach the console socket can't use that key to authenticate to the chat socket
(or vice versa).

In production, don't hand-edit this file: it's generated from
[`static-config/g_mc/config/g_mc_monitor.json.template`](../static-config/g_mc/config/g_mc_monitor.json.template)
by `utils/sync-static-config.py`, which substitutes `MINECRAFT_MONITOR_CONSOLE_AUTH_KEY`,
`MINECRAFT_MONITOR_CHAT_AUTH_KEY`, `MINECRAFT_MONITOR_CONSOLE_PORT` and `MINECRAFT_MONITOR_CHAT_PORT`
from `environ/g_mc_g_web_minecraft` (see [Environment Variables.md](Environment%20Variables.md))
into the JSON's four required fields. Run the sync script (or set those environ variables and
rerun it) before first starting the server with this mod installed. The mod itself never writes
to this file - that's left entirely to the sync tooling, so the two don't fight over ownership.

`socketBindAddress`/`consolePort`/`chatPort` are loopback-only by default. There is deliberately
no firewall rule needed for them (unlike RCON's port 25575) since nothing outside the machine
should ever need to reach them directly.

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

1. **`fuse3` (or `fuse`) must be installed** and `/dev/fuse` must be accessible to the `g_mc` user
   (usually already true - check the `fuse` group or device permissions if mounting fails).
2. **`user_allow_other` must be uncommented in `/etc/fuse.conf`** - without it, a non-root mount
   with `-o allow_other` is rejected by libfuse itself, regardless of file permissions. This is
   synced automatically from [`static-config/fuse/fuse.conf`](../static-config/fuse/fuse.conf) by
   `utils/sync-static-config.py` (see [static-config/README.md](../static-config/README.md)) - run
   the sync script before first starting the server with this mod installed.

If the mount fails, what happens next depends on `unsafe` (see [Config](#config)): by default this
crashes startup; with `unsafe: true` the mod instead logs an error and carries on without it
(console/chat sockets and in-game commands are unaffected) - check `journalctl -u g_mc` for the
failure reason either way.

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

**Outgoing (server → client):**

- On successful auth, the server immediately sends the last 10 messages as history in a single
  envelope. Each entry in `lines` is the exact JSON object that socket would otherwise have
  streamed live - a `line` object for the console socket, `message`/`event` objects for the chat
  socket (see each socket's own section below for the shapes):
  ```json
  {"type": "history", "lines": [{"type": "line", "text": "..."}, "..."]}
  ```

## Console socket protocol

Port `consolePort`. See [Socket handshake](#socket-handshake) for the transport/auth/history steps
that happen first - this section covers what's exchanged after that.

**Outgoing (server → client):**

- From then on, every new line printed to console (log output, chat, command feedback - whatever
  actually goes to stdout) is streamed as it happens:
  ```json
  {"type": "line", "text": "[12:00:05] [Server thread/INFO]: <Notch> hello"}
  ```
  History entries (see [Socket handshake](#socket-handshake)) use this same shape.

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

- Real player chat:
  ```json
  {"type": "message", "username": "Notch", "message": "hello"}
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

## In-game commands

| Command | Permission node        | Fallback (no permission plugin) | Output                                  |
|---------|-------------------------|----------------------------------|------------------------------------------|
| `/tps`  | `g_mc_monitor:tps`  | Permission level 2 (gamemaster/moderator) | Current TPS and average ms/tick. |
| `/heap` | `g_mc_monitor:heap` | Permission level 2 (gamemaster/moderator) | Heap used/allocated, human-readable. |

