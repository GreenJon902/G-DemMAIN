# Syncing
Environment files are synced from `environ/` using `utils/sync-environ.py` to `/etc/g-demmain` (in prod). See `utils/README.md` for the source file format.

# Parsing rules
The synced files are systemd `EnvironmentFile=`s, so systemd's parsing rules apply, not shell/dotenv ones:
- Lines without an `=`, and lines starting with `#` or `;`, are ignored (comments).
- Values are unquoted by default - `NAME=value` - with leading/trailing whitespace trimmed but interior whitespace kept verbatim, and backslash-escapes following POSIX shell unquoted-text rules.
- Values can also be `'single'` or `"double"` quoted (e.g. if they need leading/trailing whitespace, or a literal `#`/`;`), following the usual POSIX shell quoting rules for each.

# /etc/g-demmain/common.venv
In this file go the variables that it is save that all services (may - they may not) see.  
This should have:  

`STATUS_WEBHOOK=https://discord.com/api/webhooks/.../...` - The webhook used for notifying us of status updates (crashes, server starts, etc.).
