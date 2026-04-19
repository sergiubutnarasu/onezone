# OneZone Agent Runner — Implementation Plan

## Goal
Build a Turborepo monorepo with a NestJS WebSocket server (Redis-backed), oclif CLI agent, and Next.js frontend where users create projects/tasks and CLI agents stream process output in real time to a shared task chat room.

## Prerequisites
Make sure you are currently on the `feat/onezone-agent-runner` branch before beginning.
If not, run:
```bash
git checkout -b feat/onezone-agent-runner
```

---

### Step-by-Step Instructions

---

#### Step 1: Monorepo Scaffold + Infrastructure

- [x] Create the root `package.json`:

```json
// package.json
{
  "name": "onezone",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "clean": "turbo run clean"
  },
  "devDependencies": {
    "turbo": "^2.0.14",
    "typescript": "^5.5.4",
    "@types/node": "^22.5.0"
  },
  "engines": {
    "node": ">=22.0.0",
    "pnpm": ">=9.0.0"
  },
  "packageManager": "pnpm@9.12.0"
}
```

- [x] Create `pnpm-workspace.yaml`:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [x] Create `turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

- [x] Create `.nvmrc`:

```
22
```

- [x] Create `.gitignore`:

```
node_modules/
dist/
.next/
.turbo/
*.env
*.env.local
.DS_Store
```

- [x] Create `.env.example`:

```
DATABASE_URL=postgresql://onezone:onezone@localhost:5432/onezone
REDIS_URL=redis://localhost:6379
```

- [x] Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

- [x] Create `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: onezone
      POSTGRES_USER: onezone
      POSTGRES_PASSWORD: onezone
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

- [x] Run `pnpm install` from the repo root to initialize the workspace.
- [x] Run `docker compose up -d` to start PostgreSQL and Redis.

##### Step 1 Verification Checklist
- [ ] `pnpm install` completes with no errors
- [ ] `docker compose ps` shows both `postgres` and `redis` as running/healthy
- [ ] `docker compose logs postgres` shows "database system is ready to accept connections"

#### Step 1 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

---

#### Step 2: Shared Package (`packages/shared`)

- [x] Create directory structure: `packages/tsconfig/` and `packages/shared/src/`

- [x] Create `packages/tsconfig/package.json`:

```json
{
  "name": "@onezone/tsconfig",
  "version": "0.0.1",
  "private": true,
  "license": "MIT",
  "publishConfig": {
    "access": "public"
  }
}
```

- [x] Create `packages/tsconfig/tsconfig.base.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "display": "Default",
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleDetection": "force"
  }
}
```

- [x] Create `packages/shared/package.json`:

```json
{
  "name": "@onezone/shared",
  "version": "0.0.1",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@onezone/tsconfig": "workspace:*",
    "typescript": "^5.5.4"
  }
}
```

- [x] Create `packages/shared/tsconfig.json`:

```json
{
  "extends": "@onezone/tsconfig/tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [x] Create `packages/shared/src/types.ts`:

```typescript
export type MessageRole = 'user' | 'agent' | 'system';
export type MessageStream = 'stdout' | 'stderr';

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  createdAt: string;
}

export interface Message {
  id: string;
  roomId: string;
  taskId: string;
  role: MessageRole;
  agentId?: string | null;
  agentName?: string | null;
  command?: string | null;
  stream?: MessageStream | null;
  content: string;
  ts: number;
  createdAt: string;
}

export interface AgentInfo {
  agentId: string;
  agentName: string;
  taskId: string;
}
```

- [x] Create `packages/shared/src/events.ts`:

```typescript
import type { Message, AgentInfo } from './types';

// Events emitted by clients (user or agent) to the server
export interface ClientToServerEvents {
  'chat:message': (payload: {
    roomId: string;
    content: string;
  }) => void;

  'output:line': (payload: {
    roomId: string;
    agentId: string;
    agentName: string;
    command?: string;
    stream: 'stdout' | 'stderr';
    content: string;
  }) => void;

  'agent:connected': (payload: {
    roomId: string;
    agentId: string;
    agentName: string;
  }) => void;

  'agent:command:start': (payload: {
    roomId: string;
    agentId: string;
    agentName: string;
    command: string;
  }) => void;

  'agent:command:exit': (payload: {
    roomId: string;
    agentId: string;
    command: string;
    exitCode: number;
  }) => void;
}

// Events emitted by the server to clients
export interface ServerToClientEvents {
  'chat:message': (message: Message) => void;
  'output:line': (message: Message) => void;
  'agent:connected': (info: AgentInfo & { ts: number }) => void;
  'agent:disconnected': (info: AgentInfo & { ts: number }) => void;
  'agent:command:start': (payload: { agentId: string; agentName: string; command: string; ts: number }) => void;
  'agent:command:exit': (payload: { agentId: string; command: string; exitCode: number; ts: number }) => void;
}

// Auth data sent in socket handshake
export interface SocketAuth {
  taskId: string;
  role: 'user' | 'agent';
  agentId?: string;
  agentName?: string;
}
```

- [x] Create `packages/shared/src/schemas.ts`:

```typescript
import { z } from 'zod';

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
});

export const CreateTaskSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
});

export const SocketAuthSchema = z.object({
  taskId: z.string().uuid(),
  role: z.enum(['user', 'agent']),
  agentId: z.string().optional(),
  agentName: z.string().optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type SocketAuthInput = z.infer<typeof SocketAuthSchema>;
```

- [x] Create `packages/shared/src/index.ts`:

```typescript
export * from './types';
export * from './events';
export * from './schemas';
```

- [x] Run `pnpm install` from the repo root to link workspace packages.
- [x] Build the shared package:

```bash
pnpm --filter @onezone/shared build
```

##### Step 2 Verification Checklist
- [x] `pnpm --filter @onezone/shared build` exits with code 0
- [x] `packages/shared/dist/index.js` and `packages/shared/dist/index.d.ts` exist

#### Step 2 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

---

#### Step 3: NestJS Server — REST API + Database

- [x] Create `apps/server/` directory structure:
  - `apps/server/src/prisma/`
  - `apps/server/src/projects/`
  - `apps/server/src/tasks/`
  - `apps/server/src/messages/`
  - `apps/server/prisma/`

- [x] Create `apps/server/package.json`:

```json
{
  "name": "@onezone/server",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "start": "node dist/main",
    "lint": "eslint \"{src,test}/**/*.ts\"",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.4",
    "@nestjs/config": "^3.2.3",
    "@nestjs/core": "^10.4.4",
    "@nestjs/mapped-types": "^2.0.5",
    "@nestjs/platform-express": "^10.4.4",
    "@nestjs/platform-socket.io": "^10.4.4",
    "@nestjs/websockets": "^10.4.4",
    "@onezone/shared": "workspace:*",
    "@prisma/client": "^5.20.0",
    "@socket.io/redis-adapter": "^8.3.0",
    "redis": "^4.7.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "socket.io": "^4.8.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.5",
    "@nestjs/schematics": "^10.1.4",
    "@onezone/tsconfig": "workspace:*",
    "@types/node": "^22.5.0",
    "prisma": "^5.20.0",
    "typescript": "^5.5.4"
  }
}
```

- [x] Create `apps/server/tsconfig.json`:

```json
{
  "extends": "@onezone/tsconfig/tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": "./",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [x] Create `apps/server/nest-cli.json`:

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

- [x] Create `apps/server/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Project {
  id          String   @id @default(uuid())
  name        String
  description String?
  createdAt   DateTime @default(now())
  tasks       Task[]

  @@map("projects")
}

model Task {
  id          String    @id @default(uuid())
  projectId   String
  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name        String
  description String?
  createdAt   DateTime  @default(now())
  messages    Message[]

  @@index([projectId])
  @@map("tasks")
}

model Message {
  id        String   @id @default(uuid())
  roomId    String
  taskId    String
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  role      String
  agentId   String?
  agentName String?
  command   String?
  stream    String?
  content   String   @db.Text
  ts        BigInt
  createdAt DateTime @default(now())

  @@index([roomId])
  @@index([taskId])
  @@index([ts])
  @@map("messages")
}
```

- [x] Create `apps/server/src/prisma/prisma.service.ts`:

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

- [x] Create `apps/server/src/prisma/prisma.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [x] Create `apps/server/src/projects/projects.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { name: string; description?: string }) {
    return this.prisma.project.create({ data });
  }

  async findAll() {
    return this.prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.project.delete({ where: { id } });
  }
}
```

- [x] Create `apps/server/src/projects/projects.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: { name: string; description?: string }) {
    return this.projectsService.create(body);
  }

  @Get()
  findAll() {
    return this.projectsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }
}
```

- [x] Create `apps/server/src/projects/projects.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
```

- [x] Create `apps/server/src/tasks/tasks.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(projectId: string, data: { name: string; description?: string }) {
    return this.prisma.task.create({
      data: { ...data, projectId },
    });
  }

  async findAllByProject(projectId: string) {
    return this.prisma.task.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.task.delete({ where: { id } });
  }
}
```

- [x] Create `apps/server/src/tasks/tasks.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TasksService } from './tasks.service';

@Controller()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('projects/:projectId/tasks')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('projectId') projectId: string,
    @Body() body: { name: string; description?: string },
  ) {
    return this.tasksService.create(projectId, body);
  }

  @Get('projects/:projectId/tasks')
  findAll(@Param('projectId') projectId: string) {
    return this.tasksService.findAllByProject(projectId);
  }

  @Get('tasks/:taskId')
  findOne(@Param('taskId') taskId: string) {
    return this.tasksService.findOne(taskId);
  }

  @Delete('tasks/:taskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('taskId') taskId: string) {
    return this.tasksService.remove(taskId);
  }
}
```

- [x] Create `apps/server/src/tasks/tasks.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
```

- [x] Create `apps/server/src/messages/messages.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateMessageDto {
  roomId: string;
  taskId: string;
  role: string;
  agentId?: string;
  agentName?: string;
  command?: string;
  stream?: string;
  content: string;
  ts: number;
}

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMessageDto) {
    return this.prisma.message.create({
      data: {
        ...dto,
        ts: BigInt(dto.ts),
      },
    });
  }

  async findByTask(taskId: string) {
    const messages = await this.prisma.message.findMany({
      where: { taskId },
      orderBy: { ts: 'asc' },
    });
    // Convert BigInt ts to number for JSON serialization
    return messages.map((m) => ({ ...m, ts: Number(m.ts) }));
  }
}
```

- [x] Create `apps/server/src/messages/messages.controller.ts`:

```typescript
import { Controller, Get, Param } from '@nestjs/common';
import { MessagesService } from './messages.service';

@Controller('tasks/:taskId/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  findAll(@Param('taskId') taskId: string) {
    return this.messagesService.findByTask(taskId);
  }
}
```

- [x] Create `apps/server/src/messages/messages.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
```

- [x] Create `apps/server/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { MessagesModule } from './messages/messages.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ProjectsModule,
    TasksModule,
    MessagesModule,
  ],
})
export class AppModule {}
```

- [x] Create `apps/server/src/main.ts`:

```typescript
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  await app.listen(process.env.PORT || 3001);
  console.log(`Server running on http://localhost:${process.env.PORT || 3001}`);
}

bootstrap();
```

- [x] Install dependencies and run the initial migration:

```bash
pnpm install
cd apps/server
pnpm exec prisma migrate dev --name init
cd ../..
```

- [x] Build the server:
- [ ] `pnpm --filter @onezone/server build` exits with code 0
- [ ] Migration creates tables: `docker exec -it <postgres-container> psql -U onezone -d onezone -c "\dt"`
- [ ] Start server with `pnpm --filter @onezone/server dev`
- [ ] `curl -s -X POST http://localhost:3001/projects -H "Content-Type: application/json" -d '{"name":"Test Project"}' | jq .` returns a project object with an `id`
- [ ] `curl -s http://localhost:3001/projects | jq .` returns an array with the created project

#### Step 3 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

---

#### Step 4: NestJS Server — WebSocket Hub (Redis Adapter)

- [x] Create `apps/server/src/adapters/redis-io.adapter.ts`:

```typescript
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  async connectToRedis(): Promise<void> {
    const pubClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
```

- [x] Create `apps/server/src/gateways/chat.gateway.ts`:

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagesService } from '../messages/messages.service';
import { TasksService } from '../tasks/tasks.service';

interface AgentSocketMeta {
  taskId: string;
  role: 'user' | 'agent';
  agentId?: string;
  agentName?: string;
}

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Track agent metadata by socket id
  private socketMeta = new Map<string, AgentSocketMeta>();

  constructor(
    private readonly messagesService: MessagesService,
    private readonly tasksService: TasksService,
  ) {}

  async handleConnection(client: Socket) {
    const auth = client.handshake.auth as {
      taskId?: string;
      role?: string;
      agentId?: string;
      agentName?: string;
    };

    const taskId = auth?.taskId;
    const role = (auth?.role as 'user' | 'agent') || 'user';

    if (!taskId) {
      client.disconnect();
      return;
    }

    // Validate task exists
    try {
      await this.tasksService.findOne(taskId);
    } catch {
      client.disconnect();
      return;
    }

    const roomId = `task:${taskId}`;
    await client.join(roomId);

    const meta: AgentSocketMeta = {
      taskId,
      role,
      agentId: auth.agentId,
      agentName: auth.agentName,
    };
    this.socketMeta.set(client.id, meta);

    if (role === 'agent' && auth.agentId) {
      this.server.to(roomId).emit('agent:connected', {
        agentId: auth.agentId,
        agentName: auth.agentName || auth.agentId,
        taskId,
        ts: Date.now(),
      });
    }
  }

  async handleDisconnect(client: Socket) {
    const meta = this.socketMeta.get(client.id);
    if (meta && meta.role === 'agent' && meta.agentId) {
      const roomId = `task:${meta.taskId}`;
      this.server.to(roomId).emit('agent:disconnected', {
        agentId: meta.agentId,
        agentName: meta.agentName || meta.agentId,
        taskId: meta.taskId,
        ts: Date.now(),
      });
    }
    this.socketMeta.delete(client.id);
  }

  @SubscribeMessage('chat:message')
  async handleChatMessage(
    @MessageBody() data: { roomId: string; content: string },
    @ConnectedSocket() client: Socket,
  ) {
    const taskId = data.roomId.replace('task:', '');
    const ts = Date.now();

    const message = await this.messagesService.create({
      roomId: data.roomId,
      taskId,
      role: 'user',
      content: data.content,
      ts,
    });

    this.server.to(data.roomId).emit('chat:message', { ...message, ts: Number(message.ts) });
    return { status: 'ok' };
  }

  @SubscribeMessage('output:line')
  async handleOutputLine(
    @MessageBody()
    data: {
      roomId: string;
      agentId: string;
      agentName: string;
      command?: string;
      stream: 'stdout' | 'stderr';
      content: string;
    },
  ) {
    const taskId = data.roomId.replace('task:', '');
    const ts = Date.now();

    const message = await this.messagesService.create({
      roomId: data.roomId,
      taskId,
      role: 'agent',
      agentId: data.agentId,
      agentName: data.agentName,
      command: data.command,
      stream: data.stream,
      content: data.content,
      ts,
    });

    this.server.to(data.roomId).emit('output:line', { ...message, ts: Number(message.ts) });
    return { status: 'ok' };
  }

  @SubscribeMessage('agent:connected')
  handleAgentConnected(
    @MessageBody() data: { roomId: string; agentId: string; agentName: string },
  ) {
    this.server.to(data.roomId).emit('agent:connected', {
      agentId: data.agentId,
      agentName: data.agentName,
      taskId: data.roomId.replace('task:', ''),
      ts: Date.now(),
    });
    return { status: 'ok' };
  }

  @SubscribeMessage('agent:command:start')
  async handleCommandStart(
    @MessageBody()
    data: { roomId: string; agentId: string; agentName: string; command: string },
  ) {
    const taskId = data.roomId.replace('task:', '');
    const ts = Date.now();

    await this.messagesService.create({
      roomId: data.roomId,
      taskId,
      role: 'system',
      agentId: data.agentId,
      agentName: data.agentName,
      command: data.command,
      content: `[${data.agentName}] started: ${data.command}`,
      ts,
    });

    this.server.to(data.roomId).emit('agent:command:start', {
      agentId: data.agentId,
      agentName: data.agentName,
      command: data.command,
      ts,
    });
    return { status: 'ok' };
  }

  @SubscribeMessage('agent:command:exit')
  async handleCommandExit(
    @MessageBody()
    data: { roomId: string; agentId: string; command: string; exitCode: number },
  ) {
    const taskId = data.roomId.replace('task:', '');
    const ts = Date.now();

    const meta = [...this.socketMeta.values()].find(
      (m) => m.agentId === data.agentId,
    );

    await this.messagesService.create({
      roomId: data.roomId,
      taskId,
      role: 'system',
      agentId: data.agentId,
      agentName: meta?.agentName,
      command: data.command,
      content: `[${data.agentId}] exited with code ${data.exitCode}: ${data.command}`,
      ts,
    });

    this.server.to(data.roomId).emit('agent:command:exit', {
      agentId: data.agentId,
      command: data.command,
      exitCode: data.exitCode,
      ts,
    });
    return { status: 'ok' };
  }
}
```

- [x] Create `apps/server/src/gateways/gateways.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { MessagesModule } from '../messages/messages.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [MessagesModule, TasksModule],
  providers: [ChatGateway],
})
export class GatewaysModule {}
```

- [x] Update `apps/server/src/app.module.ts` to include `GatewaysModule`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { MessagesModule } from './messages/messages.module';
import { GatewaysModule } from './gateways/gateways.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ProjectsModule,
    TasksModule,
    MessagesModule,
    GatewaysModule,
  ],
})
export class AppModule {}
```

- [x] Update `apps/server/src/main.ts` to use the Redis adapter:

```typescript
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './adapters/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  await app.listen(process.env.PORT || 3001);
  console.log(`Server running on http://localhost:${process.env.PORT || 3001}`);
}

bootstrap();
```

- [x] Build and verify:

```bash
pnpm --filter @onezone/server build
```

##### Step 4 Verification Checklist
- [ ] `pnpm --filter @onezone/server build` exits with code 0
- [ ] Start server: `pnpm --filter @onezone/server dev`
- [ ] Server log shows "Server running on http://localhost:3001"
- [ ] Install `wscat` globally if needed: `npm install -g wscat`
- [ ] Create a test task first:
  ```bash
  PROJECT=$(curl -s -X POST http://localhost:3001/projects -H "Content-Type: application/json" -d '{"name":"Test"}' | jq -r .id)
  TASK=$(curl -s -X POST "http://localhost:3001/projects/$PROJECT/tasks" -H "Content-Type: application/json" -d '{"name":"Test Task"}' | jq -r .id)
  echo "Task ID: $TASK"
  ```
- [ ] Connect a user observer in terminal 1:
  ```bash
  wscat -c "ws://localhost:3001/chat" -x "{\"taskId\":\"$TASK\",\"role\":\"user\"}"
  ```
- [ ] Connect an agent in terminal 2 and emit a message — the user observer should receive it
- [ ] `curl -s http://localhost:3001/tasks/$TASK/messages | jq .` shows persisted messages

#### Step 4 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

---

#### Step 5: Agent CLI (`apps/agent`)

- [x] Create directory: `apps/agent/src/commands/` and `apps/agent/src/lib/` and `apps/agent/bin/`

- [x] Create `apps/agent/package.json`:

```json
{
  "name": "@onezone/agent",
  "version": "0.0.1",
  "private": true,
  "description": "OneZone Agent CLI",
  "type": "module",
  "bin": {
    "onezone-agent": "./bin/run.js"
  },
  "oclif": {
    "bin": "onezone-agent",
    "dirname": "onezone-agent",
    "commands": "./dist/commands",
    "topicSeparator": " "
  },
  "scripts": {
    "build": "tsc",
    "dev": "node --loader ts-node/esm ./bin/dev.js",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@oclif/core": "^4.0.27",
    "socket.io-client": "^4.8.0"
  },
  "devDependencies": {
    "@onezone/tsconfig": "workspace:*",
    "@types/node": "^22.5.0",
    "ts-node": "^10.9.2",
    "typescript": "^5.5.4"
  }
}
```

- [x] Create `apps/agent/tsconfig.json`:

```json
{
  "extends": "@onezone/tsconfig/tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [x] Create `apps/agent/bin/run.js`:

```javascript
#!/usr/bin/env node
import { execute } from '@oclif/core';

await execute({ development: false, dir: import.meta.url });
```

- [x] Create `apps/agent/bin/dev.js`:

```javascript
#!/usr/bin/env node
import { execute } from '@oclif/core';

await execute({ development: true, dir: import.meta.url });
```

- [x] Make bin files executable:

```bash
chmod +x apps/agent/bin/run.js apps/agent/bin/dev.js
```

- [x] Create `apps/agent/src/lib/process-runner.ts`:

```typescript
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

export type StreamType = 'stdout' | 'stderr';

export function runProcess(
  cmd: string,
  args: string[],
  onLine: (stream: StreamType, line: string) => void,
  onExit: (code: number) => void,
): void {
  const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  createInterface({ input: proc.stdout }).on('line', (line) =>
    onLine('stdout', line),
  );
  createInterface({ input: proc.stderr }).on('line', (line) =>
    onLine('stderr', line),
  );

  proc.on('close', (code) => onExit(code ?? -1));
  proc.on('error', (err) => {
    onLine('stderr', `Process error: ${err.message}`);
    onExit(-1);
  });
}
```

- [x] Create `apps/agent/src/lib/socket-client.ts`:

```typescript
import { io, Socket } from 'socket.io-client';

export interface AgentSocketOptions {
  serverUrl: string;
  taskId: string;
  agentId: string;
  agentName: string;
}

export function createAgentSocket(options: AgentSocketOptions): Socket {
  const { serverUrl, taskId, agentId, agentName } = options;

  const socket = io(`${serverUrl}/chat`, {
    auth: {
      taskId,
      role: 'agent',
      agentId,
      agentName,
    },
    reconnection: false,
  });

  return socket;
}
```

- [x] Create `apps/agent/src/commands/run.ts`:

```typescript
import { Args, Command, Flags } from '@oclif/core';
import { hostname } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createAgentSocket } from '../lib/socket-client.js';
import { runProcess } from '../lib/process-runner.js';

export default class Run extends Command {
  static description = 'Connect to a task room and run a command, streaming output in real time';

  static examples = [
    '<%= config.bin %> run --task <taskId> ffprobe -v quiet -print_format json -show_format input.mp4',
    '<%= config.bin %> run --task <taskId> --name my-agent ffmpeg -i input.mp4 output.mp4',
  ];

  static strict = false;

  static flags = {
    task: Flags.string({
      description: 'Task ID to connect to',
      required: true,
    }),
    server: Flags.string({
      description: 'Server URL',
      default: 'http://localhost:3001',
    }),
    name: Flags.string({
      description: 'Agent name (defaults to hostname)',
      default: hostname(),
    }),
    'agent-id': Flags.string({
      description: 'Agent ID (defaults to a random UUID)',
    }),
  };

  static args = {
    command: Args.string({
      description: 'Command to run',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { flags, argv } = await this.parse(Run);

    // Collect all argv after flags as the full command + args
    // oclif strict=false puts extra args in argv
    const allArgs = argv as string[];
    const cmdName = allArgs[0];
    const cmdArgs = allArgs.slice(1);

    if (!cmdName) {
      this.error('No command specified. Usage: onezone-agent run --task <id> <cmd> [args...]');
    }

    const agentId = flags['agent-id'] || randomUUID();
    const agentName = flags.name;
    const taskId = flags.task;
    const roomId = `task:${taskId}`;

    const socket = createAgentSocket({
      serverUrl: flags.server,
      taskId,
      agentId,
      agentName,
    });

    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => {
        this.log(`[${agentName}] Connected to ${flags.server} | room: ${roomId}`);

        socket.emit('agent:command:start', {
          roomId,
          agentId,
          agentName,
          command: [cmdName, ...cmdArgs].join(' '),
        });

        runProcess(
          cmdName,
          cmdArgs,
          (stream, line) => {
            socket.emit('output:line', {
              roomId,
              agentId,
              agentName,
              command: [cmdName, ...cmdArgs].join(' '),
              stream,
              content: line,
            });
            // Mirror to local terminal
            if (stream === 'stderr') {
              process.stderr.write(line + '\n');
            } else {
              process.stdout.write(line + '\n');
            }
          },
          (exitCode) => {
            socket.emit('agent:command:exit', {
              roomId,
              agentId,
              command: [cmdName, ...cmdArgs].join(' '),
              exitCode,
            });
            this.log(`[${agentName}] Command exited with code ${exitCode}`);
            socket.disconnect();
            resolve();
          },
        );
      });

      socket.on('connect_error', (err) => {
        reject(new Error(`Connection failed: ${err.message}`));
      });
    });
  }
}
```

- [x] Create `apps/agent/src/index.ts` (oclif entry point):

```typescript
export { run } from '@oclif/core';
```

- [x] Install dependencies and build:

```bash
pnpm install
pnpm --filter @onezone/agent build
```

##### Step 5 Verification Checklist
- [ ] `pnpm --filter @onezone/agent build` exits with code 0
- [ ] With the server running and a valid task ID, run:
  ```bash
  node apps/agent/bin/run.js run --task <TASK_ID> echo "hello from agent"
  ```
- [ ] Output line `hello from agent` appears in the console
- [ ] `curl -s http://localhost:3001/tasks/<TASK_ID>/messages | jq .` shows the agent output line persisted
- [ ] Run with `ffprobe` if available: `node apps/agent/bin/run.js run --task <TASK_ID> ffprobe -version`

#### Step 5 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

---

#### Step 6: Next.js Frontend (`apps/web`)

- [x] Scaffold Next.js 15 app:

```bash
pnpm create next-app apps/web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack
```

- [x] Update `apps/web/package.json` — add runtime dependencies (merge into the generated file):

```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.59.0",
    "socket.io-client": "^4.8.0"
  }
}
```

Run after editing:
```bash
pnpm install
```

- [x] Create `apps/web/src/lib/api.ts`:

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function fetchProjects() {
  const res = await fetch(`${API_BASE}/projects`);
  if (!res.ok) throw new Error('Failed to fetch projects');
  return res.json();
}

export async function createProject(data: { name: string; description?: string }) {
  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create project');
  return res.json();
}

export async function deleteProject(id: string) {
  const res = await fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete project');
}

export async function fetchProject(id: string) {
  const res = await fetch(`${API_BASE}/projects/${id}`);
  if (!res.ok) throw new Error('Failed to fetch project');
  return res.json();
}

export async function fetchTasks(projectId: string) {
  const res = await fetch(`${API_BASE}/projects/${projectId}/tasks`);
  if (!res.ok) throw new Error('Failed to fetch tasks');
  return res.json();
}

export async function createTask(
  projectId: string,
  data: { name: string; description?: string },
) {
  const res = await fetch(`${API_BASE}/projects/${projectId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create task');
  return res.json();
}

export async function fetchTask(taskId: string) {
  const res = await fetch(`${API_BASE}/tasks/${taskId}`);
  if (!res.ok) throw new Error('Failed to fetch task');
  return res.json();
}

export async function fetchMessages(taskId: string) {
  const res = await fetch(`${API_BASE}/tasks/${taskId}/messages`);
  if (!res.ok) throw new Error('Failed to fetch messages');
  return res.json();
}
```

- [x] Create `apps/web/src/app/providers.tsx`:

```tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

- [x] Update `apps/web/src/app/layout.tsx` to wrap with Providers:

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'OneZone',
  description: 'Agent task runner',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [x] Create `apps/web/src/app/page.tsx` (projects list):

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { fetchProjects, createProject } from '@/lib/api';

export default function ProjectsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showForm, setShowForm] = useState(false);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });

  const createMutation = useMutation({
    mutationFn: () => createProject({ name, description }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      setName('');
      setDescription('');
      setShowForm(false);
    },
  });

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          New Project
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-4 border rounded bg-gray-50">
          <input
            className="block w-full border rounded px-3 py-2 mb-2"
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="block w-full border rounded px-3 py-2 mb-3"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button
            onClick={() => createMutation.mutate()}
            disabled={!name || createMutation.isPending}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating...' : 'Create'}
          </button>
        </div>
      )}

      {projects.length === 0 ? (
        <p className="text-gray-500">No projects yet. Create one to get started.</p>
      ) : (
        <ul className="space-y-3">
          {projects.map((p: { id: string; name: string; description?: string; createdAt: string }) => (
            <li key={p.id} className="border rounded p-4 hover:bg-gray-50">
              <Link href={`/projects/${p.id}`} className="block">
                <div className="font-medium text-blue-700">{p.name}</div>
                {p.description && (
                  <div className="text-sm text-gray-500">{p.description}</div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [x] Create `apps/web/src/app/projects/[id]/page.tsx` (project detail + tasks list):

```tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { fetchProject, fetchTasks, createTask } from '@/lib/api';

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showForm, setShowForm] = useState(false);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => fetchProject(id),
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', id],
    queryFn: () => fetchTasks(id),
  });

  const createMutation = useMutation({
    mutationFn: () => createTask(id, { name, description }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', id] });
      setName('');
      setDescription('');
      setShowForm(false);
    },
  });

  if (projectLoading || tasksLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-4">
        <Link href="/" className="text-blue-600 hover:underline text-sm">
          ← Projects
        </Link>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{project?.name}</h1>
          {project?.description && (
            <p className="text-gray-500 text-sm">{project.description}</p>
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          New Task
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-4 border rounded bg-gray-50">
          <input
            className="block w-full border rounded px-3 py-2 mb-2"
            placeholder="Task name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="block w-full border rounded px-3 py-2 mb-3"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button
            onClick={() => createMutation.mutate()}
            disabled={!name || createMutation.isPending}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating...' : 'Create'}
          </button>
        </div>
      )}

      {tasks.length === 0 ? (
        <p className="text-gray-500">No tasks yet. Create one to get started.</p>
      ) : (
        <ul className="space-y-3">
          {tasks.map((t: { id: string; name: string; description?: string; createdAt: string }) => (
            <li key={t.id} className="border rounded p-4 hover:bg-gray-50">
              <Link href={`/projects/${id}/tasks/${t.id}`} className="block">
                <div className="font-medium text-blue-700">{t.name}</div>
                {t.description && (
                  <div className="text-sm text-gray-500">{t.description}</div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [x] Create `apps/web/src/hooks/useTaskRoom.ts`:

```typescript
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export interface RoomMessage {
  id?: string;
  roomId: string;
  role: 'user' | 'agent' | 'system';
  agentId?: string | null;
  agentName?: string | null;
  command?: string | null;
  stream?: 'stdout' | 'stderr' | null;
  content: string;
  ts: number;
}

export interface ConnectedAgent {
  agentId: string;
  agentName: string;
  taskId: string;
}

const SERVER_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function useTaskRoom(taskId: string) {
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [connectedAgents, setConnectedAgents] = useState<Map<string, ConnectedAgent>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(`${SERVER_URL}/chat`, {
      auth: {
        taskId,
        role: 'user',
      },
    });

    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('chat:message', (msg: RoomMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('output:line', (msg: RoomMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('agent:connected', (info: ConnectedAgent & { ts: number }) => {
      setConnectedAgents((prev) => {
        const next = new Map(prev);
        next.set(info.agentId, { agentId: info.agentId, agentName: info.agentName, taskId: info.taskId });
        return next;
      });
    });

    socket.on('agent:disconnected', (info: ConnectedAgent & { ts: number }) => {
      setConnectedAgents((prev) => {
        const next = new Map(prev);
        next.delete(info.agentId);
        return next;
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [taskId]);

  const sendMessage = useCallback(
    (content: string) => {
      const socket = socketRef.current;
      if (!socket || !isConnected) return;
      socket.emit('chat:message', {
        roomId: `task:${taskId}`,
        content,
      });
    },
    [taskId, isConnected],
  );

  const prependMessages = useCallback((msgs: RoomMessage[]) => {
    setMessages(msgs);
  }, []);

  return {
    messages,
    connectedAgents: Array.from(connectedAgents.values()),
    isConnected,
    sendMessage,
    prependMessages,
  };
}
```

- [x] Create `apps/web/src/components/MessageLine.tsx`:

```tsx
import type { RoomMessage } from '@/hooks/useTaskRoom';

export function MessageLine({ message }: { message: RoomMessage }) {
  const isAgent = message.role === 'agent';
  const isSystem = message.role === 'system';
  const isStderr = message.stream === 'stderr';

  const timestamp = new Date(message.ts).toLocaleTimeString();

  if (isSystem) {
    return (
      <div className="text-xs text-gray-400 italic py-0.5 px-2">
        {timestamp} — {message.content}
      </div>
    );
  }

  if (isAgent) {
    return (
      <div
        className={`font-mono text-sm py-0.5 px-2 ${
          isStderr ? 'text-red-400 bg-red-950/20' : 'text-green-300'
        }`}
      >
        <span className="text-gray-500 text-xs mr-2">{timestamp}</span>
        <span className="text-yellow-500 mr-2">[{message.agentName || message.agentId}]</span>
        <span className="text-gray-400 text-xs mr-2">{message.stream}</span>
        {message.content}
      </div>
    );
  }

  // user message
  return (
    <div className="py-1 px-2">
      <span className="text-gray-400 text-xs mr-2">{timestamp}</span>
      <span className="text-blue-400 font-medium mr-2">you</span>
      <span>{message.content}</span>
    </div>
  );
}
```

- [x] Create `apps/web/src/components/AgentStatusBar.tsx`:

```tsx
import type { ConnectedAgent } from '@/hooks/useTaskRoom';

export function AgentStatusBar({ agents }: { agents: ConnectedAgent[] }) {
  if (agents.length === 0) {
    return (
      <div className="text-xs text-gray-500 px-4 py-1 border-b border-gray-700">
        No agents connected
      </div>
    );
  }

  return (
    <div className="flex gap-2 px-4 py-1 border-b border-gray-700 text-xs">
      <span className="text-gray-400">Agents:</span>
      {agents.map((a) => (
        <span
          key={a.agentId}
          className="bg-green-900 text-green-300 px-2 py-0.5 rounded-full"
        >
          {a.agentName}
        </span>
      ))}
    </div>
  );
}
```

- [x] Create `apps/web/src/components/MessageInput.tsx`:

```tsx
'use client';

import { useState, FormEvent } from 'react';

export function MessageInput({
  onSend,
  disabled,
}: {
  onSend: (content: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex gap-2 p-3 border-t border-gray-700"
    >
      <input
        className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
        placeholder={disabled ? 'Connecting...' : 'Type a message...'}
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
      >
        Send
      </button>
    </form>
  );
}
```

- [x] Create `apps/web/src/app/projects/[id]/tasks/[taskId]/page.tsx` (task chat room):

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { fetchTask, fetchMessages } from '@/lib/api';
import { useTaskRoom } from '@/hooks/useTaskRoom';
import { MessageLine } from '@/components/MessageLine';
import { AgentStatusBar } from '@/components/AgentStatusBar';
import { MessageInput } from '@/components/MessageInput';

export default function TaskChatPage() {
  const { id: projectId, taskId } = useParams<{ id: string; taskId: string }>();
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: task } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => fetchTask(taskId),
  });

  const { data: history = [] } = useQuery({
    queryKey: ['messages', taskId],
    queryFn: () => fetchMessages(taskId),
  });

  const { messages, connectedAgents, isConnected, sendMessage, prependMessages } =
    useTaskRoom(taskId);

  // Load history into the room on mount
  useEffect(() => {
    if (history.length > 0) {
      prependMessages(history);
    }
  }, [history, prependMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700">
        <div className="text-xs text-gray-400 mb-1">
          <Link href="/" className="hover:underline">Projects</Link>
          {' / '}
          <Link href={`/projects/${projectId}`} className="hover:underline">Project</Link>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="font-semibold">{task?.name || 'Loading...'}</h1>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              isConnected
                ? 'bg-green-900 text-green-300'
                : 'bg-gray-700 text-gray-400'
            }`}
          >
            {isConnected ? 'connected' : 'disconnected'}
          </span>
        </div>
      </div>

      {/* Agent status */}
      <AgentStatusBar agents={connectedAgents} />

      {/* Message area */}
      <div className="flex-1 overflow-y-auto py-2">
        {messages.map((msg, i) => (
          <MessageLine key={msg.id || i} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <MessageInput onSend={sendMessage} disabled={!isConnected} />
    </div>
  );
}
```

- [x] Add `NEXT_PUBLIC_API_URL=http://localhost:3001` to `apps/web/.env.local`:

```bash
echo "NEXT_PUBLIC_API_URL=http://localhost:3001" > apps/web/.env.local
```

- [x] Build the frontend:

```bash
pnpm --filter @onezone/web build
```

##### Step 6 Verification Checklist
- [ ] `pnpm --filter @onezone/web build` exits with code 0
- [ ] Start the frontend: `pnpm --filter @onezone/web dev`
- [ ] Navigate to http://localhost:3000 — projects list renders
- [ ] Create a project — it appears in the list
- [ ] Click the project — tasks list renders
- [ ] Create a task — it appears in the list
- [ ] Click the task — chat room opens with empty message area and input bar
- [ ] Type a message and press Send — message appears in the chat immediately
- [ ] Open a second browser window to the same task URL — messages sent in one appear in the other
- [ ] In a terminal, run:
  ```bash
  node apps/agent/bin/run.js run --task <TASK_ID> echo "live agent output"
  ```
  The output line should appear in the chat room in real time
- [ ] Reload the task page — history loads correctly from REST and messages are visible

#### Step 6 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.
