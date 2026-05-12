# web

The Next.js frontend dashboard for OneZone. Provides a project management UI, real-time agent chat, kanban task board, and terminal monitoring — all connected to the server via REST and Socket.io.

## Stack

- **Next.js 16** (App Router) — React framework
- **TanStack Query** — server state management and data fetching
- **Socket.io client** — real-time updates from server and terminals
- **Tailwind CSS v4** — styling
- **shadcn/ui** — component library built on Radix UI
- **Lexical** — rich text editor for task descriptions
- **@dnd-kit** — drag-and-drop for the kanban board
- **react-hook-form** — form state management

## Pages

| Route | Description |
|---|---|
| `/` | Project list — overview of all projects |
| `/projects/[id]` | Project detail — kanban board, tasks, and agent chat |
| `/agents` | Agent management — register and configure AI agents |
| `/terminals` | Terminal list — view all connected terminal sessions |
| `/skills` | Global skills — manage shared agent skills |

## Development

```bash
# From repo root — start the full stack
docker compose up postgres redis -d
pnpm install
pnpm dev
```

The web app runs on **port 5025** by default.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:5026` | Backend server URL (REST + Socket.io) |

## Build

```bash
pnpm build    # production build
pnpm start    # start production server
```

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
