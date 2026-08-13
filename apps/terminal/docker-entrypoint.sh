#!/bin/sh
set -e

# Ensure Claude config directory exists in the persisted /home/agent/.claude volume.
mkdir -p /home/agent/.claude

# Ensure Copilot config directory exists in the persisted /home/agent/.copilot volume.
mkdir -p /home/agent/.copilot

# Ensure Opencode config directory exists in the persisted /home/agent/.opencode volume.
mkdir -p /home/agent/.opencode

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
