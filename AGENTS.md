# AGENTS.md — EdgeChat

## What this is

Next.js 16 + React 19 + Prisma (SQLite) + Tailwind CSS 4 + shadcn/ui (New York style) + Stripe. Chat proxy that forwards messages to a local LLM (LM Studio / Ollama) via Desktop Agent (Electron) over Socket.IO. Also supports image generation through local ComfyUI. Free/Pro subscription system.

## Commands

```bash
# Setup (required after fresh clone)
npm install
npx prisma generate
npx prisma db push

# Dev — Next.js (port 3000)
npx next dev -p 3000

# Dev — WebSocket server (port 3000, combined with Next.js proxy)
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

# Download ComfyUI frontend (for self-hosted editor)
scripts/download-comfyui-frontend.ps1
```

## Architecture

### ComfyUI Frontend Tunnel

Full ComfyUI SPA proxied from user's local ComfyUI through Agent to browser:

```
Browser ─── /comfyui/* ──→ SaaS ──HTTP──→ WS Server :3000 (прокси на Next.js :3001) ──Socket.IO──→ Agent ──HTTP──→ 8189 ──→ 8188
              ↓ 3-layer auth priority               TCP proxy (net)
              ├─ ?token=xxx (URL query param)
              ├─ agent-token cookie (Set-Cookie at /, Path=/)
              └─ x-agent-token header (for programmatic use)
              ├─ HTML rewriting → /comfyui/prefix + ?token=xxx
              └─ ws://host/ws → ws://host/comfyui/ws?token=xxx (через единый порт)
```

Key components:
- **agent/main.js** starts a TCP proxy (`net.createServer`) on :8189 → :8188, plus Socket.IO tunnel handlers for `tunnel:http:request` and `tunnel:ws:open/close/message`
- **server/ws-server.js** has a raw `WebSocketServer` at `/comfyui/ws` (using `ws` package alongside Socket.IO), plus `POST /api/agent/tunnel` HTTP endpoint
- **SaaS catch-all route** `src/app/comfyui/[[...path]]/route.ts` handles all HTTP methods, rewrites HTML (injects `<base href="/comfyui/">`, adds `?token=xxx` to ALL `src`/`href`/`action` attributes including relative paths, `@import url()`, CSS `url()`), injects script that patches `fetch`/`XHR`/`WebSocket`; sets `Set-Cookie` on first HTML response (`Path=/; SameSite=Lax`); reads token priority: URL query param → cookie → header
- **Injected script** patches `fetch` and `XMLHttpRequest.open` to prepend `/comfyui` prefix (auth via `?token=` in URL or cookie), patches `WebSocket` to redirect to `ws://host/comfyui/ws?token=xxx` (through WS Server on the same port), and sets `document.cookie` as additional fallback
- **Caddyfile** routes `/comfyui/ws*` to WS Server for WebSocket upgrade
- **Auto-detect nodes** in `handleImageRequest` — finds `CLIPTextEncode`, `KSampler`, `EmptyLatentImage` by `class_type` instead of hardcoded node IDs

### Chat flow
```
Browser → POST /api/chat → Next.js → HTTP → WS Server :3000 → Socket.IO → Desktop Agent → Ollama/LM Studio
                                                                    ↓
Browser ← SSE stream ← Next.js ← HTTP ← WS Server ← Socket.IO ← Desktop Agent
```

### Image generation flow (legacy, via Agent)
```
Browser → POST /api/generate-image → WS Server → Agent (Socket.IO image:request) → ComfyUI :8188
                                                                                    ↓
                                                     Agent POST /api/upload (multipart)
                                                                                    ↓
Browser ← { url } ← WS Server ← Agent (image:result) ← SaaS saves to public/generated/
```

### ComfyUI Frontend Tunnel (new, full SPA)
```
Browser → SaaS /comfyui/* → WS Server → Agent → ComfyUI (HTTP + WS)
          (URL rewriting + injected script for path prefix)
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
      generate-image/route.ts # POST — triggers ComfyUI generation via Agent
      upload/route.ts         # POST — receives image file from Agent (agent-token auth)
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

### WebSocket Server (port 3000, единая точка входа + прокси на Next.js :3001)
```
server/ws-server.js           # Socket.IO server, bridges SaaS ↔ Agent
server/Dockerfile.ws          # Docker build for ws-server
```

### Desktop Agent (Electron)
```
agent/main.js                 # Socket.IO client + LLM proxy + ComfyUI proxy
agent/preload.js              # Electron IPC bridge (saveConfig, selectFile, etc.)
agent/index.html              # Connection form + LLM + ComfyUI settings
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
- **Free/Pro limits** defined in `src/lib/plan-limits.ts`. Enforced in `checkLimit()` called from document upload, session creation, agent token creation, chat rate limiting, and image generation.
- **Image generation limit**: `imageGenerations` — counts ChatMessage rows with non-null `imageUrl` across user's sessions.
- **Stripe webhook** at `/api/stripe/webhook` handles subscription lifecycle. Without it, Pro plan never activates/cancels.
- **Windows `npm run dev`**: uses bash pipe (`2>&1 | tee`). On Windows PowerShell, run `npx next dev -p 3000` directly.
- **middleware.ts** was renamed to `proxy.ts` (Next.js 16 deprecation). File stays in `src/`.
- **`/api/upload` excluded from NextAuth middleware** (`proxy.ts` matcher). Auth is done via `agent-token` HTTP header fallback — the Agent uses its registered token when uploading generated images.
- **Agent stores** `comfyUrl` and `workflowPath` in `config.json` (electron userData). UI has a file picker (`selectFile` IPC) for workflow selection.
- **Generated images** saved to `public/generated/` — automatically served by Next.js under `/generated/` URLs.
- **`Message.imageUrl`** — images are displayed inline in chat via `MarkdownMessage` component with a download button.
- **WS Server events**: `image:request` → Agent → `image:result` callback. Pending requests stored in `pendingImageRequests` Map. Also `tunnel:http:request`/`tunnel:http:response` for ComfyUI frontend proxy, and `tunnel:ws:open/close/message` for WebSocket relay.
- **Agent polls ComfyUI** `/history/{prompt_id}` every 1s up to 5 minutes, then downloads via `/view`.
- **Auto-detect ComfyUI nodes**: `handleImageRequest` now searches workflow by `class_type` (`CLIPTextEncode`, `KSampler`, `EmptyLatentImage`) instead of hardcoded node IDs. ANY workflow JSON works.
- **TCP proxy**: Agent starts `net.createServer` on `:8189` that TCP-proxies to `:8188` (ComfyUI). All tunnel HTTP + WS traffic goes through `:8189`.
- **Raw WebSocket on WS Server**: The `ws` package runs alongside `socket.io` on the same port, handling `/comfyui/ws` for real-time relay Browser ↔ Agent ↔ ComfyUI.
- **HTML rewriting**: The SaaS tunnel route (`src/app/comfyui/[[...path]]/route.ts`) rewrites ComfyUI HTML: injects `<base href="/comfyui/">`, converts `src="/` → `src="/comfyui/`, injects a script that patches only `WebSocket` to redirect to WS Server. **Cookie-based auth**: first HTML page response sets `Set-Cookie: agent-token=xxx; Path=/comfyui` — all subsequent asset/API requests carry the cookie automatically. Token read priority: `x-agent-token` header > `?token=` query > `agent-token` cookie.

## Database

SQLite at `./db/custom.db`. Tables:
- `User` — includes `plan` ("free"|"pro"), `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionEndsAt`
- `Document`, `DocumentChunk` — RAG documents with chunked text + vector embeddings
- `Prompt` — system prompts (6 defaults seeded, custom per user)
- `ChatSession`, `ChatMessage` — chat history (`ChatMessage.imageUrl` optional, for generated images)
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
|---|---|---|
| `DATABASE_URL` | Yes | `file:./db/custom.db` locally, `file:/app/db/custom.db` in Docker |
| `NEXTAUTH_SECRET` | Yes | ≥32 chars, use `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Yes | Your public URL or `http://localhost:3000` |
| `WS_SERVER_URL` | Dev | Default `http://localhost:3000` |
| `STRIPE_SECRET_KEY` | Pro | From Stripe Dashboard |
| `STRIPE_WEBHOOK_SECRET` | Pro | From Stripe Dashboard webhook settings |
| `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY` | Pro | Stripe price ID for $5/mo |
| `NEXT_PUBLIC_STRIPE_PRICE_YEARLY` | Pro | Stripe price ID for $50/yr |

## Files that matter most

1. `src/app/chat.tsx` — the entire client UI
2. `src/app/api/chat/route.ts` — LLM proxy (agent mode)
3. `src/app/api/generate-image/route.ts` — ComfyUI image generation trigger
4. `src/app/api/upload/route.ts` — file upload receiver from Agent
5. `src/lib/store.ts` — Zustand state
6. `src/lib/auth.ts` — NextAuth config (plan in JWT)
7. `src/lib/plan-limits.ts` — Free/Pro limits
8. `src/proxy.ts` — auth middleware
9. `server/ws-server.js` — WebSocket bridge server (chat + image:request/result)
10. `agent/main.js` — Desktop Agent (LLM proxy + ComfyUI image generation)
11. `agent/index.html` — Agent UI (LLM + ComfyUI settings)
12. `prisma/schema.prisma` — database schema
13. `src/app/comfyui/[[...path]]/route.ts` — ComfyUI frontend tunnel proxy (HTML rewriting + WS patch + cookie auth)
14. `Caddyfile` — `/comfyui/ws` route for WebSocket upgrade to WS Server
