# AGENTS.md — EdgeChat

## What this is

Next.js 16 + React 19 + Prisma (SQLite) + Tailwind CSS 4 + shadcn/ui (New York style) + Stripe. Chat proxy that forwards messages to a local LLM (LM Studio / Ollama) via Desktop Agent (Electron) over Socket.IO. Free/Pro subscription system.

## Commands

```bash
# Setup (required after fresh clone)
npm install
npx prisma generate
npx prisma db push

# Dev — Next.js (port 3000)
npx next dev -p 3000

# Dev — WebSocket server (port 3002)
node server/ws-server.js

# Dev — both at once
npm run dev:all

# Dev — Desktop Agent
cd agent && npm install && npm start

# Build (produces .next/standalone)
npx next build

# Production start (after build)
node .next/standalone/server.js

# DB schema change
npx prisma db push

# Lint (most rules off, rarely catches anything)
npx eslint .

# Docker deploy (VPS)
docker compose up -d --build
```

## Architecture

```
Browser → POST /api/chat → Next.js → HTTP → WS Server :3002 → Socket.IO → Desktop Agent → Ollama/LM Studio
                                                                    ↓
Browser ← SSE stream ← Next.js ← HTTP ← WS Server ← Socket.IO ← Desktop Agent
```

### SaaS (Next.js) — key files
```
src/
  proxy.ts                    # NextAuth middleware (replaces deprecated middleware.ts)
  app/
    page.tsx                  # Dynamic import wrapper (ssr: false)
    chat.tsx                  # ~1900-line single-file client UI
    landing/page.tsx          # Marketing landing with pricing
    api/
      chat/route.ts           # POST — SSE proxy to LLM via Agent
      stripe/                 # checkout, webhook, portal, status
      agent/verify/route.ts   # Agent token validation (public)
      agent/status/route.ts   # Agent online check (proxies to WS server)
      agent/tokens/           # CRUD agent tokens (max depends on plan)
  lib/
    auth.ts                   # NextAuth config (Credentials provider, JWT)
    auth-helpers.ts           # getCurrentUser(), getCurrentUserPlan()
    store.ts                  # Zustand with persist middleware
    plan-limits.ts            # Free/Pro limits + checkLimit()
    stripe.ts                 # Stripe singleton + price IDs
    db.ts                     # PrismaClient singleton
    rag.ts                    # Hybrid search (60% keyword, 40% vector)
    embeddings.ts             # Ollama/OpenAI-compatible embedding endpoints
    chunker.ts                # ~500-token chunks with 100 overlap
    pdf-parser.ts             # PDF/TXT/MD via pdf2json
```

### WebSocket Server (port 3002, standalone)
```
server/ws-server.js           # Socket.IO server, bridges SaaS ↔ Agent
server/Dockerfile.ws          # Docker build for ws-server
```

### Desktop Agent (Electron)
```
agent/main.js                 # Socket.IO client + Ollama/LM Studio proxy
agent/index.html              # Connection form + status UI
```

## Key quirks

- **TypeScript**: `strict: true` but `ignoreBuildErrors: true` in next.config.ts — TS errors won't block build.
- **ESLint**: almost every rule is off (`eslint.config.mjs`). Don't rely on it.
- **React strict mode**: off (`reactStrictMode: false`).
- **Next.js output**: `output: "standalone"` — build produces `.next/standalone/` for Docker.
- **All UI text is in Russian.** Do not translate.
- **Prisma**: SQLite at `./db/custom.db`. Embeddings stored as JSON strings.
- **chat.tsx** is a ~1900-line single-file client component. Refactoring planned.
- **Thinking/Content separation**: models like Qwen send `reasoning_content` + `content`. The proxy normalizes to `{type:'thinking'|'content'}` SSE chunks.
- **Ollama API has two formats** handled in the chat route:
  - `/api/chat` (Ollama native) — NDJSON
  - `/v1/chat/completions` (OpenAI-compatible) — SSE with `data:` prefix
- **Free/Pro limits** defined in `src/lib/plan-limits.ts`. Enforced in `checkLimit()` called from document upload, session creation, agent token creation, and chat rate limiting.
- **Stripe webhook** at `/api/stripe/webhook` handles subscription lifecycle. Without it, Pro plan never activates/cancels.
- **Windows `npm run dev`**: uses bash pipe (`2>&1 | tee`). On Windows PowerShell, run `npx next dev -p 3000` directly.
- **middleware.ts** was renamed to `proxy.ts` (Next.js 16 deprecation). File stays in `src/`.

## Database

SQLite at `./db/custom.db`. Tables:
- `User` — includes `plan` ("free"|"pro"), `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionEndsAt`
- `Document`, `DocumentChunk` — RAG documents with chunked text + vector embeddings
- `Prompt` — system prompts (6 defaults seeded, custom per user)
- `ChatSession`, `ChatMessage` — chat history
- `AgentToken` — token auth for Desktop Agent
- `Account`, `Session`, `VerificationToken` — NextAuth internals

After schema changes: `npx prisma db push` (no migrations).

## Docker deploy

```bash
docker compose up -d --build
```

Three services: `app` (Next.js), `ws-server` (Socket.IO), `caddy` (reverse proxy with auto-TLS via Let's Encrypt). Requires `.env` with `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and optional Stripe keys.

## Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | `file:./db/custom.db` locally, `file:/app/db/custom.db` in Docker |
| `NEXTAUTH_SECRET` | Yes | ≥32 chars, use `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Yes | Your public URL or `http://localhost:3000` |
| `WS_SERVER_URL` | Dev | Default `http://localhost:3002` |
| `STRIPE_SECRET_KEY` | Pro | From Stripe Dashboard |
| `STRIPE_WEBHOOK_SECRET` | Pro | From Stripe Dashboard webhook settings |
| `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY` | Pro | Stripe price ID for $5/mo |
| `NEXT_PUBLIC_STRIPE_PRICE_YEARLY` | Pro | Stripe price ID for $50/yr |

## Files that matter most

1. `src/app/chat.tsx` — the entire client UI
2. `src/app/api/chat/route.ts` — LLM proxy (agent mode)
3. `src/lib/store.ts` — Zustand state
4. `src/lib/auth.ts` — NextAuth config (plan in JWT)
5. `src/lib/plan-limits.ts` — Free/Pro limits
6. `src/proxy.ts` — auth middleware
7. `server/ws-server.js` — WebSocket bridge server
8. `agent/main.js` — Desktop Agent core logic
9. `prisma/schema.prisma` — database schema
