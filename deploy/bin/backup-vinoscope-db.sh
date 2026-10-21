#!/bin/bash
# Nightly VinoScope database dump, keeping the last 14. Runs as the postgres user
# (deploy/systemd/vinoscope-db-backup.{service,timer}).
#
# Restore one (this replaces the current data):
#   sudo systemctl stop vinoscope-api
#   sudo -u postgres pg_restore --clean --if-exists -d vinoscope /var/backups/vinoscope/<file>.dump
#   sudo systemctl start vinoscope-api
set -euo pipefail

BACKUP_DIR="/var/backups/vinoscope"
KEEP_DAYS=14

file="$BACKUP_DIR/vinoscope-$(date +%F).dump"
pg_dump --format=custom --file="$file.partial" vinoscope
mv "$file.partial" "$file"
find "$BACKUP_DIR" -name 'vinoscope-*.dump' -mtime +"$KEEP_DAYS" -delete
echo "Backed up to $file ($(du -h "$file" | cut -f1))"
