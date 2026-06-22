#!/usr/bin/env bash
#
# Onezone installer
#
#   1. Verifies Docker and Docker Compose are installed and the daemon is running.
#   2. Ensures a .env file exists (copies from .env.example if missing — never
#      modifies an existing one).
#   3. Builds and starts the full stack, waits for health, prints URLs.
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$ROOT_DIR/.env"
EXAMPLE_FILE="$ROOT_DIR/.env.example"

# Colors
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m'
BOLD=$'\033[1m'
DIM=$'\033[2m'
RESET=$'\033[0m'

info()  { printf "${CYAN}ℹ${RESET}  %s\n" "$*"; }
ok()    { printf "${GREEN}✓${RESET}  %s\n" "$*"; }
warn()  { printf "${YELLOW}⚠${RESET}  %s\n" "$*"; }
err()   { printf "${RED}✗${RESET}  %s\n" "$*" >&2; }
step()  { printf "\n${BOLD}=== %s ===${RESET}\n" "$*"; }

# ---------------------------------------------------------------------------
# 1. Docker & Docker Compose checks
# ---------------------------------------------------------------------------
step "Checking Docker"

if ! command -v docker >/dev/null 2>&1; then
  err "Docker is not installed or not on your PATH."
  err "Install Docker Desktop or the Docker Engine: https://docs.docker.com/get-docker/"
  exit 1
fi
ok "Docker found: $(docker --version)"

if ! docker compose version >/dev/null 2>&1; then
  err "Docker Compose v2 is not available."
  err "Install the 'docker compose' plugin: https://docs.docker.com/compose/install/"
  exit 1
fi
ok "Docker Compose v2 found: $(docker compose version --short)"

if ! docker info >/dev/null 2>&1; then
  err "The Docker daemon is not running."
  err "Start Docker Desktop or run 'sudo systemctl start docker'."
  exit 1
fi
ok "Docker daemon is running"

# ---------------------------------------------------------------------------
# 2. Ensure .env exists (never modify an existing one)
# ---------------------------------------------------------------------------
step "Checking environment file"

if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$EXAMPLE_FILE" ]; then
    cp "$EXAMPLE_FILE" "$ENV_FILE"
    ok "Created .env from .env.example"
    warn "Review $ENV_FILE and fill in your credentials before continuing."
    warn "In particular, set JWT_SECRET and any ANTHROPIC_* / COPILOT_* values."
    echo
    read -r -p "Press Enter once you've edited .env, or Ctrl+C to abort… " </dev/tty
  else
    err "No .env file and no .env.example to copy from."
    err "Create a .env file manually. See the README for required variables."
    exit 1
  fi
else
  ok ".env already exists — using it as-is"
fi

# ---------------------------------------------------------------------------
# 3. Build & start the stack
# ---------------------------------------------------------------------------
step "Building and starting containers"

info "Pulling base images and building (this may take a few minutes on first run)…"
info "Credentials are read from .env (not modified by this script)."

cd "$ROOT_DIR"
docker compose up --build -d

# ---------------------------------------------------------------------------
# 4. Wait for health & print summary
# ---------------------------------------------------------------------------
step "Waiting for services"

info "Waiting for the API health check…"
for _ in $(seq 1 30); do
  if curl -sf http://localhost:5026/health >/dev/null 2>&1; then
    ok "API is healthy"
    break
  fi
  sleep 2
done

echo
printf "${GREEN}${BOLD}Onezone is up!${RESET}\n\n"
printf "  Web UI:   ${BOLD}http://localhost:5025${RESET}\n"
printf "  API:      ${BOLD}http://localhost:5026${RESET}\n"
printf "  Health:   ${BOLD}http://localhost:5026/health${RESET}\n\n"
printf "${DIM}Logs:    docker compose logs -f${RESET}\n"
printf "${DIM}Stop:    docker compose down${RESET}\n"
printf "${DIM}Reset:   docker compose down -v${RESET}\n"