# Users

| User   | Groups               | Notes                                                           | System user (UID < 1000) |
|--------|----------------------|-----------------------------------------------------------------|--------------------------|
| jon    | jon,users,sudo,g_mc  |                                                                 | No                       |
| root   | root                 | Created by default, do not touch this.                          | Kinda? Has UID=0         |
| g\_mc  | g\_mc,view_infra     | Should be as locked down as possible as may run arbitrary code. | Yes                      |

Warning: Try to avoid deleting users. If you must, remove any files that user owns first.

TODO: Add aj, mysql, g\_backup, g\_check\_disk to this table.
TODO: Remove g\_nightly\_restart from the diagram.

# Folders
| Folder | Owner | Group | Permission | Notes |
|---|---|---|---|---|
| /var/lib/g\_mc/* | g\_mc | g\_mc | 2770 | The owner may also be jon or root, this is fine. 770 permissions so I can easily modify parts. SetGID bit so that all files created in there are added to the g\_mc group. This should apply to every child except the logs folder and it's children. |
| /var/lib/g\_mc | g\_mc | g\_mc | 2771 | We need execute on the folder itself so everyone is able to access the logs folder. |
| /var/lib/g\_mc/logs | g\_mc | g\_mc | 2755 | The owner should be the only one able to write to this folder. SetGID bit so created files inherit the g\_mc group. Anyone should be able to read these files (as that makes it easier for access elsewhere). |
| /opt/infra/ | jon | jon | 0750 | Only I should be able to read and write here. |

TODO: Do we need a view_infra group?

# Sudoers
You can set up jon to not require a password with `jon ALL=(ALL) NOPASSWD: ALL`.

TODO g\_check\_disk will need access to certain systemctl commands
