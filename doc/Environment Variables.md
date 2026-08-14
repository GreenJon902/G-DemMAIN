# Syncing
Environment files are synced from `environ/` using `utils/sync-environ.py` to `/etc/g-demmain` (in prod). See [Config Sync.md](Config%20Sync.md) for the source file format.

# Files
Each file in `environ/` becomes one destination file (e.g. `environ/common` syncs to `/etc/g-demmain/common.env` in prod - see [Syncing](#syncing)). Variables and their meanings are documented inline as comments in each source file.

- `common` - General settings accessible to any service.
- other files should only be accessible to the users listed in the file name.

# Parsing rules
The synced files are systemd `EnvironmentFile=`s, so systemd's parsing rules apply, not shell/dotenv ones:
- Lines without an `=`, and lines starting with `#` or `;`, are ignored (comments).
- Values are unquoted by default - `NAME=value` - with leading/trailing whitespace trimmed but interior whitespace kept verbatim, and backslash-escapes following POSIX shell unquoted-text rules.
- Values can also be `'single'` or `"double"` quoted (e.g. if they need leading/trailing whitespace, or a literal `#`/`;`), following the usual POSIX shell quoting rules for each.

