FROM node:22-trixie-slim AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# ---- Install deps & build terminal ----
FROM base AS builder
WORKDIR /app

# Copy manifests first for better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/tsconfig/package.json packages/tsconfig/
COPY apps/terminal/package.json apps/terminal/

RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/ packages/
COPY apps/terminal/ apps/terminal/

# Build shared, then terminal
RUN pnpm --filter=@onezone/shared build
RUN pnpm --filter=@onezone/terminal build

# Create a self-contained production deployment
RUN pnpm deploy --filter=@onezone/terminal --prod /deploy

# ---- Runtime image ----
FROM node:22-trixie-slim

# Which agent CLIs the terminal worker should install at runtime.
# Passed through to docker-entrypoint.sh as env vars.
ARG INSTALL_CLAUDE_CODE=true
ARG INSTALL_COPILOT_CLI=true
ENV INSTALL_CLAUDE_CODE=$INSTALL_CLAUDE_CODE
ENV INSTALL_COPILOT_CLI=$INSTALL_COPILOT_CLI

# Install system dependencies
RUN apt-get update && apt-get install -y \
  git \
  curl \
  jq \
  zstd \
  nano \
  dumb-init \
  procps \
  && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && apt-get update && apt-get install -y gh \
  && rm -rf /var/lib/apt/lists/*

# Install locally built onezone-terminal (as root)
COPY --from=builder /deploy /opt/onezone-terminal
RUN chmod +x /opt/onezone-terminal/bin/run.js \
  && ln -s /opt/onezone-terminal/bin/run.js /usr/local/bin/onezone-terminal

ARG USER_UID=1000
ARG USER_GID=1000

# Rename the default 'node' user to 'agent' and set the UID and GID
COPY apps/terminal/docker-entrypoint.sh /home/agent/docker-entrypoint.sh
RUN chmod +x /home/agent/docker-entrypoint.sh \
  && groupmod -g $USER_GID node \
  && usermod -u $USER_UID -g $USER_GID -d /home/agent -l agent node \
  && chown -R $USER_UID:$USER_GID /home/agent
USER ${USER_UID}:${USER_GID}

# Add ~/.local/bin to PATH (Claude Code, RTK, uv installed at container start via entrypoint)
ENV PATH="/home/agent/.local/bin:$PATH"
ENV RTK_TELEMETRY_DISABLED=1

WORKDIR /home/agent

# Pre-create writable directories as agent user
RUN mkdir -p /home/agent/.onezone/projects \
  && mkdir -p /home/agent/.local/bin \
  && mkdir -p /home/agent/.local/share \
  && mkdir -p /home/agent/.claude \
  && mkdir -p /home/agent/.copilot

# Trust GitHub's host key
RUN mkdir -p /home/agent/.ssh \
  && ssh-keyscan github.com >> /home/agent/.ssh/known_hosts \
  && chmod 700 /home/agent/.ssh \
  && chmod 644 /home/agent/.ssh/known_hosts

ENV TERMINAL_NAME="Docker Terminal"
ENV TERMINAL_SERVER_URL="http://localhost:5026"

ENTRYPOINT ["dumb-init", "--", "/home/agent/docker-entrypoint.sh"]