# Deploying VinoScope to the Pi

Live at **https://wines.chrisdeforest.dev**, served from the Raspberry Pi next to the portfolio.

## How updates work

Push to `main` on GitHub. That's it. Every 15 minutes the Pi runs
`deploy/bin/update-vinoscope.sh`, which pulls and redeploys only what changed:

| What changed | What the Pi does |
|---|---|
| `frontend/**` | `npm ci` (if package files changed), build into a temp folder, swap it in (no half-built site) |
| `backend/requirements.txt` | `pip install` into the venv, then restart the API |
| `backend/**` | restart the API; new Alembic migrations run automatically before it starts |
| `deploy/nginx/**`, `deploy/systemd/**` | **not applied automatically**; you get an email to run `sudo ~/vinoscope/deploy/install.sh` |
| `data/cleaned/*.csv` | **not imported automatically** (it would overwrite admin edits); you get an email |
| `deploy/bin/*.sh` | nothing to do: the updater and backup scripts run straight from the repo |

If something fails, the live site stays on the previous version and you get one email per
failed commit (to `chris@chrisdeforest.dev`). Push a fix and the next run retries.

Production settings that ship with the repo:
- `frontend/.env.production`: same-origin API (`/api`) and the GA measurement ID
- `VINOSCOPE_ENV=production` (in `/etc/vinoscope.env`) turns off `/docs`, `/redoc`, `/openapi.json`

## What runs where

    visitor → Cloudflare → nginx (wines.chrisdeforest.dev)
                ├── /             frontend/dist (React app; /wines/*.webp are bottle photos)
                └── /api/*        rate limits → 60 s cache for reads → uvicorn 127.0.0.1:8000
                                                                       → PostgreSQL (localhost)

| Piece | Where |
|---|---|
| Code | `/home/chris/vinoscope` (this repo) |
| Python venv | `/home/chris/vinoscope/.venv` |
| Secrets | `/etc/vinoscope.env` (root-only, template: `deploy/vinoscope.env.example`) |
| API service | `vinoscope-api.service` (unprivileged, sandboxed; emails if it keeps failing) |
| Updater | `vinoscope-updater.timer` → `.service` (every 15 min, as chris) |
| DB backups | `vinoscope-db-backup.timer` → `/var/backups/vinoscope/` (nightly, last 14 kept) |
| nginx site | `/etc/nginx/sites-available/wines.chrisdeforest.dev` (from `deploy/nginx/`) |
| Admin allow-list | `/etc/nginx/snippets/home-network.conf` (Pi only) |
| Logs | `journalctl -u vinoscope-api`, `/var/log/vinoscope-updater/last-run.log`, `/var/log/nginx/wines_*.log` |

### nginx limits

| Requests | Limit per visitor |
|---|---|
| `/api/*` reads (search, filters, wine pages) | 10/s, burst 20; cached 60 s |
| `POST /api/recommendations` (quizzes) | 1/s, burst 5 |
| Writes (admin edits) and `/api/admin/*` | 30/min, burst 10 |

Over the limit → `429`. Repeat offenders are banned by fail2ban (nginx `deny`, 403).
Requests that send `X-Admin-Key` skip the cache, so the admin page always sees fresh data.
The `X-Cache-Status` response header shows `HIT`/`MISS` for API reads.

### Admin on the live site

There's no Admin link in production builds. Go to `/admin` directly. It works only from home:
nginx allows `/api/admin/*`, every edit (non-GET under `/api/`) and the `/api/admin-access`
check only for the addresses in `/etc/nginx/snippets/home-network.conf` (LAN + the home's static
public IP). Everyone else gets the 404 page and 403s. The admin key is still required.

That file is **only on the Pi** (this repo is public). If the home IP changes (move, new ISP):

    sudoedit /etc/nginx/snippets/home-network.conf     # update the "allow <ip>;" line
    sudo nginx -t && sudo systemctl reload nginx

Admin edits reach other visitors on their next page load, within 60 s (the API cache).

## Everyday commands (on the Pi)

    sudo systemctl start vinoscope-updater          # deploy now instead of waiting
    cat /var/log/vinoscope-updater/last-run.log     # what the last deploy did
    journalctl -u vinoscope-api -n 50               # API logs
    sudo systemctl restart vinoscope-api            # restart the API
    sudo ~/vinoscope/deploy/install.sh              # apply deploy/nginx or deploy/systemd changes

Retry a commit that failed to deploy, without pushing a new one:

    rm ~/.cache/vinoscope-failed-commit && sudo systemctl start vinoscope-updater

Roll the frontend back to the previous build instantly:

    cd ~/vinoscope/frontend && mv dist ~/.cache/vinoscope-dist.bad && mv ~/.cache/vinoscope-dist.previous dist

## Re-importing the wine data

The importer **updates every wine from the CSV**, so it overwrites edits made on the Admin
page for those wines. A backup is taken first:

    sudo systemctl start vinoscope-db-backup
    cd ~/vinoscope
    sudo bash -c 'set -a; . /etc/vinoscope.env; set +a; .venv/bin/python scripts/import_wines.py data/cleaned/wines_combined_500.csv'

## Database backups

Nightly at ~03:30 into `/var/backups/vinoscope/vinoscope-YYYY-MM-DD.dump`. Restore (replaces
the current data):

    sudo systemctl stop vinoscope-api
    sudo -u postgres pg_restore --clean --if-exists -d vinoscope /var/backups/vinoscope/<file>.dump
    sudo systemctl start vinoscope-api

## One-time setup (already done on the Pi; here for rebuilding it)

1. `sudo apt install postgresql`, then create the role and database:

       sudo -u postgres psql -c "CREATE ROLE vinoscope LOGIN PASSWORD '<random>'"
       sudo -u postgres createdb -O vinoscope vinoscope

2. `git clone git@github.com:ChrisDeForest/VinoScope.git /home/chris/vinoscope`
3. `/etc/vinoscope.env` from `deploy/vinoscope.env.example` (`sudo chmod 600`), with the DB
   password and `ADMIN_API_KEY=$(openssl rand -hex 32)`
4. `sudo systemctl start vinoscope-updater` once by hand. On a fresh clone it creates the venv,
   installs packages, builds the frontend. (The API restart fails until step 5 is done; that's expected.)
5. `sudo ~/vinoscope/deploy/install.sh` (units, timers, backup folder, nginx snippet)
6. `sudo systemctl start vinoscope-api` (creates the tables), then import the wines (above)
7. Cloudflare DNS: `wines` CNAME → `chrisdeforest.dev`, proxied
8. `sudo certbot certonly --nginx -d wines.chrisdeforest.dev`, then run `install.sh` again to
   enable the site
9. Add the site to `/usr/local/bin/nginx-healthcheck.sh`
