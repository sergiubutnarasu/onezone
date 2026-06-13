# Onezone Architecture

## System Overview

Onezone is a production-minded AI agent orchestration platform. It combines a Next.js dashboard, a NestJS API, a Socket.io real-time layer, and a terminal worker CLI so users can create projects, assign tasks, stream command output, monitor cost, and move work through kanban-style automation.

```mermaid
flowchart TB
    subgraph User["👤 User"]
        Browser["Browser"]
    end

    subgraph Infra["🖥️ Infrastructure (Docker Compose)"]
        subgraph Network["Internal Network"]
            Web["🌐 Web (Next.js)<br/>port 5025"]
            Server["⚙️ Server (NestJS)<br/>port 5026"]
            Terminal["🖥️ Terminal Worker (oclif CLI)"]
        end

        Postgres[("🐘 PostgreSQL 16<br/>port 5432")]
        Redis[("🔴 Redis 7<br/>port 6379")]
        Garage[("📦 Garage S3<br/>port 3900-3903")]
    end

    subgraph External["☁️ External / Host"]
        AgentCLIs["Agent CLIs<br/>claude / copilot"]
        GitHub["GitHub / Git repos"]
        LLMProviders["LLM Providers<br/>Anthropic / OpenAI / Azure"]
    end

    Browser -->|"HTTPS / HTTP<br/>NEXT_PUBLIC_API_URL"| Web
    Web -->|"REST + WebSocket<br/>with credentials"| Server
    Terminal -->|"REST (auth)<br/>Socket.io /chat"| Server
    Server -->|"Prisma Client"| Postgres
    Server -->|"@socket.io/redis-adapter"| Redis
    Server -->|"AWS S3 SDK<br/>forcePathStyle"| Garage
    Terminal -->|"spawns child processes"| AgentCLIs
    Terminal -->|"git clone / pull"| GitHub
    AgentCLIs -->|"API calls"| LLMProviders

    Web -.->|"Socket.io /chat<br/>role=user"| Redis
    Terminal -.->|"Socket.io /chat<br/>role=terminal"| Redis
```

## Monorepo Layout

```mermaid
flowchart LR
    Root["📁 onezone/"] --> Turbo["⚡ turbo.json"]
    Root --> Pnpm["📦 pnpm-workspace.yaml"]
    Root --> Compose["🐳 docker-compose.yml"]
    Root --> Apps["📁 apps/"]
    Root --> Packages["📁 packages/"]

    Apps --> WebApp["🌐 web/<br/>Next.js 16 + React 19"]
    Apps --> ServerApp["⚙️ server/<br/>NestJS 10"]
    Apps --> TerminalApp["🖥️ terminal/<br/>oclif CLI"]

    Packages --> SharedPkg["🔗 shared/<br/>types, schemas, constants"]
    Packages --> TsConfigPkg["🔧 tsconfig/<br/>base config"]

    WebApp -->|workspace:*| SharedPkg
    ServerApp -->|workspace:*| SharedPkg
    TerminalApp -->|workspace:*| SharedPkg
    WebApp -->|workspace:*| TsConfigPkg
    ServerApp -->|workspace:*| TsConfigPkg
    TerminalApp -->|workspace:*| TsConfigPkg
```

## Server Architecture (NestJS)

```mermaid
flowchart TB
    subgraph Server["⚙️ NestJS Server"]
        direction TB

        Bootstrap["main.ts<br/>bootstrap()"]
        AppModule["AppModule"]
        GlobalGuard["GlobalJwtGuard<br/>(APP_GUARD)"]
        Config["ConfigModule<br/>(isGlobal)"]
        Schedule["ScheduleModule<br/>(cron runner)"]

        subgraph Modules["Domain Modules"]
            Auth["AuthModule"]
            Projects["ProjectsModule"]
            Tasks["TasksModule"]
            Terminals["TerminalsModule"]
            Agents["AgentsModule"]
            Messages["MessagesModule"]
            Notifications["NotificationsModule"]
            Schedules["SchedulesModule"]
            Memory["MemoryModule"]
        end

        subgraph Gateway["🔌 Socket.io Gateway"]
            ChatGateway["ChatGateway<br/>namespace: /chat"]
            RedisAdapter["RedisIoAdapter"]
            SocketAuth["SocketAuthGuard"]
            TerminalRegistry["TerminalRegistryService"]
            MessageHandlers["Message Handlers"]
        end

        Prisma["PrismaModule<br/>(global)"]
        S3["S3Module"]
        Health["HealthController<br/>GET /health"]
    end

    Bootstrap --> AppModule
    AppModule --> Modules
    AppModule --> Gateway
    AppModule --> Prisma
    AppModule --> S3
    AppModule --> Health
    AppModule --> GlobalGuard
    AppModule --> Config
    AppModule --> Schedule

    ChatGateway --> RedisAdapter
    ChatGateway --> SocketAuth
    ChatGateway --> TerminalRegistry
    ChatGateway --> MessageHandlers

    Auth --> Prisma
    Projects --> Prisma
    Tasks --> Prisma
    Terminals --> Prisma
    Agents --> Prisma
    Messages --> Prisma
    Notifications --> Prisma
    Schedules --> Prisma
    Memory --> S3
```

## Authentication Flows

```mermaid
sequenceDiagram
    participant Browser as Browser / Web
    participant Server as NestJS Server
    participant DB as PostgreSQL
    participant Terminal as Terminal CLI

    %% Web session auth
    rect rgb(230, 245, 255)
        Note over Browser,DB: Web Session Auth (cookies)
        Browser->>Server: POST /auth/signup {email, password, name}
        Server->>DB: create user + refresh token hash
        Server-->>Browser: Set httpOnly cookies<br/>access_token + refresh_token
        Browser->>Server: GET /auth/me (cookie)
        Server-->>Browser: {id, email, name, isAdmin}
    end

    %% Device code flow for CLI
    rect rgb(255, 245, 230)
        Note over Terminal,DB: Terminal CLI Device Code Flow
        Terminal->>Server: POST /auth/device
        Server->>DB: create DeviceCode
        Server-->>Terminal: {device_code, user_code, verification_uri}
        Terminal->>Terminal: Display user_code
        Browser->>Server: POST /auth/activate {user_code} (cookie auth)
        Server->>DB: approve DeviceCode → link userId
        loop Poll every 5s
            Terminal->>Server: POST /auth/token {device_code}
            Server-->>Terminal: authorization_pending
        end
        Server-->>Terminal: {access_token, refresh_token}
        Terminal->>Terminal: Store in OS keychain<br/>or ~/.onezone/tokens.json
    end
```

## Real-Time Communication

```mermaid
flowchart LR
    subgraph WebSockets["🔌 Socket.io /chat namespace"]
        direction TB

        UserSocket["Browser socket<br/>role=user"]
        TerminalLobby["Terminal lobby socket<br/>role=terminal"]
        TerminalTask["Terminal task socket<br/>role=terminal"]

        RedisAdapter["Redis adapter<br/>pub/sub"]
        ChatGateway["ChatGateway"]
        Registry["TerminalRegistryService"]
    end

    UserSocket -->|join task:xxx| ChatGateway
    UserSocket -->|join project:xxx| ChatGateway
    TerminalLobby -->|join system:terminals| ChatGateway
    TerminalTask -->|join task:xxx| ChatGateway

    ChatGateway -->|uses| RedisAdapter
    ChatGateway -->|tracks| Registry

    Registry -->|assignTask| TerminalLobby
    Registry -->|forwardCommandRun| TerminalTask
    Registry -->|forwardStopCommand| TerminalTask
    Registry -->|forwardPingCommand| TerminalTask
```

### Socket Event Commands

| Direction | Event | Purpose |
|---|---|---|
| User → Server | `chat:message` | Send a chat/command to a task room |
| Server → Terminal | `terminal:command:run` | Forward saved user message to terminal |
| User → Server | `terminal:command:stop` | Request stop of a running job |
| Server → Terminal | `terminal:command:stop` | Forward stop to terminal |
| User → Server | `terminal:command:ping` | Send input to a running job stdin |
| Server → Terminal | `terminal:command:ping` | Forward ping to terminal |
| Terminal → Server | `output:line` | Stream stdout/stderr line |
| Terminal → Server | `terminal:command:start` | Notify command started |
| Terminal → Server | `terminal:command:exit` | Notify command exited |
| Server → All | `task:column-updated` | Kanban column change |
| Server → All | `notification:created` | New notification |
| Server → All | `project:cost-updated` | Cost stats update |
| Terminal → Server | `terminal:heartbeat` | Keep-alive ping |

## Terminal Worker Lifecycle

```mermaid
flowchart TB
    Start["onezone-terminal listen<br/>--name --server"] --> LoginCheck{"Authenticated?"}
    LoginCheck -->|No| Login["onezone-terminal login<br/>device code flow"]
    Login --> Register["registerTerminal()<br/>POST /terminals/register"]
    LoginCheck -->|Yes| Register

    Register --> Lobby["connectToLobby()<br/>Socket.io system:terminals"]
    Lobby --> Wait["Wait for AssignTask"]
    Wait -->|AssignTask received| TaskConn["connectToTask()<br/>Socket.io task:xxx"]

    TaskConn --> Setup["setupProject()<br/>clone repo, install skills"]
    Setup --> Agent["setupTerminalAgent()<br/>claude / copilot"]
    Agent --> Spawn["spawnCommand()<br/>run /onezone-runner"]

    Spawn --> Stream["Stream output:line<br/>command:start / command:exit"]
    Stream -->|Task completed / deleted| Cleanup["Cleanup & disconnect"]
    Stream -->|User sends chat| RunCmd["TerminalCommandRun<br/>spawn new command"]
    Stream -->|User stops job| StopCmd["TerminalCommandStop<br/>terminate process tree"]
```

## Data Model (Prisma)

```mermaid
erDiagram
    USER ||--o{ PROJECT : owns
    USER ||--o{ TASK : owns
    USER ||--o{ TERMINAL : owns
    USER ||--o{ NOTIFICATION : receives
    USER ||--o{ USER_AGENT_SETTING : has
    USER ||--o{ REFRESH_TOKEN : has
    USER ||--o{ DEVICE_CODE : creates

    PROJECT ||--o{ TASK : contains
    PROJECT ||--o{ KANBAN_COLUMN : has
    PROJECT ||--o{ PROJECT_SKILL : has
    PROJECT ||--o{ TASK_SCHEDULE : has
    PROJECT ||--o{ NOTIFICATION : generates

    AGENT ||--o{ PROJECT : defaultFor
    AGENT ||--o{ TASK : usedBy
    AGENT ||--o{ KANBAN_COLUMN : usedBy
    AGENT ||--o{ TASK_SCHEDULE : usedBy
    AGENT ||--o{ USER_AGENT_SETTING : configuredBy
    AGENT ||--o{ MESSAGE : usedBy

    TASK ||--o{ MESSAGE : has
    TASK ||--|| TASK_TERMINAL : assignedTo
    TASK ||--o| TASK_COLUMN : inColumn
    TASK ||--o{ NOTIFICATION : generates

    TERMINAL ||--o{ TASK_TERMINAL : assigned
    TERMINAL ||--o{ TASK_SCHEDULE : usedBy

    KANBAN_COLUMN ||--o{ TASK_COLUMN : contains
    KANBAN_COLUMN ||--o{ TASK_SCHEDULE : startsIn

    MESSAGE {
        string id
        string roomId
        string taskId
        string role
        MessageType messageType
        string content
        bigint ts
        int exitCode
        int inputTokens
        int outputTokens
        float totalCostUsd
    }
```

## Web App Structure

```mermaid
flowchart TB
    subgraph NextApp["🌐 Next.js App"]
        Layout["layout.tsx<br/>ThemeProvider + AuthProvider"]
        Providers["providers.tsx<br/>QueryClient + GlobalSocketListener"]
        AppShell["AppShell<br/>auth gate + navigation"]

        Pages["App Router Pages"]
        Pages --> Home["/ Projects list"]
        Pages --> Onboarding["/onboarding"]
        Pages --> ProjectPage["/projects/[id] Kanban"]
        Pages --> TaskChat["/projects/[id]/tasks/[taskId] Chat"]
        Pages --> Terminals["/terminals"]
        Pages --> Agents["/agents"]
        Pages --> Schedules["/schedules"]
        Pages --> Notifications["/notifications"]
        Pages --> Statistics["/statistics"]
        Pages --> Auth["/auth/login | /auth/register"]

        Hooks["Custom Hooks"]
        Hooks --> useGlobalSocket["useGlobalSocket"]
        Hooks --> useProjectTasksSocket["useProjectTasksSocket"]
        Hooks --> useTaskRoom["useTaskRoom"]

        Lib["Lib / API"]
        Lib --> httpClient["http-client.ts<br/>fetch + refresh"]
        Lib --> socketAuth["socket-auth.ts<br/>token refresh"]
        Lib --> api["api.ts<br/>typed endpoints"]
    end

    Layout --> Providers
    Providers --> AppShell
    AppShell --> Pages
    Pages --> Hooks
    Hooks --> Lib
```

## Request Flow Example: Create Task → Execute

```mermaid
sequenceDiagram
    actor User
    participant Web as Next.js Web
    participant Server as NestJS Server
    participant DB as PostgreSQL
    participant Redis as Redis
    participant Terminal as Terminal Worker
    participant Agent as claude / copilot

    User->>Web: Create task, pick terminal + column
    Web->>Server: POST /projects/:id/tasks
    Server->>DB: Create task + taskTerminal + taskColumn
    Server->>DB: Fetch task details
    Server->>Terminal: Socket.io AssignTask
    Server-->>Web: Task created

    Terminal->>Terminal: setupProject() clone repo, skills
    Terminal->>Terminal: setupTerminalAgent()
    Terminal->>Agent: spawn /onezone-runner
    Terminal->>Server: terminal:command:start
    Server->>DB: Save COMMAND_START message
    Server-->>Web: terminal:command:start

    loop Streaming output
        Agent-->>Terminal: stdout / stderr line
        Terminal->>Server: output:line
        Server->>DB: Save message
        Server-->>Web: output:line
    end

    Agent-->>Terminal: process exits
    Terminal->>Server: terminal:command:exit
    Server->>DB: Save COMMAND_EXIT + cost
    Server->>DB: Update task completed / column
    Server-->>Web: terminal:command:exit
    Server-->>Web: task:column-updated
    Server-->>Web: notification:created
    Server-->>Web: project:cost-updated
```

## Deployment Notes

- The server exposes REST and Socket.io on the same port. A reverse proxy must support WebSocket upgrades.
- `NEXT_PUBLIC_API_URL` is baked into the web Docker image at build time.
- The server applies Prisma migrations and seeds reference agents on container start.
- The terminal container installs `claude`, `copilot`, `uv`, and `rtk` at runtime via `docker-entrypoint.sh` so tools are persisted in volumes.
- Redis is used only for Socket.io horizontal scaling; the adapter is optional for a single server instance but required for multi-replica deployments.
