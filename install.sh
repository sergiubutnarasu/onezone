#!/usr/bin/env bash
#
# Onezone installer
#
#   1. Verifies Docker and Docker Compose are installed and the daemon is running.
#   2. Ensures a .env file exists (copies from .env.example if missing — never
#      modifies an existing one).
#   3. Asks which agent CLIs the terminal worker should install (Claude Code,
#      GitHub Copilot CLI, or both).
#   4. Exports the selection as environment variables so docker compose passes
#      them as build args to the terminal image and runtime env vars to the
#      container.
#   5. Builds and starts the full stack, waits for health, prints URLs.
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
# 3. Agent selection
# ---------------------------------------------------------------------------
step "Select agent CLIs"

echo "  The terminal worker can install one or both agent CLIs."
echo "  Enter the numbers separated by spaces (e.g. \"1 2\"), or press Enter for all."
echo
echo "  ${BOLD}1)${RESET} Claude Code          (needs ANTHROPIC_* credentials in .env)"
echo "  ${BOLD}2)${RESET} GitHub Copilot CLI   (needs COPILOT_* credentials in .env)"
echo

read -r -p "Selection [1 2]: " selection </dev/tty

# Normalize selection into a set of flags
export INSTALL_CLAUDE_CODE=false
export INSTALL_COPILOT_CLI=false

if [ -z "${selection// /}" ]; then
  selection="1 2"
fi

for choice in $selection; do
  case "$choice" in
    1) INSTALL_CLAUDE_CODE=true ;;
    2) INSTALL_COPILOT_CLI=true ;;
    *) warn "Ignoring unknown choice: $choice" ;;
  esac
done

if [ "$INSTALL_CLAUDE_CODE" = false ] && [ "$INSTALL_COPILOT_CLI" = false ]; then
  err "No agents selected. At least one is required."
  exit 1
fi

# Re-export in case they were changed
export INSTALL_CLAUDE_CODE
export INSTALL_COPILOT_CLI

echo
[ "$INSTALL_CLAUDE_CODE" = true ] && ok "Claude Code will be installed"
[ "$INSTALL_COPILOT_CLI" = true ] && ok "GitHub Copilot CLI will be installed"

# ---------------------------------------------------------------------------
# 4. Build & start the stack
# ---------------------------------------------------------------------------
step "Building and starting containers"

info "Pulling base images and building (this may take a few minutes on first run)…"
info "Terminal image build args:"
info "  INSTALL_CLAUDE_CODE=$INSTALL_CLAUDE_CODE"
info "  INSTALL_COPILOT_CLI=$INSTALL_COPILOT_CLI"
info "Credentials are read from .env (not modified by this script)."

cd "$ROOT_DIR"
# Shell-exported INSTALL_* vars are picked up by docker compose as build args
# (declared in docker-compose.yml under terminal.build.args) and as runtime
# env vars for the entrypoint to read.
docker compose up --build -d

# ---------------------------------------------------------------------------
# 5. Wait for health & print summary
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