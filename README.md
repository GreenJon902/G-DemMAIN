# G-DemMAIN
[![Diagram of the users, permissions, databases, tables, folders and systemd services that we create.](doc/infra-diagram-thumbnail.png)](doc/infra-diagram.pdf)
TODO: Deamon settings for g_mc are more complex now, add those.
TODO: Move the deamon table to MARKDOWN as it doesn't need to be in the diagram.

# Ports
| Port Number | What is it for?                         | Blocked by the firewall? |
|-------------|-----------------------------------------|--------------------------|
| 25565       | Minecraft Server                        | No                       |
|    80       | Website                                 | No                       |
| 25575       | RCON management of the Minecraft Server | Yes                      |


# SystemD
SystemD is the utility that runs "services". These are basically each program - e.g. minecraft (g\_mc), the database (mysql), the website (g\_web), etc. This allows us to easily run all programs from the same place, configure them to rely on eachother (minecraft needs the database for block logging)), and configure them to restart if they crash.

To start and stop a service use `systemctl start <service_name>` and `systemctl stop <service_name>`. 
To enable and disable a service use `systemctl enable <service_name>` and `systemctl disable <service_name>`. 
The difference between these two is that enabled means it will start if the VPS restarts, while if we only start it then it won't. Basically if you want to run something then you should enable it, and then start it. And to stop something you should disable and stop it.

Some services are configured to not restart if they crash too frequently. If you attempt to run a service that has failed too frequently, you will see `Job for <service_name>.service failed because start of the service was attempted too often.`. This message should go away after the configured time, however should you want to start the service sooner, run `systemctl reset-failed <service_name>` and then start the server.

After the configuration is changed, you will need to run `systemctl daemon-reload`.

To view the status of a service, run `systemctl status <service_name>`. 
And to view the full logs you can use the journalctl utility. Using `journalctl -f` allows you to see logs as they happen, and by specificying `-u <service_name` you can filter specific services. Use `Ctrl-C` to exit.
Note: you may need to run this as `sudo` or be in the `systemd-journalctl` group (to add a user run `usermod -a -G systemd-journal <user_name>`)
