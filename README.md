# THIS IS THE PROD BRANCH
This branch tracks which changes have been installed on this branch.
Only merge main into here when you're actually executing an update.

# G-DemMAIN
[![Diagram of the users, permissions, databases, tables, folders and systemd services that we create.](doc/infra-diagram-thumbnail.png)](doc/infra-diagram.pdf)

Infrastructure repo for the G-DemMAIN Minecraft server: config, deploy tooling, systemd services, a Discord bot, and a web panel/monitoring stack. It covers everything needed to stand up and run the VPS from a fresh install.

# Documentation

- [doc/Initial Setup.md](doc/Initial%20Setup.md) - setting up a new VPS from scratch.
- [doc/Services.md](doc/Services.md) - systemd daemons, ports, and `systemctl` usage.
- [doc/Config Sync.md](doc/Config%20Sync.md) - syncing config files to their destinations.
- [doc/Environment Variables.md](doc/Environment%20Variables.md) - environment variable files and how they're synced.
- [doc/Databases.md](doc/Databases.md) - database schema and setup.
- [doc/G-DemMAIN Discord Bot.md](doc/G-DemMAIN%20Discord%20Bot.md) - setting up the Discord bot.
- [doc/G-DemMAIN Monitor Mod.md](doc/G-DemMAIN%20Monitor%20Mod.md) - the Fabric server mod bridging console/chat and exposing stats.
- [doc/Monitoring.md](doc/Monitoring.md) - the system/service monitoring script and its data format.
- [doc/Users, Groups, and Permissions.md](doc/Users%2C%20Groups%2C%20and%20Permissions.md) - users, groups, and folder permissions.
- [doc/Python.md](doc/Python.md) - the shared Python virtual environment.
- [doc/FaviconCreation.md](doc/FaviconCreation.md) - generating a favicon from a source image.
