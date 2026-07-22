# EdgeChat (TunnelChat)

Прокси к локальной LLM через Desktop Agent — без проброса портов и ngrok.

Загружайте документы, векторизуйте их и получайте ответы на основе вашей базы знаний. Всё работает через WebSocket-мост между SaaS-интерфейсом и вашим локальным компьютером.

**Free** — 10 документов, 30 сессий, 3 токена агента.
**Pro** ($5/мес или $50/год) — 50 документов, безлимитные сессии, 10 токенов, повышенный rate limit.

## Возможности

- **Чат с локальной LLM** — подключается к Ollama / LM Studio через Desktop Agent
- **RAG** — загрузка документов (PDF, TXT, MD) → чанкинг → векторизация → ответы на основе документа
- **Гибридный поиск** — комбинация keyword-поиска (60%) и cosine similarity (40%)
- **Сессии** — полный CRUD чат-сессий с историей сообщений
- **Промпты** — системные промпты (6 дефолтных + пользовательские)
- **Agent Tokens** — DB-backed токены привязаны к аккаунту, можно отозвать
- **Free/Pro подписка** — Stripe, лимиты по плану
- **Авторизация** — регистрация / логин через NextAuth + JWT
- **Rate limiting** — защита API от злоупотреблений
- **Мобильный адаптив** — `dvh` viewport, touch-оптимизации
- **Docker деплой** — один `docker compose up` на любой VPS

## Архитектура

```
┌─────────────┐     ┌──────────────┐     ┌───────────────────────────┐     ┌──────────────┐
│  Браузер    │────▶│  Caddy       │────▶│  WS Server (:3000)       │────▶│  Next.js     │
│  (SaaS UI)  │◀────│  (:443)      │◀────│  (прокси + WS + Socket.IO)│◀────│  (:3001)     │
└─────────────┘     └──────────────┘     └───────────────────────────┘     └──────┬───────┘
                                                                       │
                                                                       ▼
                                                              ┌────────────────┐
                                                              │  Desktop       │
                                                              │  Agent         │
                                                              │  (Electron)    │
                                                              └───────┬────────┘
                                                                      │
                                                                      ▼
                                                             ┌─────────────────┐
                                                             │  Ollama /       │
                                                             │  LM Studio      │
                                                             │  (localhost)    │
                                                             └─────────────────┘
```

1. **Desktop Agent** запускается на вашем ПК и подключается к серверу через WebSocket
2. **Пользователь** отправляет сообщение в веб-интерфейсе
3. **Next.js API** перенаправляет запрос через WS Server на Desktop Agent
4. **Agent** вызывает локальную LLM (Ollama/LM Studio) и возвращает ответ
5. **Ответ** отображается в веб-интерфейсе

Для RAG: документ загружается → парсится → чанкуется → эмбеддинги создаются через Agent → при запросе релевантные чанки инжектируются в контекст.

## Требования

- **Node.js** 20+
- **Docker** + **Docker Compose** — для деплоя на VPS (рекомендуется)
- **Ollama** или **LM Studio** — запущенные на вашем ПК
- **Stripe аккаунт** — для приёма платежей (опционально, только для Pro)

## Быстрый старт (локальная разработка)

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

### Запуск

**Терминал 1 — Next.js:**
```bash
npm run dev
```

**Терминал 2 — WebSocket Server:**
```bash
npm run dev:ws
```

**Терминал 3 — Desktop Agent:**
```bash
cd agent
npm install
npm start
```

Откройте http://localhost:3000.

Или одной командой: `npm run dev:all` (Next.js + WS Server).

## Docker деплой (VPS)

### 1. Подготовка VPS

```bash
# Установка Docker
curl -fsSL https://get.docker.com | sh

# Клонирование репозитория
git clone https://github.com/PoStM0DeRn/EdgeChat.git /opt/edgechat
cd /opt/edgechat
```

### 2. Создайте `.env`

```env
DATABASE_URL="file:/app/db/custom.db"
NEXTAUTH_SECRET="<openssl rand -base64 32>"
NEXTAUTH_URL="https://ваш-домен.ru"
WS_SERVER_URL="http://ws-server:3000"

# Stripe (опционально, для Pro-подписки)
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PRICE_MONTHLY="price_monthly_xxx"
NEXT_PUBLIC_STRIPE_PRICE_YEARLY="price_yearly_xxx"
```

### 3. Настройте DNS

A-запись вашего домена → IP сервера.

### 4. Запуск

```bash
docker compose up -d --build
```

Caddy автоматически получит SSL-сертификат через Let's Encrypt.

### 5. Настройка Stripe (для Pro)

В Stripe Dashboard:
1. Создайте товар **EdgeChat Pro** с двумя ценами: $5/мес и $50/год
2. Скопируйте `price_xxx` ID в `.env`
3. Добавьте Webhook endpoint: `https://ваш-домен.ru/api/stripe/webhook`
   - События: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

### Порты

| Сервис | Порт | Доступ |
|--------|------|--------|
| Caddy (HTTPS) | 443 | Из интернета |
| Caddy (HTTP) | 80 | Редирект на HTTPS |
| WS Server | 3000 | Единая точка входа (WebSocket + прокси Next.js) |
| Next.js | 3001 | Только internal (через WS Server) |

### Остановка и обновление

```bash
# Остановка
docker compose down

# Обновление
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

1. Откройте приложение Agent
2. Введите **URL сервера**: `https://ваш-домен.ru`
3. Скопируйте **токен** из веб-интерфейса (Настройки → Токены Агента)
4. Вставьте токен в поле "Токен Агента"
5. Укажите **URL LM Studio**: `http://localhost:1234` (по умолчанию)
6. Нажмите "Подключить"

### Токены агентов

Токены привязаны к аккаунту пользователя. Лимит зависит от плана:
- **Free**: до 3 активных токенов
- **Pro**: до 10 активных токенов

## Конфигурация

### Переменные окружения (.env)

| Переменная | Обязательна | Описание |
|-----------|-------------|----------|
| `DATABASE_URL` | Да | Путь к SQLite базе данных |
| `NEXTAUTH_SECRET` | Да | Секрет для JWT-сессий (мин. 32 символа) |
| `NEXTAUTH_URL` | Да | Базовый URL приложения |
| `WS_SERVER_URL` | Нет | URL WS Server (по умолчанию `http://localhost:3000`) |
| `STRIPE_SECRET_KEY` | Для Pro | Secret ключ из Stripe Dashboard |
| `STRIPE_WEBHOOK_SECRET` | Для Pro | Webhook secret из Stripe Dashboard |
| `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY` | Для Pro | ID цены $5/мес в Stripe |
| `NEXT_PUBLIC_STRIPE_PRICE_YEARLY` | Для Pro | ID цены $50/год в Stripe |

### Тарифы

| Фича | Free | Pro |
|------|------|-----|
| Документы | 10 | 50 |
| Сессии чата | 30 | безлимит |
| Токены агента | 3 | 10 |
| Кастомные промпты | ✅ | ✅ |
| Запросов к LLM / мин | 30 | 120 |
| Цена | $0 | $5/мес или $50/год |

### Модели LLM

Поддерживаются любые модели, доступные через Ollama или LM Studio:
- Qwen 2.5 (рекомендуется для русского языка)
- Mistral
- Llama 3
- любые другие совместимые модели

### Модель эмбеддингов

Для RAG используется модель эмбеддингов (по умолчанию `nomic-embed-text` через Ollama).

## Структура проекта

```
EdgeChat/
├── src/
│   ├── app/
│   │   ├── chat.tsx              # Основной UI чата
│   │   ├── layout.tsx            # Корневой layout
│   │   ├── login/                # Страница логина
│   │   ├── register/             # Страница регистрации
│   │   ├── landing/              # Лендинг
│   │   └── api/
│   │       ├── chat/route.ts     # Прокси запросов к LLM
│   │       ├── agent/
│   │       │   ├── tokens/       # CRUD токенов агентов
│   │       │   ├── verify/route.ts
│   │       │   └── status/route.ts
│   │       ├── documents/        # Загрузка и эмбеддинг документов
│   │       ├── prompts/          # CRUD промптов
│   │       ├── sessions/         # CRUD сессий чата
│   │       └── stripe/           # Stripe checkout, webhook, portal, status
│   ├── components/
│   │   ├── ui/                   # shadcn/ui компоненты
│   │   └── chat/
│   │       └── markdown-message.tsx
│   └── lib/
│       ├── db.ts                 # Prisma клиент
│       ├── store.ts              # Zustand состояние
│       ├── auth.ts               # NextAuth конфиг
│       ├── auth-helpers.ts       # Хелперы для сессии
│       ├── plan-limits.ts        # Лимиты Free/Pro
│       ├── stripe.ts             # Stripe клиент
│       ├── rag.ts                # Гибридный RAG-поиск
│       ├── rate-limit.ts         # Rate limiting
│       ├── chunker.ts            # Чанкинг текста
│       ├── embeddings.ts         # Эмбеддинги
│       └── pdf-parser.ts         # Парсинг PDF/TXT/MD
├── server/
│   ├── ws-server.js              # Socket.IO сервер (мост SaaS ↔ Agent)
│   └── Dockerfile.ws             # Docker-образ для WS сервера
├── agent/
│   ├── main.js                   # Electron: подключение к WS + прокси к LLM
│   ├── preload.js                # Context bridge
│   └── index.html                # UI агента
├── prisma/
│   └── schema.prisma             # Схема базы данных
├── docker-compose.yml            # Docker Compose (app + ws-server + caddy)
├── Dockerfile                    # Мульти-stage сборка Next.js
├── Caddyfile                     # Reverse proxy с авто-TLS
└── docker-entrypoint.sh          # Инициализация БД при первом запуске
```

## Технологии

| Компонент | Технология |
|-----------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui |
| Backend | Next.js API Routes, Prisma ORM |
| База данных | SQLite |
| WebSocket | Socket.IO |
| Desktop Agent | Electron |
| Аутентификация | NextAuth.js (Credentials + JWT) |
| Платежи | Stripe |
| Состояние | Zustand (с persist) |
| Reverse Proxy | Caddy |
| Контейнеризация | Docker, Docker Compose |

## Известные ограничения

- Стриминг ответов буферизуется (фейковый SSE) — вся генерация приходит разом
- `chat.tsx` — монолит на ~1900 строк (запланирован рефакторинг)
- SQLite не подходит для горизонтального масштабирования
- Rate limiting работает в in-memory (не для кластера)
