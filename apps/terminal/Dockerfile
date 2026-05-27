FROM node:22-trixie-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
  git \
  curl \
  jq \
  zstd \
  nano \
  procps \
  && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && apt-get update && apt-get install -y gh \
  && rm -rf /var/lib/apt/lists/*

# Install onezone-terminal globally (as root)
RUN npm install -g @onezone/terminal@0.0.11

ARG USER_UID=1000
ARG USER_GID=1000

# Rename the default 'node' user to 'agent' and set the UID and GID
COPY docker-entrypoint.sh /home/agent/docker-entrypoint.sh
RUN chmod +x /home/agent/docker-entrypoint.sh \
  && groupmod -g $USER_GID node \
  && usermod -u $USER_UID -g $USER_GID -d /home/agent -l agent node \
  && chown -R $USER_UID:$USER_GID /home/agent
USER ${USER_UID}:${USER_GID}

# Add ~/.local/bin to PATH (Claude Code, RTK, uv, semble installed at container start via entrypoint)
ENV PATH="/home/agent/.local/bin:$PATH"
ENV RTK_TELEMETRY_DISABLED=1

WORKDIR /home/agent

# Pre-create writable directories as agent user
RUN mkdir -p /home/agent/.onezone/projects \
  && mkdir -p /home/agent/.local/bin \
  && mkdir -p /home/agent/.local/share

# Trust GitHub's host key
RUN mkdir -p /home/agent/.ssh \
  && ssh-keyscan github.com >> /home/agent/.ssh/known_hosts \
  && chmod 700 /home/agent/.ssh \
  && chmod 644 /home/agent/.ssh/known_hosts

ENV TERMINAL_NAME="Docker Terminal"
ENV TERMINAL_SERVER_URL="http://localhost:5026"

ENTRYPOINT ["/home/agent/docker-entrypoint.sh"]