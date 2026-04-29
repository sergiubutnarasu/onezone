```
COPILOT_PROVIDER_BASE_URL=http://localhost:11434/v1 COPILOT_PROVIDER_API_KEY= COPILOT_PROVIDER_WIRE_API=responses COPILOT_MODEL=gemma4:31b-cloud copilot --yolo -p "Check your permission on the current directory"

COPILOT_PROVIDER_BASE_URL=http://localhost:11434/v1 COPILOT_PROVIDER_API_KEY= COPILOT_PROVIDER_WIRE_API=responses COPILOT_MODEL=gemma4:31b-cloud copilot --yolo -p "Create test folder"

COPILOT_PROVIDER_BASE_URL=http://localhost:11434/v1 COPILOT_PROVIDER_API_KEY= COPILOT_PROVIDER_WIRE_API=responses COPILOT_MODEL=gemma4:31b-cloud copilot -p "What's you current user and permissions"

ANTHROPIC_AUTH_TOKEN=ollama ANTHROPIC_BASE_URL=http://localhost:11434 ANTHROPIC_API_KEY="" claude --model gemma4:31b-cloud --dangerously-skip-permissions -p "run: mkdir test && echo 'Created test folder' && ls -la"

ANTHROPIC_AUTH_TOKEN=ollama ANTHROPIC_BASE_URL=http://localhost:11434 ANTHROPIC_API_KEY="" claude --model kimi-k2.6:cloud --dangerously-skip-permissions -p "run: mkdir test && echo 'Created test folder' && ls -la"
```