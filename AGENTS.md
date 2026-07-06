# AGENTS.md — TunnelChat

## What this is

Next.js 16 + React 19 + Prisma (SQLite) + Tailwind CSS 4 + shadcn/ui (New York style).
A chat proxy that forwards messages to a local LLM (LM Studio / Ollama) via Desktop Agent (Electron) — no port forwarding needed.

## Commands

```bash
# Setup (required after fresh clone)
npx prisma generate
npx prisma db push

# Dev (SaaS only)
npx next dev -p 3000

# Dev (SaaS + WebSocket server)
npx next dev -p 3000    # Terminal 1
node server/ws-server.js  # Terminal 2

# Dev (Desktop Agent)
cd agent && npm install && npm start

# Lint
npx eslint src --ext .ts,.tsx

# Build
npx next build
```

## Architecture

### SaaS (Next.js)
```
src/
  app/
    page.tsx          # Server component — dynamic import wrapper (ssr: false)
    chat.tsx          # Client component — THE main UI (~1900 lines, single-file)
    layout.tsx        # Root layout with Toaster
    globals.css       # Tailwind CSS 4 theme (light/dark via oklch)
    api/
      chat/route.ts       # POST — SSE proxy to LLM via Agent
      agent/status/route.ts  # POST — check agent online status via WS server
      documents/          # GET/DELETE + upload/route.ts (POST) + embed/route.ts (POST)
      prompts/            # GET/POST + [id]/route.ts (PUT/DELETE)
      sessions/           # GET/POST + [sessionId]/route.ts (GET/PUT/DELETE)
        messages/         # POST + [messageId]/route.ts (DELETE)
  components/
    ui/                 # shadcn/ui components (New York style)
    chat/
      markdown-message.tsx  # Markdown renderer with thinking/content separation
  lib/
    store.ts            # Zustand store with persist middleware
    db.ts               # PrismaClient singleton
    agent-manager.ts    # Agent tracking singleton (used in dev)
    chunker.ts          # Text chunking (~500 tokens, 100 overlap)
    embeddings.ts       # Ollama + OpenAI-compatible embedding endpoints
    pdf-parser.ts       # PDF/TXT/MD parsing via pdf2json
    default-prompts.ts  # 6 Russian-language system prompts
    utils.ts            # cn() helper (clsx + tailwind-merge)
  hooks/
    use-toast.ts        # Toast hook (client-side state, not Zustand)
    use-mobile.ts       # Mobile detection hook
```

### WebSocket Server (port 3002)
```
server/
  ws-server.js         # Socket.IO server — bridges SaaS ↔ Desktop Agent
```

### Desktop Agent (Electron)
```
agent/
  main.js              # Main process: WS connection + Ollama proxy
  preload.js           # Context bridge (main ↔ renderer)
  index.html           # Minimal UI with connection form + status
  package.json         # Electron + socket.io-client
```

## Agent Mode Flow

```
[Phone/SaaS UI] → POST /api/chat → [Next.js] → HTTP → [WS Server :3002] → Socket.IO → [Electron Agent]
                                                                                                    ↓
                                                                                              localhost:11434
                                                                                                    ↓
[Phone/SaaS UI] ← SSE stream ← [Next.js] ← HTTP ← [WS Server] ← Socket.IO ← [Electron Agent]
```

1. Desktop Agent starts → connects to SaaS via WebSocket
2. User sends message in SaaS UI
3. `/api/chat` sends request to WS server → forwarded to Agent
4. Agent calls local LM Studio / Ollama → streams tokens back via WebSocket
5. SaaS receives chunks → streams to client as SSE

## Key quirks

- **TypeScript strict mode is on** but `ignoreBuildErrors: true` in next.config.ts.
- **ESLint is very permissive** — most rules are turned off.
- **All UI text is in Russian.** Do not translate.
- **Prisma schema uses SQLite** with embeddings stored as JSON strings.
- **The main chat UI is a single ~1900 line file** (`chat.tsx`).
- **Thinking/Content separation**: Models like Qwen send `reasoning_content` separately from `content`. The proxy normalizes this into `{type: 'thinking', content}` and `{type: 'content', content}` SSE format.
- **Ollama API has two formats** handled by the chat route:
  - `/api/chat` (Ollama native) — NDJSON
  - `/v1/chat/completions` (OpenAI-compatible) — SSE with `data:` prefix

## Database

SQLite at `./db/custom.db`. Tables: Document, DocumentChunk, Prompt, ChatSession, ChatMessage.
After schema changes: `npx prisma db push`.

## Files that matter most

1. `src/app/chat.tsx` — the entire client UI
2. `src/app/api/chat/route.ts` — the LLM proxy (agent mode)
3. `src/lib/store.ts` — Zustand state
4. `server/ws-server.js` — WebSocket bridge server
5. `agent/main.js` — Desktop Agent core logic
6. `prisma/schema.prisma` — database schema
