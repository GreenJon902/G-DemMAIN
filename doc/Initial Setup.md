# Initial Setup
May be missing details!

1. `apt install ufw fail2ban`

TODO: Add documentation on use of fail2ban (brute force attacks)

2. ```
sudo ufw allow 25565
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 443/udp  # HTTP/3 (QUIC) - see doc/Caddy.md
sudo ufw allow <ssh_port>
sudo ufw enable
sudo systemctl enable fail2ban
```

No other ports should be allwed.

3. ```
adduser jon
usermod -aG sudo jon        # You may need to relog for this to take effect
```
And add `jon ALL=(ALL) NOPASSWD: ALL` to the end of `visudo`.

4. Set up SSH access (see [SSH](#ssh) below).

5. Login as jon and copy the SSH key. Use `scp` to copy the G-DemMAIN repo to the infra folder and apply SSH configurations. Use `sudo chmod 2755 -R *` to fix the permissions. Reload the SSH config on the server.

6. `sudo apt install mariadb-server mariadb-client openjdk-25-jdk-headless python3.13-venv fuse3 libfuse-dev`
See `Python.md` for setting up the venv.

Caddy isn't in the default apt repos, so it needs its own repo added first - see [Caddy.md](Caddy.md):
```
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

7. Create service users (run all lines that are necessary): 
```
sudo groupadd g_mc
sudo adduser --system --no-create-home -group g_mc
sudo mkdir /var/lib/g_mc
sudo chown g_mc:g_mc /var/lib/g_mc 
sudo chmod 2775 /var/lib/g_mc
sudo usermod -aG g_mc jon    # You may need to relog for this to take effect
```

8. Setup the environment and config files, reload caddy
```
cd /opt/infra/environ && \
sudo python3 ../utils/sync-environ.py prod && \
cd /opt/infra/config/prod && \
sudo python3 ../../utils/sync_static_config/main.py && \
sudo systemctl daemon-reload
```

Whenever `config/prod/g_web/Caddyfile` changes, validate before reloading so a bad edit can't take the site down (see [Caddy.md](Caddy.md)):
```
# Load the env vars into the shell so caddy validate can see them (not needed to reload)
export DOMAIN_NAME="..."  # We must set this so validate works
caddy validate --config /opt/infra/config/prod/g_web/Caddyfile
sudo systemctl reload caddy
```

9. Set up the database 
See `Databases.md`. We need database users and tables created.
You can use `/usr/bin/node /var/lib/g_web/node_modules/prisma/build/index.js migrate diff --config /var/lib/g_web/com/prisma.config.ts --from-schema /var/lib/g_web/com/prisma/schema.prisma --to-config-datasource --exit-code` to compare the current schema to what the repo holds.

10. Build the website
Ensure the g_web user is created.
Node is installed via [nvm](https://github.com/nvm-sh/nvm) rather than apt - install nvm for the g_web user, then `nvm install <version>` (or `nvm use <version>` if already installed).
```
sudo rsync -av --delete /opt/infra/scripts/g_web/ /var/lib/g_web
cd /var/lib/g_web
sudo chown -R g_web:g_web /var/lib/g_web
sudo -u g_web HOME=/var/lib/g_web npm ci
sudo -u g_web HOME=/var/lib/g_web NODE_OPTIONS='--enable-source-maps' npm run build
sudo -u g_web HOME=/var/lib/g_web npm prune --omit=dev
sudo chown -R g_web:g_web /var/lib/g_web
```
TODO: `npm ci --omit=dev` crashes, which is why this installs full dependencies first (`npm ci`), builds, then prunes dev dependencies afterwards (`npm prune --omit=dev`) instead of installing without them directly.

11. Set up the Discord bot
See `G-DemMAIN Discord Bot.md`. We need the bot created/configured on Discord's side and invited to the server.

See [Users, Groups, and Permissions.md](Users%2C%20Groups%2C%20and%20Permissions.md) for how folder ownership, the setgid bit, and UMask combine to keep permissions consistent across users.

`sudo systemctl stop g_mc g_web_nxt g_web_mcc g_monitor g_discord caddy`
`sudo systemctl reset-failed g_mc g_web_nxt g_web_mcc g_monitor g_discord caddy`
`sudo systemctl restart g_mc g_web_nxt g_web_mcc g_monitor g_discord caddy`

12. Setup Minecraft
Install the software as specified in [Minecraft.md](Minecraft.md), renaming the server jar to `minecraft_server.jar`.
You must ensure the mods folder has the executable bit set to true (e.g. `chmod 755 mods`).

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
    Port <ssh_port>
    User <user_name>
    IdentityFile ~/.ssh/id_ed25519_gdem
```
3. Server:  
Ensure the file `~/.ssh/authorized_keys` exists. If not create it and run `chmod 700 ~/.ssh` and `chmod 600 ~/.ssh/authorized_keys`.
Then append the line in `~/.ssh/id_ed25519_gdem` (formatted `ssh-ed25519 <your_key> <comment>`) to `~/.ssh/authorized_keys`.
4. Your computer:  
Now you can connect the server using `ssh gdem`.

