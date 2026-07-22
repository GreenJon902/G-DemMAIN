# Initial Setup
May be missing details!

1. `apt install ufw fail2ban`

2. ```
ufw allow 25565
ufw allow 80
ufw allow 25575
ufw allow 31415
ufw enable
systemctl enable fail2ban
```

3. ```
adduser jon
usermod -aG sudo jon        # You may need to relog for this to take effect
```
And add `jon ALL=(ALL) NOPASSWD: ALL` to the end of `visudo`.

4. Login as jon and copy the SSH key. Use `scp` to copy the G-DemMAIN repo to the infra folder and apply SSH configurations. Use `sudo chmod 2755 -R *` to fix the permissions. Reload the SSH config on the server.

5. `apt install mariadb-server mariadb-client openjdk-25-jdk-headless python3-pip`
See `Python.md` for setting up the venv.

6. Create service users (run all lines that are necessary): 
```
sudo groupadd g_mc
sudo adduser --system --no-create-home -group g_mc
sudo mkdir /var/lib/g_mc
sudo chown g_mc:g_mc /var/lib/g_mc 
sudo chmod 2775 /var/lib/g_mc
sudo usermod -aG g_mc jon    # You may need to relog for this to take effect
```

7. Setup the environment and config files.
```
cd /opt/infra/environ && \
sudo python3 ../utils/sync-environ.py && \
cd /opt/infra/config/prod && \
sudo python3 ../utils/sync-static-config.py && \
sudo python3 ../utils/sync-sudoers.py && \
sudo systemctl daemon-reload
```

8. Set up the database 
See `Databases.md`. We need database users created.

9. Build the website
Ensure the g_web user is created.
```
sudo rsync -av --delete /opt/infra/scripts/g_web/ /var/lib/g_web
cd /var/lib/g_web
sudo chown -R g_web:g_web /var/lib/g_web
sudo -u g_web HOME=/var/lib/g_web npm ci
sudo -u g_web HOME=/var/lib/g_web NODE_OPTIONS='--enable-source-maps' npm run build
sudo -u g_web HOME=/var/lib/g_web npm prune --omit=dev
sudo chown -R g_web:g_web /var/lib/g_web
```

10. Set up the Discord bot
See `G-DemMAIN Discord Bot.md`. We need the bot created/configured on Discord's side and invited to the server.

TODO: Document how permissions work
So ownership is not important. g\_mc group gives read/write access for jon and g\_mc. We have the setgid bit for all infra and var/lib folders. THen read access everywhere cause who cares. We have umask set to 0002 so that permissions work correctly







`sudo systemctl stop g_mc g_web_nxt g_web_mcc g_monitor`
`sudo systemctl reset-failed g_mc g_web_nxt g_web_mcc g_monitor`
`sudo systemctl restart g_mc g_web_nxt g_web_mcc g_monitor`




