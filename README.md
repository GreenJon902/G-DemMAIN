# G-DemMAIN
[![Diagram of the users, permissions, databases, tables, folders and systemd services that we create.](doc/infra-diagram-thumbnail.png)](doc/infra-diagram.pdf)

TODO: Build deamon overview table from actual source files

| Service Name       | Description                                                                     | User                | After+Requires | Part Of        | Requires Mount For          | On Calender        | Restart                                   | On Fail        | WorkingDir, ExecStart, ExecStop                                                               | UMask |
|--------------------|---------------------------------------------------------------------------------|---------------------|----------------|----------------|-----------------------------|--------------------|-------------------------------------------|----------------|-----------------------------------------------------------------------------------------------|-------|
| g\_mc              | Runs the Minecraft server jar.                                                  | g\_mc               | mysql          |                |                             |                    | on-failure (max 2 fails in five minutes)  | Send an email. | /var/lib/g\_mc, /opt/infra/g\_mc/start\_service.sh, /opt/infra/g\_mc/start\_service.sh        | 0002  |
| g\_web             | Runs the website / node.js server - home, rules, hisdoc, dynmaps.               | g\_web              | mysql          |                |                             |                    | always                                    | Send an email. | /var/lib/g\_web, /opt/infra/g\_web/start\_service.sh, /opt/infra/g\_web/start\_service.sh     |       |
| mysql              | Manages the databases. Note that this is provided by MariaDB.                   | mysql               |                | g\_web, g\_mc  | /mnt/<vol\_name>/mysql      |                    | no                                        | Send an email. | /var/lib/mysql, (Provided by MariaDB), (Provided by MariaDB)                                  |       |
| g\_backup\_mc      | Backup certain folders from the Minecraft world.                                | g\_backup           |                |                |                             | *-*-01 02:00:00    | no                                        | Send an email. | N/A, /opt/infra/g\_backup/backup\_mc.sh, N/A                                                  |       |
| g\_backup\_home    | Backup the personal homes.                                                      | g\_backup           |                |                |                             | *-*-01 02:00:00    | no                                        | Send an email. | N/A, /opt/infra/g\_backup/backup\_home.sh, N/A                                                |       |
| g\_backup\_db      | Backup the databases.                                                           | g\_backup           |                |                |                             | *-*-01 02:00:00    | no                                        | Send an email. | N/A, /opt/infra/g\_backup/backup\_db.sh, N/A                                                  |       |
| g\_check\_disk     | Check that there is sufficient remaining disk space. If not, disables services. | g\_check\_disk      |                |                |                             | *-*-* *:00/5:00    | no                                        | Send an email. | N/A, /opt/infra/g\_check\_dist/check\_disk.sh, N/A                                            |       |
| g\_nightly\_restart| Restart g\_mc (required) and g\_web (if running) nightly.                       | g\_nightly\_restart |                |                |                             | *-*-* 00:00:00     | no                                        | Send an email. | N/A, /opt/infra/g\_check\_dist/run\_nightly\_restart.sh, N/A                                  |       |

Note: If After+Requires is none then we set `After=network.target` and no `Requires`.
                                       

TODO: Add documentation on use of fail2ban (brute force attacks)  

# Ports
| Port Number   | What is it for?                         | Blocked by the firewall? |
|---------------|-----------------------------------------|--------------------------|
| 25565         | Minecraft Server                        | No                       |
|    80         | Website                                 | No                       |
| 25575         | RCON management of the Minecraft Server | Yes                      |
| 31415         | SSH Access                              | Yes                      |
| _All others_  |                                         | Yes                      |

TODO: Convert the minecraft port to an evironment variable. Then do same with the rcon port and password.
TODO: Put webhooks.py in a generally accesible location or copy it g_mc's folder

# SSH
We connect to the server through SSH. For security passwords are disabled, instead we use a public/private key pair.  
If this is your first time, this is how we can set this up:  
1. Your computer:  
Run `ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_gdem`.  
This will prompt you to add a passphrase, please use something strong.  
2. Your computer:  
If `~/.ssh/config` doesn't exist then create it. Then append this  
```
Host gdem
    HostName <g-dem_ip>
    Port 31415
    User <user_name>
    IdentityFile ~/.ssh/id_ed25519_gdem
```
3. Server:  
Ensure the file `~/.ssh/authorized_keys` exists. If not create it and run `chmod 700 ~/.ssh` and `chmod 600 ~/.ssh/authorized_keys`.
Then append the line in `~/.ssh/id_ed25519_gdem` (formatted `ssh-ed25519 <your_key> <comment>`) to `~/.ssh/authorized_keys`.
4. Your computer:  
Now you can connect the server using `ssh gdem`.

# SystemD
SystemD is the utility that runs "services". These are basically each program - e.g. minecraft (g\_mc), the database (mysql), the website (g\_web), etc. This allows us to easily run all programs from the same place, configure them to rely on eachother (minecraft needs the database for block logging)), and configure them to restart if they crash.  

To start and stop a service use `systemctl start <service_name>` and `systemctl stop <service_name>`.  
To enable and disable a service use `systemctl enable <service_name>` and `systemctl disable <service_name>`.  
The difference between these two is that enabled means it will start if the VPS restarts, while if we only start it then it won't. Basically if you want to run something then you should enable it, and then start it. And to stop something you should disable and stop it.  

Some services are configured to not restart if they crash too frequently. If you attempt to run a service that has failed too frequently, you will see `Job for <service_name>.service failed because start of the service was attempted too often.`. This message should go away after the configured time, however should you want to start the service sooner, run `systemctl reset-failed <service_name>` and then start the server.  

After the configuration is changed, you will need to run `systemctl daemon-reload`.  

To view the status of a service, run `systemctl status <service_name>`.   
And to view the full logs you can use the journalctl utility. Using `journalctl -f` allows you to see logs as they happen, and by specificying `-u <service_name` you can filter specific services. Use `Ctrl-C` to exit.  
Note: you may need to run this as `sudo` or be in the `systemd-journalctl` group (to add a user run `usermod -a -G systemd-journal <user_name>`).  
You can also use `systemd-analyze verify <service_name>.service` to check for some errors.  


# Syncing
This module manages the contents and deployments of the synced files.

## Deployment
The `sync.py` script will copy the of the contents of folders specified in `sync-map.ini` to their respective destinations (also specified by that file).
This script will check for any discrepancies between the destination folders and the local folders, and ask you what to do in each case. This will not make any changes without user-input.

The `sync-map.ini` should contain a section with header `sync-map`, which should contain key-value pairs of `<local-folder-path (relative to root of repo)>=<destination-folder-path>`.

After updating systemd service config files, you'll need to run `systemctl daemon-reload`.
After updating the sshd config, first validate the config is correct with `sshd -t`, if there are no errors (no output) then run `systemctl reload sshd`.
After updating the mariadb config, run `systemctl restart mariadb`.

## Testing
Running `sync.py test-map.ini` will map the folders to `./test/...`. You may need to create the destination folders beforehand. Then mess around whith files in the test folder to see that everything is working.

You can also use the `-d`/`--dry-run` flag to test the program without making any changes.

## Extra information
Any files we copy have the following header pre-pended to them:
```
# This is a G-DemMAIN synced config file, and may be overwritten when sync is run. Please do not modify this line, and leave it as the first line of this file.
```
This line is used to check if a file is created by the `sync.py` script, and it is expected this is left as it is, on the first line.
This means we cannot copy files with shebangs.


