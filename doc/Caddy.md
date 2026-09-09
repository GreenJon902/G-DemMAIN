TODO: We're currently sending website.dom/dynmaps to port 5391 as a temp solution.


# Caddy

Caddy is a reverse proxy in front of the website. 
It automatically fetches HTTPS certificates (Let's Encrypt) and handles all that for me. It then forwards the bare HTTP requests to next and mcc.
It forwards `/ws/*` to port 3001 (mcc), and all else to port 3000 (next).

Port 80 (normally HTTP) is used for certificate fetching, and tells all traffic to try HTTPS instead (by sending them a redirect response).
Port 443 handles HTTPS. We open this for both tcp and udp because udp supports a better protocol.

Caddy also provides compression to the text-like content to the next server, should be faster idk.

## Config

The config is stored at `(/opt/infra/)config/prod/g_web/Caddyfile`, not the system default (`/etc/caddy/Caddyfile`). The caddy service has a drop-in that points it to our in-repo config.
This should use tabs, because otherwise the validation command complains (he's a bit fussy).

You must also set the domain name in `environ/caddy_caddy`.

## Editing

When you're making changes to the Caddyfile, uncomment the `acme_ca` line. This switches it to the testing/"staging" server - means we don't get rate-limited.

After changing the Caddyfile:
```
export DOMAIN_NAME="..."  # We must set this so validate works
caddy validate --config /opt/infra/config/prod/g_web/Caddyfile
sudo systemctl reload caddy
```


# Switching CA (including from staging to real)

To check the certificate being served:
`echo | openssl s_client -connect g-dem.net:443 -servername g-dem.net 2>/dev/null | openssl x509 -noout -issuer`.

When you have changed the `acme_ca` setting, you must wipe the old certificates so Caddy knows to reload them:
```
# find the staging-issuer folder (name is derived from the ACME directory URL)
sudo find /var/lib/caddy/.local/share/caddy/certificates -maxdepth 1

# remove the staging cert for this domain (adjust path from the find output above if it differs)
sudo rm -rf "/var/lib/caddy/.local/share/caddy/certificates/acme-staging-v02.api.letsencrypt.org-directory/domain.name"

# full restart, not reload - reload won't necessarily re-scan storage and evict what's already cached in memory
sudo systemctl restart caddy
```
