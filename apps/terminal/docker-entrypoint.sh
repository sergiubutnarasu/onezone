#!/bin/sh
set -e

# Install Claude Code if not present (persisted in /home/agent/.local volume)
if ! command -v claude >/dev/null 2>&1; then
  echo "Installing Claude Code..."
  curl -fsSL https://claude.ai/install.sh | bash
fi

# Install uv if not present
if ! command -v uv >/dev/null 2>&1; then
  echo "Installing uv..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
fi

# Install RTK if not present
if ! command -v rtk >/dev/null 2>&1; then
  echo "Installing RTK..."
  curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
  rtk init -g --auto-patch
fi

# Ensure .ssh dir exists with correct permissions
mkdir -p /home/agent/.ssh
chmod 700 /home/agent/.ssh

# Re-add GitHub's host key if not present (volume may have replaced known_hosts)
if ! grep -q "github.com" /home/agent/.ssh/known_hosts 2>/dev/null; then
  ssh-keyscan github.com >> /home/agent/.ssh/known_hosts 2>/dev/null
  chmod 644 /home/agent/.ssh/known_hosts
fi

# Write a default SSH config if one doesn't exist yet
if [ ! -f /home/agent/.ssh/config ]; then
  cat > /home/agent/.ssh/config <<'EOF'
Host *
  AddKeysToAgent yes
  IdentityFile ~/.ssh/github
EOF
  chmod 600 /home/agent/.ssh/config
fi

# Check if already authenticated; if not, run login first
if ! onezone-terminal whoami --server "${TERMINAL_SERVER_URL}" 2>/dev/null; then
  onezone-terminal login --server "${TERMINAL_SERVER_URL}"
fi

exec onezone-terminal listen --name "${TERMINAL_NAME}" --server "${TERMINAL_SERVER_URL}"
