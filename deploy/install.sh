#!/bin/bash
# Installs (or re-installs) VinoScope's server config from this repo onto the Pi:
# systemd units, the nginx site and its proxy snippet, and the backup folder.
# Safe to run again any time deploy/nginx or deploy/systemd changes:
#   sudo /home/chris/vinoscope/deploy/install.sh
set -euo pipefail

[[ $EUID -eq 0 ]] || { echo "Run with sudo." >&2; exit 1; }
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE="wines.chrisdeforest.dev"

echo "--- systemd units"
install -m 644 "$DEPLOY_DIR"/systemd/vinoscope-*.service "$DEPLOY_DIR"/systemd/vinoscope-*.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable vinoscope-api.service vinoscope-updater.timer vinoscope-db-backup.timer
systemctl start vinoscope-updater.timer vinoscope-db-backup.timer

echo "--- backup folder"
install -d -m 700 -o postgres -g postgres /var/backups/vinoscope

echo "--- nginx"
install -m 644 "$DEPLOY_DIR/nginx/vinoscope-proxy.conf" /etc/nginx/snippets/vinoscope-proxy.conf
install -m 644 "$DEPLOY_DIR/nginx/$SITE.conf" "/etc/nginx/sites-available/$SITE"
if [[ -f "/etc/letsencrypt/live/$SITE/fullchain.pem" ]]; then
  ln -sf "/etc/nginx/sites-available/$SITE" "/etc/nginx/sites-enabled/$SITE"
else
  echo "No certificate for $SITE yet, so the site is not enabled. Get one with:"
  echo "  sudo certbot certonly --nginx -d $SITE"
  echo "then run this script again."
fi
if nginx -t; then
  systemctl reload nginx
else
  echo "nginx config test FAILED. Nothing was reloaded; the sites keep running on the old config." >&2
  rm -f "/etc/nginx/sites-enabled/$SITE"
  exit 1
fi

echo "Done."
