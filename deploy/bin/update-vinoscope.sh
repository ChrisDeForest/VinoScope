#!/bin/bash
# Pulls VinoScope from GitHub and redeploys whatever changed since the last deploy.
# Runs as chris every 15 minutes (deploy/systemd/vinoscope-updater.{service,timer}).
#
#   frontend/ changed          -> npm ci (if needed) + build next to the live site, then swap it in
#   backend/requirements.txt   -> pip install into the venv
#   backend/ changed           -> restart the API (which applies new migrations first)
#   deploy/nginx|systemd       -> NOT applied automatically: emails a reminder to run deploy/install.sh
#   data/cleaned/*.csv         -> NOT imported automatically (it would overwrite admin edits): emails a reminder
#
# Everything is inside main() so bash reads the whole script before running it. That matters
# because "git reset" below may rewrite this very file mid-run.
set -Eeuo pipefail

main() {
  local EMAIL="chris@chrisdeforest.dev"
  local REPO_DIR="/home/chris/vinoscope"
  local FRONTEND_DIR="$REPO_DIR/frontend"
  local VENV="$REPO_DIR/.venv"
  local BUILD_DIR="/home/chris/.cache/vinoscope-build"
  local LIVE_DIR="$FRONTEND_DIR/dist"
  local PREVIOUS_DIR="/home/chris/.cache/vinoscope-dist.previous"
  local LOGFILE="/var/log/vinoscope-updater/last-run.log"
  local NODE_VERSION="24.4.0"
  # Last commit that deployed successfully, and a commit that failed (so it's only emailed once)
  local DEPLOYED_FILE="/home/chris/.cache/vinoscope-deployed-commit"
  local FAILED_FILE="/home/chris/.cache/vinoscope-failed-commit"
  local NEW=""

  fail() {
    echo "Error: $1"
    [[ -n "$NEW" ]] && echo "$NEW" > "$FAILED_FILE"
    mail -s "VinoScope update failed: $1" "$EMAIL" < "$LOGFILE" || true
    exit "${2:-1}"
  }

  notify() {
    echo "Note: $1"
    { echo "$2"; echo; echo "--- log ---"; cat "$LOGFILE"; } | mail -s "VinoScope: $1" "$EMAIL" || true
  }

  exec > >(tee "$LOGFILE") 2>&1
  echo "=== $(date -Iseconds) ==="
  cd "$REPO_DIR" || fail "Repo not found at $REPO_DIR" 1

  mkdir -p /home/chris/.cache
  git fetch origin main || fail "git fetch" 2
  local OLD
  NEW=$(git rev-parse origin/main)
  OLD=$(cat "$DEPLOYED_FILE" 2>/dev/null || git rev-parse HEAD)
  echo "deployed: $OLD"
  echo "github:   $NEW"

  if [[ "$NEW" == "$(cat "$FAILED_FILE" 2>/dev/null)" ]]; then
    echo "This commit already failed to deploy (emailed). Waiting for a new commit."
    echo "To retry it anyway: rm $FAILED_FILE && sudo systemctl start vinoscope-updater"
    exit 0
  fi

  # Also (re)build anything missing, e.g. on the very first run
  local need_frontend=0 need_pip=0 need_restart=0
  [[ -f "$LIVE_DIR/index.html" ]] || need_frontend=1
  [[ -x "$VENV/bin/uvicorn" ]] || need_pip=1

  local CHANGED=""
  if [[ "$OLD" != "$NEW" ]]; then
    git reset --hard origin/main || fail "git reset to origin/main" 2
    if git cat-file -e "$OLD^{commit}" 2>/dev/null; then
      CHANGED=$(git diff --name-only "$OLD" "$NEW")
    else
      # Last deployed commit no longer exists (e.g. history was rewritten): redeploy everything
      CHANGED=$(git ls-files)
    fi
    echo "changed files:"; echo "$CHANGED" | sed 's/^/  /'
    grep -q '^frontend/' <<< "$CHANGED" && need_frontend=1
    grep -qx 'backend/requirements.txt' <<< "$CHANGED" && need_pip=1
    grep -q '^backend/' <<< "$CHANGED" && need_restart=1
  fi

  if (( !need_frontend && !need_pip && !need_restart )); then
    echo "$NEW" > "$DEPLOYED_FILE"
    echo "No updates."
    exit 0
  fi

  if (( need_pip )); then
    echo "--- Python dependencies"
    [[ -d "$VENV" ]] || python3 -m venv "$VENV" || fail "creating the venv" 3
    "$VENV/bin/pip" install --quiet --upgrade pip || fail "pip upgrade" 3
    "$VENV/bin/pip" install --quiet -r "$REPO_DIR/backend/requirements.txt" || fail "pip install" 3
    need_restart=1
  fi

  if (( need_restart )); then
    echo "--- Restarting the API (runs migrations first)"
    sudo systemctl restart vinoscope-api.service || fail "API restart (see: journalctl -u vinoscope-api)" 4
    sleep 3
    systemctl is-active --quiet vinoscope-api.service || fail "API not running after restart" 4
  fi

  if (( need_frontend )); then
    echo "--- Frontend build"
    export NVM_DIR="/home/chris/.nvm"
    # shellcheck disable=SC1091
    . "$NVM_DIR/nvm.sh"
    nvm use "$NODE_VERSION" >/dev/null || fail "nvm use $NODE_VERSION" 5
    cd "$FRONTEND_DIR"
    if [[ ! -d node_modules ]] || grep -qE '^frontend/package(-lock)?\.json$' <<< "$CHANGED"; then
      npm ci || fail "npm ci" 5
    fi
    rm -rf "$BUILD_DIR"
    npx tsc -b || fail "TypeScript build" 5
    npx vite build --outDir "$BUILD_DIR" --emptyOutDir || fail "Vite build" 5
    [[ -f "$BUILD_DIR/index.html" ]] || fail "build produced no index.html" 5
    # Swap: two renames, so visitors never see a half-built site. The old build is kept for rollback.
    rm -rf "$PREVIOUS_DIR"
    if [[ -d "$LIVE_DIR" ]]; then mv "$LIVE_DIR" "$PREVIOUS_DIR"; fi
    mv "$BUILD_DIR" "$LIVE_DIR" || fail "swapping in the new build" 6
    cd "$REPO_DIR"
  fi

  if grep -qE '^deploy/(nginx|systemd)/' <<< "$CHANGED"; then
    notify "server config changed, run install.sh" \
      "deploy/nginx or deploy/systemd changed in $(git rev-parse --short HEAD). Those aren't applied automatically. On the Pi run:  sudo /home/chris/vinoscope/deploy/install.sh"
  fi
  if grep -qE '^data/cleaned/.*\.csv$' <<< "$CHANGED"; then
    notify "wine data changed, import not run" \
      "data/cleaned changed. Importing overwrites admin edits, so it isn't automatic. See deploy/README.md, 'Re-importing the wine data'."
  fi

  echo "$NEW" > "$DEPLOYED_FILE"
  rm -f "$FAILED_FILE"
  echo "Deployed $(git rev-parse --short HEAD)."
}

main "$@"
exit
