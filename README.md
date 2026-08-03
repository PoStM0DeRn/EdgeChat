<div align="center">

[English](README.en.md) · **Русский**

<img src="https://raw.githubusercontent.com/PoStM0DeRn/EdgeChat/main/public/logo.png" alt="EdgeChat" width="110" />

# EdgeChat

### Твой локальный AI из любой точки

Чат, ComfyUI и RAG через один **Desktop Agent** — без открытых портов, ngrok и VPN. Твои модели работают на твоём ПК, а управляешь ими из любого браузера.

[🌐 edgechat.ru](https://edgechat.ru) · [♡ Поддержать](https://boosty.to/edgechat/donate)

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

## Оглавление

- [Возможности](#возможности)
- [Скриншоты](#скриншоты)
- [Как это работает](#как-это-работает)
- [Архитектура](#архитектура)
- [Быстрый старт](#быстрый-старт)
- [Docker-деплой на VPS](#docker-деплой-на-vps)
- [Desktop Agent](#desktop-agent)
- [Конфигурация](#конфигурация)
- [Структура проекта](#структура-проекта)
- [Технологии](#технологии)
- [Известные ограничения](#известные-ограничения)
- [Поддержка проекта](#поддержка-проекта)

## Возможности

<table align="center">
  <tr>
    <td align="center">
      <b>Desktop Agent</b><br />
      <sub>Один Electron-агент для чата, генерации, ComfyUI и RAG. Запустил — и забыл.</sub>
    </td>
    <td align="center">
      <b>ComfyUI Tunnel</b><br />
      <sub>Полноценный редактор нодов в браузере через безопасный туннель — как будто ComfyUI стоит рядом.</sub>
    </td>
    <td align="center">
      <b>Доступ откуда угодно</b><br />
      <sub>Никаких открытых портов, ngrok или VPN. Агент сам выходит на связь через Socket.IO.</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <b>RAG Pipeline</b><br />
      <sub>Загружай документы (PDF, TXT, MD), векторизуй и получай ответы на основе своих данных.</sub>
    </td>
    <td align="center">
      <b>Multi-Model</b><br />
      <sub>Qwen, Llama, Mistral, Gemma — любые модели через Ollama или LM Studio.</sub>
    </td>
    <td align="center">
      <b>Генерация изображений</b><br />
      <sub>ComfyUI-генерация из чата с сохранением результата прямо в историю сообщений.</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <b>Безопасность</b><br />
      <sub>Токены агентов, NextAuth + JWT, rate limiting. Данные остаются на твоём компьютере.</sub>
    </td>
    <td align="center">
      <b>Стриминг ответов</b><br />
      <sub>Ответы приходят потоком (NDJSON), с разделением на thinking и content.</sub>
    </td>
    <td align="center">
      <b>Docker-деплой</b><br />
      <sub>Next.js + WS Server + Caddy разворачиваются на VPS одной командой.</sub>
    </td>
  </tr>
</table>

## Скриншоты

> Скриншоты скоро появятся здесь. Пока можно посмотреть живое демо — [edgechat.ru](https://edgechat.ru).

## Как это работает

1. **Установи Ollama / ComfyUI** — загрузи LLM через Ollama или LM Studio. Если нужно — запусти ComfyUI для генерации изображений.
2. **Запусти Desktop Agent** — установи Electron-агент на свой ПК и укажи токен доступа.
3. **Подключись к SaaS** — агент сам выходит на связь с облачным сервером через Socket.IO. Никаких портов наружу.
4. **Пользуйся с любого устройства** — открывай браузер на телефоне, планшете или ноутбуке: чат, генерация, ComfyUI, RAG. Всё доступно.

## Архитектура

```
             SaaS (облако / VPS)                               Твой компьютер
┌─────────────┐   ┌──────────────┐   ┌───────────────────┐   ┌──────────────────────┐
│   Браузер    │──▶│    Caddy     │──▶│  WS Server :3000  │──▶│   Desktop Agent      │
│  (SaaS UI)   │◀──│  :443 HTTPS  │◀──│  Socket.IO + WS   │◀──│     (Electron)       │
└─────────────┘   └──────────────┘   └────────┬──────────┘   └──────────┬───────────┘
                                              │                          │
                                         HTTP-прокси                 HTTP / WS
                                              ▼                          ▼
                                      ┌──────────────┐         ┌──────────────────┐
                                      │   Next.js    │         │  Ollama / LM Studio│
                                      │    :3001     │         │  ComfyUI :8188     │
                                      └──────────────┘         └──────────────────┘
```

**Как это работает:**

1. **Desktop Agent** запускается на твоём ПК и подключается к серверу через WebSocket (Socket.IO).
2. Пользователь отправляет сообщение в веб-интерфейсе.
3. **Next.js API** перенаправляет запрос через WS Server на Desktop Agent.
4. **Agent** вызывает локальную LLM (Ollama/LM Studio) и возвращает ответ.
5. Ответ стримится обратно и отображается в веб-интерфейсе.

**RAG:** документ загружается → парсится → чанкуется → эмбеддинги создаются через Agent → при запросе релевантные чанки инжектируются в контекст.

**ComfyUI Tunnel:** полный ComfyUI SPA проксируется из браузера через Agent (`/comfyui/*`) — HTML переписывается, WebSocket релеится через единый порт, авторизация через токен/куки.

## Быстрый старт

### Локальная разработка

```bash
git clone https://github.com/PoStM0DeRn/EdgeChat.git
cd EdgeChat
npm install
npx prisma generate
npx prisma db push
```

Создайте `.env`:

```env
DATABASE_URL="file:./db/custom.db"
NEXTAUTH_SECRET="ваш-секрет-минимум-32-символа"
NEXTAUTH_URL="http://localhost:3000"
WS_SERVER_URL="http://localhost:3000"
```

Запуск:

```bash
# Терминал 1 — Next.js
npm run dev

# Терминал 2 — WebSocket Server
npm run dev:ws

# Терминал 3 — Desktop Agent
cd agent
npm install
npm start
```

Откройте **http://localhost:3000**. Или одной командой — `npm run dev:all` (Next.js + WS Server).

## Docker-деплой на VPS

### 1. Подготовка

```bash
curl -fsSL https://get.docker.com | sh
git clone https://github.com/PoStM0DeRn/EdgeChat.git /opt/edgechat
cd /opt/edgechat
```

### 2. `.env`

```env
DATABASE_URL="file:/app/db/custom.db"
NEXTAUTH_SECRET="<openssl rand -base64 32>"
NEXTAUTH_URL="https://ваш-домен.ru"
WS_SERVER_URL="http://ws-server:3000"
```

### 3. DNS

A-запись вашего домена → IP сервера. Порт 80/443 должны быть открыты.

### 4. Запуск

```bash
docker compose up -d --build
```

Caddy автоматически получит SSL-сертификат через **Let's Encrypt**.

### Порты

| Сервис | Порт | Доступ |
|--------|------|--------|
| Caddy (HTTPS) | 443 | Из интернета |
| Caddy (HTTP) | 80 | Редирект на HTTPS |
| WS Server | 3000 | Единая точка входа (WebSocket + прокси Next.js) |
| Next.js | 3001 | Только internal (через WS Server) |

### Обновление

```bash
git pull
docker compose down
docker compose up -d --build

# Если изменилась схема БД
docker compose exec app npx prisma db push
```

## Desktop Agent

### Установка

```bash
cd agent
npm install
npm start
```

### Подключение

1. Откройте приложение Agent.
2. Введите **URL сервера**: `https://ваш-домен.ru`.
3. Скопируйте **токен** из веб-интерфейса (Настройки → Токены Агента).
4. Вставьте токен в поле «Токен Агента».
5. Укажите **URL LM Studio**: `http://localhost:1234` (по умолчанию).
6. Нажмите **«Подключить»**.

Токены привязаны к аккаунту пользователя, лимитов нет.

## Конфигурация

### Переменные окружения (.env)

| Переменная | Обязательна | Описание |
|-----------|-------------|----------|
| `DATABASE_URL` | Да | Путь к SQLite базе данных |
| `NEXTAUTH_SECRET` | Да | Секрет для JWT-сессий (мин. 32 символа) |
| `NEXTAUTH_URL` | Да | Базовый URL приложения |
| `WS_SERVER_URL` | Нет | URL WS Server (по умолчанию `http://localhost:3000`) |

### Модели LLM

Поддерживаются любые модели, доступные через Ollama или LM Studio:

- Qwen 2.5 (рекомендуется для русского языка)
- Mistral
- Llama 3
- Gemma
- любые другие совместимые модели

### Модель эмбеддингов

Для RAG используется модель эмбеддингов (по умолчанию `nomic-embed-text` через Ollama).

## Структура проекта

<details>
<summary>Раскрыть структуру</summary>

```
EdgeChat/
├── src/
│   ├── app/
│   │   ├── chat.tsx              # Основной UI чата
│   │   ├── layout.tsx            # Корневой layout
│   │   ├── login/                # Страница логина
│   │   ├── register/             # Страница регистрации
│   │   ├── landing/              # Лендинг
│   │   ├── comfyui/              # ComfyUI-туннель (прокси + HTML-rewrite)
│   │   └── api/
│   │       ├── chat/route.ts     # Прокси запросов к LLM
│   │       ├── agent/            # Токены, верификация, статус
│   │       ├── documents/        # Загрузка и эмбеддинг документов
│   │       ├── prompts/          # CRUD промптов
│   │       ├── sessions/         # CRUD сессий чата
│   │       ├── generate-image/   # Генерация изображений через ComfyUI
│   │       └── upload/           # Загрузка файлов
│   ├── components/
│   │   ├── ui/                   # shadcn/ui компоненты
│   │   ├── chat/                 # Компоненты чата
│   │   ├── landing/              # Секции лендинга
│   │   └── onboarding/           # Онбординг-тур
│   └── lib/
│       ├── db.ts                 # Prisma клиент
│       ├── store.ts              # Zustand состояние
│       ├── auth.ts               # NextAuth конфиг
│       ├── rag.ts                # Гибридный RAG-поиск
│       ├── embeddings.ts         # Эмбеддинги
│       ├── chunker.ts            # Чанкинг текста
│       ├── pdf-parser.ts         # Парсинг PDF/TXT/MD
│       └── donation.ts           # Ссылка на Boosty
├── server/
│   ├── ws-server.js              # Socket.IO мост (SaaS ↔ Agent)
│   └── Dockerfile.ws             # Docker-образ WS сервера
├── agent/
│   ├── main.js                   # Electron: подключение + прокси к LLM/ComfyUI
│   ├── preload.js                # Context bridge
│   └── index.html                # UI агента
├── prisma/
│   └── schema.prisma             # Схема базы данных
├── docker-compose.yml            # app + ws-server + caddy
├── Dockerfile                    # Мульти-stage сборка Next.js
├── Caddyfile                     # Reverse proxy с авто-TLS
└── docker-entrypoint.sh          # Инициализация БД
```

</details>

## Технологии

| Компонент | Технология |
|-----------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui |
| Backend | Next.js API Routes, Prisma ORM |
| База данных | SQLite |
| WebSocket | Socket.IO + ws |
| Desktop Agent | Electron |
| Аутентификация | NextAuth.js (Credentials + JWT) |
| Состояние | Zustand (с persist) |
| Reverse Proxy | Caddy (авто-TLS, Let's Encrypt) |
| Контейнеризация | Docker, Docker Compose |

## Известные ограничения

- `chat.tsx` — монолит на ~1900 строк (запланирован рефакторинг)
- SQLite не подходит для горизонтального масштабирования
- Rate limiting работает in-memory (не для кластера)

## Поддержка проекта

Проект **полностью бесплатный и без лимитов** — и останется таким.

Если хочешь сказать спасибо и помочь покрыть серверные расходы — сделай добровольный донат через [Boosty](https://boosty.to/edgechat/donate).

<div align="center">

**[edgechat.ru](https://edgechat.ru)** · **EdgeChat** · **Твой локальный AI из любой точки**

</div>
