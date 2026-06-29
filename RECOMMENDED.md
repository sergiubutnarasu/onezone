# Onezone SaaS Readiness Assessment

## Verdict: **Not yet production-ready for SaaS.** The architecture is solid and well-structured, but there are critical gaps in security, multi-tenancy, billing, testing, and operational readiness.

The codebase is well-organized — clean monorepo, proper auth flows, real-time architecture, shared type contracts, and Docker setup. It's a strong foundation. But going from "self-hosted tool" to "SaaS product" requires closing several categories of gaps.

---

## Scorecard

| Category | Status | Severity |
|----------|--------|----------|
| Rate limiting | ❌ Missing | **Critical** |
| Environment validation | ❌ Missing | **Critical** |
| Global error handling | ❌ Missing | **High** |
| Security headers (Helmet) | ❌ Missing | **High** |
| Testing | ❌ Zero tests | **High** |
| CI/CD pipeline | ❌ None | **High** |
| Billing/subscription | ❌ None | **High** (for SaaS) |
| Multi-tenancy isolation | ⚠️ Partial | **High** |
| Non-root Docker containers | ❌ Server & web run as root | **High** |
| Health checks | ⚠️ Minimal | Medium |
| Structured logging | ⚠️ Console only | Medium |
| Password policy | ⚠️ Weak | Medium |
| Agent sandboxing | ⚠️ Copilot & Opencode unsandboxed | Medium |
| Migration safety | ⚠️ Runs on every boot | Medium |
| S3 redundancy | ❌ `replication_factor = 1` | Medium |
| Frontend middleware guard | ⚠️ Client-side only | Medium |
| SEO/metadata | ❌ Minimal | Low (internal tool) |
| Input validation | ✅ Good | — |
| Auth architecture | ✅ Solid | — |
| Real-time layer | ✅ Well-built | — |
| Terminal error handling | ✅ Robust | — |
| Shared contracts | ✅ Excellent | — |

---

## Critical Issues (Must Fix Before Launch)

### 1. No Rate Limiting

Your `@Public()` auth endpoints (`/auth/login`, `/auth/signup`, `/auth/device`, `/auth/token`, `/auth/refresh`) have zero brute-force protection. An attacker can hammer login indefinitely.

**Fix:** Install `@nestjs/throttler`, add a global `ThrottlerGuard`, and apply stricter limits on auth routes:

```ts
// app.module.ts
ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
{ provide: APP_GUARD, useClass: ThrottlerGuard }

// auth.controller.ts
@Throttle({ default: { ttl: 60_000, limit: 5 } })  // on login/signup
```

### 2. No Environment Variable Validation

`ConfigModule.forRoot({ isGlobal: true })` has no `validationSchema`. If `JWT_SECRET` is unset, the server starts fine but crashes on first auth request. If `WEB_ORIGIN` is unset, it silently falls back to `http://localhost:5025` in production. If `ADMIN_EMAILS` is empty, you silently have no admins.

**Fix:** Add Joi validation:

```ts
ConfigModule.forRoot({
  isGlobal: true,
  validationSchema: Joi.object({
    JWT_SECRET: Joi.string().min(32).required(),
    WEB_ORIGIN: Joi.string().uri().required(),
    DATABASE_URL: Joi.string().uri().required(),
    REDIS_URL: Joi.string().uri().required(),
    REFRESH_TOKEN_EXPIRES_IN: Joi.string().required(),
    ADMIN_EMAILS: Joi.string().required(),
    S3_ENDPOINT: Joi.string().uri().required(),
    S3_ACCESS_KEY_ID: Joi.string().required(),
    S3_SECRET_ACCESS_KEY: Joi.string().required(),
  }),
});
```

### 3. No Billing / Subscription System

There is no Stripe, no plan tiers, no usage limits, no quota enforcement. The `totalCostUsd` field in `messages` tracks cost but nothing gates on it. For a SaaS, you need:

- Subscription plans (free/pro/enterprise)
- Usage quotas (tasks per month, terminals, projects)
- Payment integration (Stripe Billing or LemonSqueezy)
- Overage handling and plan downgrade logic
- A `Subscription` / `Plan` model in your Prisma schema

### 4. No Tests

There are **zero test files** in the entire codebase. No `*.test.ts`, no `*.spec.ts`, no test framework configured. The `lint` script references `{src,test}/**/*.ts` but the `test/` directory doesn't exist.

**Fix:** At minimum, add tests for:

- Auth flows (signup, login, refresh, device code)
- Authorization guards (user scoping, admin guard)
- Critical business logic (task assignment, schedule execution)
- API integration tests for key endpoints

### 5. No CI/CD Pipeline

No `.github/` directory exists. No automated testing, linting, type-checking, or build verification on push/PR.

**Fix:** Add a GitHub Actions workflow that runs `pnpm lint`, `pnpm typecheck`, `pnpm build`, and tests on every PR.

---

## High Priority Issues

### 6. No Global Exception Filter

Unhandled Prisma errors (unique constraint violations, FK errors) surface as raw `500` responses with internal details. No consistent error response shape.

**Fix:** Add an `AllExceptionsFilter`:

```ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // Normalize to { statusCode, error, message }
    // Map Prisma errors to appropriate HTTP status codes
    // Log structured error
  }
}
```

Register it in `main.ts` via `app.useGlobalFilters()`.

### 7. No Security Headers (Helmet)

No `helmet`, no `X-Content-Type-Options`, no `X-Frame-Options`, no `Strict-Transport-Security`, no CSP.

**Fix:** `npm i helmet` and add `app.use(helmet())` as the first middleware in `main.ts`.

### 8. Server & Web Docker Containers Run as Root

`apps/server/Dockerfile` and `apps/web/Dockerfile` have no `USER` directive. Only the terminal container runs as non-root.

**Fix:** Add to both Dockerfiles:

```dockerfile
RUN addgroup -S app && adduser -S app -G app
USER app
```

### 9. Multi-Tenancy Isolation is Incomplete

Data is scoped by `userId` in the schema (good), but:

- There's no row-level security at the database level
- No resource limits per user (project count, task count, terminal count)
- Terminal containers share filesystem across all tasks for a given terminal
- No data encryption at rest
- No per-tenant database isolation (single shared DB is fine for most SaaS, but you need quota enforcement)

**Fix:** Add quota checks in services (e.g., "max 10 projects on free plan"), enforce user scoping consistently in every query (audit all Prisma calls for `where: { userId }`), and consider adding a `plan` field to the `User` model.

### 10. Migration & Seed Run on Every Container Start

The server Dockerfile CMD runs `prisma migrate deploy && prisma db seed && node dist/main`. With multiple replicas, this causes race conditions. Seeding on every boot is wasteful.

**Fix:** Separate migrations into a one-shot init container or a pre-deploy job. Remove seeding from the runtime CMD — run it only during initial setup or via a dedicated script.

---

## Medium Priority Issues

### 11. Health Check is Too Shallow

`GET /health` only returns `{ status: 'ok' }` — it doesn't check DB, Redis, or S3 connectivity. Returns 200 even if the database is down.

**Fix:** Use `@nestjs/terminus` with health indicators for Prisma, Redis, and S3. Add `/health/live` (liveness) and `/health/ready` (readiness) endpoints.

### 12. No Structured Logging

Only NestJS default `Logger` (console output). No JSON structured logs, no request IDs, no log levels by environment, no log shipping.

**Fix:** Add `nestjs-pino` for structured JSON logging with request ID injection and configurable log levels.

### 13. Weak Password Policy

`@MinLength(8)` with no complexity requirements. No common-password blocklist.

**Fix:** Add `@Matches` regex requiring at least 3 of 4 character classes, or raise minimum to 12+ characters.

### 14. Copilot & Opencode Agents Have No Sandboxing

Claude Code has filesystem sandbox config, but Copilot uses `approveAll` permissions and Opencode explicitly allows all tools including external directory access.

**Fix:** Add permission scoping for Copilot and Opencode agents, at minimum restricting filesystem access to the project workdir.

### 15. No Frontend Middleware (Server-Side Auth Guard)

Auth is enforced client-side only. Protected page shells render briefly before redirect.

**Fix:** Add `middleware.ts` that checks for the `access_token` cookie and redirects unauthenticated users to `/auth/login` before rendering any protected route.

### 16. S3 Has No Redundancy

`docker/garage.toml` sets `replication_factor = 1` (single copy, no durability). The `rpc_secret` is hardcoded in the config file.

**Fix:** For production, use managed S3 (AWS S3, Cloudflare R2) or configure Garage with `replication_factor >= 3`. Externalize the RPC secret to an env var.

### 17. Supply Chain Risk in Terminal Entrypoint

`docker-entrypoint.sh` pipes `curl` to `sh` to install `uv` and `rtk` on every container start. This adds startup latency and a supply chain risk.

**Fix:** Install these tools during the Docker build stage, not at runtime.

### 18. Default S3 Credentials in docker-compose.yml

The compose file has hardcoded fallback S3 credentials as defaults:

```yaml
GARAGE_DEFAULT_ACCESS_KEY: ${S3_ACCESS_KEY_ID:-GKonezone}
GARAGE_DEFAULT_SECRET_KEY: ${S3_SECRET_ACCESS_KEY:-3a2a8c6903c5e28fe7468494c5d73d64dfd88581e166cb25cce043ff8eb11410}
```

**Fix:** Remove hardcoded fallbacks — require these to be set explicitly in `.env`.

---

## What's Already Good

- **Auth architecture**: JWT + refresh tokens + device code flow is well-designed. HttpOnly cookies, secure flag based on HTTPS, sameSite strict.
- **Input validation**: Global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, `transform`. DTOs use `class-validator` thoroughly.
- **Real-time layer**: Socket.io with Redis adapter for horizontal scaling, JWT-verified socket auth, Zod-validated payloads.
- **Terminal worker**: Robust error handling — retry loops, ack-based exit reporting, process tree cleanup, transparent token refresh, `dumb-init` for signal handling, non-root user.
- **Shared contracts**: Centralized types, Zod schemas, constants, and room helpers reduce drift across packages.
- **Docker setup**: Multi-stage builds, layer caching, standalone Next.js output.
- **Frontend**: Good responsive design, accessibility basics (labels, aria-labels, focus-visible), centralized HTTP client with auth refresh, TanStack Query for data fetching.
- **Open-redirect protection**: `safeReturnTo()` sanitizes the `returnTo` query param.
- **Idempotent seeding**: `upsert` with empty `update: {}` won't overwrite existing data.

---

## Recommended Action Plan (Priority Order)

1. **Add rate limiting** on all auth endpoints — `@nestjs/throttler`
2. **Add env validation** with Joi schema — fail fast on misconfiguration
3. **Add Helmet** + global exception filter — security headers + error normalization
4. **Add billing/subscription system** — Stripe integration, plan model, quota enforcement
5. **Add test framework + critical path tests** — Jest or Vitest, start with auth and API tests
6. **Add CI/CD pipeline** — GitHub Actions for lint, typecheck, build, test
7. **Fix Docker security** — non-root users for server/web, remove hardcoded S3 creds
8. **Separate migrations from runtime** — init container or pre-deploy job
9. **Upgrade health checks** — `@nestjs/terminus` with DB/Redis/S3 indicators
10. **Add structured logging** — `nestjs-pino` with request IDs
11. **Add frontend middleware** — server-side auth guard
12. **Tighten agent sandboxing** — restrict Copilot/Opencode filesystem access
13. **Add quota enforcement** — per-plan limits on projects, tasks, terminals
14. **Externalize S3 RPC secret** — remove from `garage.toml`

The architecture is strong and the code quality is above average. The gaps are primarily in SaaS-specific concerns (billing, quotas, multi-tenancy enforcement) and production hardening (rate limiting, error handling, testing, CI/CD). Closing the critical and high-priority items would make this launch-ready.