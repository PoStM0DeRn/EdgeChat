# Phase 2 Implementation — RAG, Prompts, Model Management

## Task ID: phase2-implementation
## Agent: Main Developer
## Date: 2026-05-23

## Summary

Successfully implemented Phase 2 of "Дырявый чат" with RAG capabilities, system prompts library, and model management.

## Changes Made

### 1. Prisma Schema (Updated)
- Replaced `User` and `Post` models with: `Document`, `DocumentChunk`, `Prompt`, `ChatSession`, `ChatMessage`
- Document stores file metadata + status tracking (uploading → processing → parsed → embedded → error)
- DocumentChunk stores text content + embedding vectors as JSON strings
- Prompt supports default/user-created prompts with isDefault/isPublic flags
- ChatSession/ChatMessage for future session persistence

### 2. Utility Libraries Created
- `src/lib/chunker.ts` — Text chunking with ~500 token chunks, 100 token overlap, smart paragraph/sentence boundary detection
- `src/lib/embeddings.ts` — Ollama-native and OpenAI-compatible embedding endpoints, cosine similarity computation
- `src/lib/pdf-parser.ts` — PDF, TXT, MD file parsing using pdf-parse
- `src/lib/default-prompts.ts` — 6 default Russian-language system prompts (Ассистент, Программист, Юрист, Рерайт, RAG-ассистент, Аналитик данных)

### 3. API Routes Created
- `POST /api/documents/upload` — File upload, parsing, chunking, saves to disk
- `POST /api/documents/embed` — Vectorizes chunks via user's Ollama tunnel
- `GET/DELETE /api/documents` — List and delete documents
- `GET/POST /api/prompts` — List and create prompts
- `PUT/DELETE /api/prompts/[id]` — Update and delete individual prompts

### 4. Chat API Enhanced (RAG)
- Removed `export const runtime = 'edge'` (Prisma requires Node.js runtime)
- Added `documentId` and `systemPrompt` parameters
- RAG flow: vectorize query → find top-5 similar chunks → inject context into system prompt
- Graceful fallback when embeddings unavailable (uses first 3 chunks)

### 5. Zustand Store Enhanced
- Added: documents, selectedDocumentId, prompts, selectedPromptId
- Added: sidebarTab, settingsOpen UI state
- Added: embedModel to settings
- Persisted: settings, messages, selectedDocumentId, selectedPromptId
- Migrated storage key to `leaky-chat-storage-v2`

### 6. Complete UI Rewrite
- Collapsible left sidebar (320px) with 3 tabs: Settings, Documents, Prompts
- Settings tab: tunnel URL, token, chat model, embedding model, health check
- Documents tab: file upload, document list with status badges, vectorize/select/delete actions
- Prompts tab: create dialog, prompt list with select/delete, default badge
- Chat area: context bar showing active RAG doc + prompt, message bubbles, streaming indicator
- Error banner, stop button, clear history
- All UI in Russian

### 7. Key Architecture Decisions
- SQLite + Prisma for persistence (no pgvector, embeddings as JSON strings)
- Cosine similarity computed in JavaScript at query time
- Files stored locally at `/home/z/my-project/uploads/{docId}/{filename}`
- Embeddings use user's Ollama tunnel (Variant B)
- No edge runtime for Prisma routes

## Verification
- `bun run lint` — passed with no errors
- `bun run db:push` — schema applied successfully
- Dev server logs show successful compilation and API responses
- Both `/api/prompts` and `/api/documents` returning data correctly
