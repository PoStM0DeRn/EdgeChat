<div align="center">

**English** · [Русский](README.md)

<img src="https://raw.githubusercontent.com/PoStM0DeRn/EdgeChat/main/public/logo.png" alt="EdgeChat" width="110" />

# EdgeChat

### Your Local AI, Anywhere

Chat, ComfyUI, and RAG through a single **Desktop Agent** — no open ports, ngrok, or VPN. Your models run on your PC, and you control them from any browser.

[🌐 edgechat.ru](https://edgechat.ru) · [♡ Support](https://boosty.to/edgechat/donate)

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white&style=flat-square)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white&style=flat-square)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white&style=flat-square)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white&style=flat-square)](https://tailwindcss.com)
[![Prisma](https://img.shields.io/badge/Prisma-SQLite-2D3748?logo=prisma&logoColor=white&style=flat-square)](https://www.prisma.io)
[![Electron](https://img.shields.io/badge/Electron-47848F?logo=electron&logoColor=white&style=flat-square)](https://www.electronjs.org)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?logo=socket.io&logoColor=white&style=flat-square)](https://socket.io)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white&style=flat-square)](https://www.docker.com)
[![Open Source](https://img.shields.io/badge/Open_Source-22c55e?style=flat-square)]()

</div>

---

## Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Docker Deploy on a VPS](#docker-deploy-on-a-vps)
- [Desktop Agent](#desktop-agent)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Known Limitations](#known-limitations)
- [Support the Project](#support-the-project)

## Features

<table align="center">
  <tr>
    <td align="center">
      <b>Desktop Agent</b><br />
      <sub>One Electron agent for chat, image gen, ComfyUI, and RAG. Set it and forget it.</sub>
    </td>
    <td align="center">
      <b>ComfyUI Tunnel</b><br />
      <sub>A full node editor in the browser through a secure tunnel — feels like ComfyUI is running locally.</sub>
    </td>
    <td align="center">
      <b>Access from Anywhere</b><br />
      <sub>No open ports, ngrok, or VPN. The agent connects outbound via Socket.IO.</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <b>RAG Pipeline</b><br />
      <sub>Upload documents (PDF, TXT, MD), vectorize them, and get answers grounded in your own data.</sub>
    </td>
    <td align="center">
      <b>Multi-Model</b><br />
      <sub>Qwen, Llama, Mistral, Gemma — any model via Ollama or LM Studio.</sub>
    </td>
    <td align="center">
      <b>Image Generation</b><br />
      <sub>ComfyUI generation right from chat, with results saved straight into the message history.</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <b>Security</b><br />
      <sub>Agent tokens, NextAuth + JWT, rate limiting. Your data stays on your computer.</sub>
    </td>
    <td align="center">
      <b>Streaming Responses</b><br />
      <sub>Answers stream in (NDJSON), with a clean separation of thinking and content.</sub>
    </td>
    <td align="center">
      <b>Docker Deploy</b><br />
      <sub>Next.js + WS Server + Caddy launch on any VPS with a single command.</sub>
    </td>
  </tr>
</table>

## Screenshots

> Screenshots are coming soon. Meanwhile, check out the live demo — [edgechat.ru](https://edgechat.ru).

## How It Works

1. **Install Ollama / ComfyUI** — load an LLM via Ollama or LM Studio. Run ComfyUI for image generation if needed.
2. **Launch Desktop Agent** — install the Electron agent on your PC and enter your access token.
3. **Connect to SaaS** — the agent connects to the cloud outbound via Socket.IO. No ports to open.
4. **Use from Any Device** — open a browser on your phone, tablet, or laptop: chat, generation, ComfyUI, RAG. All there.

## Architecture

```
             SaaS (cloud / VPS)                               Your computer
┌─────────────┐   ┌──────────────┐   ┌───────────────────┐   ┌──────────────────────┐
│   Browser    │──▶│    Caddy     │──▶│  WS Server :3000  │──▶│   Desktop Agent      │
│  (SaaS UI)   │◀──│  :443 HTTPS  │◀──│  Socket.IO + WS   │◀──│     (Electron)       │
└─────────────┘   └──────────────┘   └────────┬──────────┘   └──────────┬───────────┘
                                              │                          │
                                         HTTP proxy                 HTTP / WS
                                              ▼                          ▼
                                      ┌──────────────┐         ┌──────────────────┐
                                      │   Next.js    │         │  Ollama / LM Studio│
                                      │    :3001     │         │  ComfyUI :8188     │
                                      └──────────────┘         └──────────────────┘
```

**How it works:**

1. **Desktop Agent** runs on your PC and connects to the server over WebSocket (Socket.IO).
2. A user sends a message in the web UI.
3. **Next.js API** forwards the request through the WS Server to the Desktop Agent.
4. **Agent** calls your local LLM (Ollama/LM Studio) and returns the answer.
5. The answer streams back and renders in the web UI.

**RAG:** a document is uploaded → parsed → chunked → embeddings are created via the Agent → relevant chunks are injected into the context on query.

**ComfyUI Tunnel:** the full ComfyUI SPA is proxied from the browser through the Agent (`/comfyui/*`) — HTML is rewritten, WebSocket is relayed through a unified port, auth via token/cookie.

## Quick Start

### Local Development

```bash
git clone https://github.com/PoStM0DeRn/EdgeChat.git
cd EdgeChat
npm install
npx prisma generate
npx prisma db push
```

Create `.env`:

```env
DATABASE_URL="file:./db/custom.db"
NEXTAUTH_SECRET="your-secret-at-least-32-characters"
NEXTAUTH_URL="http://localhost:3000"
WS_SERVER_URL="http://localhost:3000"
```

Run:

```bash
# Terminal 1 — Next.js
npm run dev

# Terminal 2 — WebSocket Server
npm run dev:ws

# Terminal 3 — Desktop Agent
cd agent
npm install
npm start
```

Open **http://localhost:3000**. Or use a single command — `npm run dev:all` (Next.js + WS Server).

## Docker Deploy on a VPS

### 1. Prepare

```bash
curl -fsSL https://get.docker.com | sh
git clone https://github.com/PoStM0DeRn/EdgeChat.git /opt/edgechat
cd /opt/edgechat
```

### 2. `.env`

```env
DATABASE_URL="file:/app/db/custom.db"
NEXTAUTH_SECRET="<openssl rand -base64 32>"
NEXTAUTH_URL="https://your-domain.com"
WS_SERVER_URL="http://ws-server:3000"
```

### 3. DNS

Point an A record of your domain to the server IP. Ports 80/443 must be open.

### 4. Launch

```bash
docker compose up -d --build
```

Caddy automatically obtains an SSL certificate via **Let's Encrypt**.

### Ports

| Service | Port | Access |
|---------|------|--------|
| Caddy (HTTPS) | 443 | From the internet |
| Caddy (HTTP) | 80 | Redirect to HTTPS |
| WS Server | 3000 | Single entry point (WebSocket + Next.js proxy) |
| Next.js | 3001 | Internal only (through WS Server) |

### Updating

```bash
git pull
docker compose down
docker compose up -d --build

# If the DB schema changed
docker compose exec app npx prisma db push
```

## Desktop Agent

### Installation

```bash
cd agent
npm install
npm start
```

### Connecting

1. Open the Agent app.
2. Enter the **server URL**: `https://your-domain.com`.
3. Copy the **token** from the web UI (Settings → Agent Tokens).
4. Paste the token into the "Agent Token" field.
5. Set the **LM Studio URL**: `http://localhost:1234` (default).
6. Click **"Connect"**.

Tokens are tied to a user account, with no limits.

## Configuration

### Environment Variables (.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Path to the SQLite database |
| `NEXTAUTH_SECRET` | Yes | Secret for JWT sessions (min. 32 characters) |
| `NEXTAUTH_URL` | Yes | Base URL of the app |
| `WS_SERVER_URL` | No | WS Server URL (default `http://localhost:3000`) |

### LLM Models

Any model available through Ollama or LM Studio is supported:

- Qwen 2.5 (recommended for Russian)
- Mistral
- Llama 3
- Gemma
- any other compatible models

### Embedding Model

RAG uses an embedding model (by default `nomic-embed-text` via Ollama).

## Project Structure

<details>
<summary>Expand structure</summary>

```
EdgeChat/
├── src/
│   ├── app/
│   │   ├── chat.tsx              # Main chat UI
│   │   ├── layout.tsx            # Root layout
│   │   ├── login/                # Login page
│   │   ├── register/             # Register page
│   │   ├── landing/              # Landing page
│   │   ├── comfyui/              # ComfyUI tunnel (proxy + HTML rewrite)
│   │   └── api/
│   │       ├── chat/route.ts     # LLM request proxy
│   │       ├── agent/            # Tokens, verification, status
│   │       ├── documents/        # Document upload & embedding
│   │       ├── prompts/          # Prompts CRUD
│   │       ├── sessions/         # Chat sessions CRUD
│   │       ├── generate-image/   # Image generation via ComfyUI
│   │       └── upload/           # File upload
│   ├── components/
│   │   ├── ui/                   # shadcn/ui components
│   │   ├── chat/                 # Chat components
│   │   ├── landing/              # Landing sections
│   │   └── onboarding/           # Onboarding tour
│   └── lib/
│       ├── db.ts                 # Prisma client
│       ├── store.ts              # Zustand state
│       ├── auth.ts               # NextAuth config
│       ├── rag.ts                # Hybrid RAG search
│       ├── embeddings.ts         # Embeddings
│       ├── chunker.ts            # Text chunking
│       ├── pdf-parser.ts         # PDF/TXT/MD parsing
│       └── donation.ts           # Boosty link
├── server/
│   ├── ws-server.js              # Socket.IO bridge (SaaS ↔ Agent)
│   └── Dockerfile.ws             # WS Server Docker image
├── agent/
│   ├── main.js                   # Electron: connect + proxy to LLM/ComfyUI
│   ├── preload.js                # Context bridge
│   └── index.html                # Agent UI
├── prisma/
│   └── schema.prisma             # Database schema
├── docker-compose.yml            # app + ws-server + caddy
├── Dockerfile                    # Multi-stage Next.js build
├── Caddyfile                     # Reverse proxy with auto-TLS
└── docker-entrypoint.sh          # DB initialization
```

</details>

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui |
| Backend | Next.js API Routes, Prisma ORM |
| Database | SQLite |
| WebSocket | Socket.IO + ws |
| Desktop Agent | Electron |
| Auth | NextAuth.js (Credentials + JWT) |
| State | Zustand (with persist) |
| Reverse Proxy | Caddy (auto-TLS, Let's Encrypt) |
| Containerization | Docker, Docker Compose |

## Known Limitations

- `chat.tsx` is a monolith of ~1900 lines (refactoring planned)
- SQLite is not suitable for horizontal scaling
- Rate limiting is in-memory (not for clusters)

## Support the Project

The project is **completely free and unlimited** — and will always stay that way.

If you'd like to say thanks and help cover server costs — make a voluntary donation via [Boosty](https://boosty.to/edgechat/donate).

<div align="center">

**[edgechat.ru](https://edgechat.ru)** · **EdgeChat** · **Your Local AI, Anywhere**

</div>
