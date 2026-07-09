# EdgeChat (TunnelChat)

Прокси к локальной LLM через Desktop Agent — без проброса портов и ngrok.

Загружайте документы, векторизуйте их и получайте ответы на основе вашей базы знаний. Всё работает через WebSocket-мост между SaaS-интерфейсом и вашим локальным компьютером.

## Возможности

- **Чат с локальной LLM** — подключается к Ollama / LM Studio через Desktop Agent
- **RAG** — загрузка документов (PDF, TXT, MD) → чанкинг → векторизация → ответы на основе документа
- **Гибридный поиск** — комбинация keyword-поиска (60%) и cosine similarity (40%)
- **Сессии** — полный CRUD чат-сессий с историей сообщений
- **Промпты** — системные промпты (6 дефолтных + пользовательские)
- **Agent Tokens** — DB-backed токены привязаны к аккаунту, можно отозвать
- **Авторизация** — регистрация / логин через NextAuth + JWT
- **Rate limiting** — защита API от злоупотреблений
- **Мобильный адаптив** — `dvh` viewport, touch-оптимизации
- **Docker деплой** — один `docker-compose up` на любой VPS

## Архитектура

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐     ┌──────────────┐
│  Браузер    │────▶│  Next.js     │────▶│  WS Server     │────▶│  Desktop     │
│  (SaaS UI)  │◀────│  (API)       │◀────│  (:3002)       │◀────│  Agent       │
└─────────────┘     └──────────────┘     └────────────────┘     └──────┬───────┘
                                                                       │
                                                                       ▼
                                                              ┌────────────────┐
                                                              │  Ollama /      │
                                                              │  LM Studio     │
                                                              │  (localhost)   │
                                                              └────────────────┘
```

1. **Desktop Agent** запускается на вашем ПК и подключается к серверу через WebSocket
2. **Пользователь** отправляет сообщение в веб-интерфейсе
3. **Next.js API** перенаправляет запрос через WS Server на Desktop Agent
4. **Agent** вызывает локальную LLM (Ollama/LM Studio) и возвращает ответ
5. **Ответ** отображается в веб-интерфейсе

Для RAG: документ загружается → парсится → чанкуется → эмбеддинги создаются через Agent → при запросе релевантные чанки инжектируются в контекст.

## Требования

- **Node.js** 20+
- **Bun** (для продакшена) или npm
- **Ollama** или **LM Studio** — запущенные на вашем ПК
- **Docker** + **Docker Compose** — для деплоя на VPS (опционально)

## Быстрый старт

### Клонирование

```bash
git clone https://github.com/PoStM0DeRn/EdgeChat.git
cd EdgeChat
```

### Установка зависимостей

```bash
npm install
```

### Настройка базы данных

```bash
npx prisma generate
npx prisma db push
```

### Настройка окружения

Создайте файл `.env` в корне проекта:

```env
DATABASE_URL="file:./db/custom.db"
NEXTAUTH_SECRET="ваш-секрет-минимум-32-символа"
NEXTAUTH_URL="http://localhost:3000"
WS_SERVER_URL="http://localhost:3002"
```

### Запуск разработки

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

Откройте http://localhost:3000 в браузере.

## Docker деплой

### На VPS

```bash
git clone https://github.com/PoStM0DeRn/EdgeChat.git
cd EdgeChat
```

Создайте `.env`:

```env
DATABASE_URL="file:/app/db/custom.db"
NEXTAUTH_SECRET="ваш-секрет-минимум-32-символа"
NEXTAUTH_URL="http://ваш-ip:3001"
```

Запуск:

```bash
docker-compose up -d --build
```

### Порты

| Сервис | Порт | Описание |
|--------|------|----------|
| SaaS (Next.js + Caddy) | 3001 | Веб-интерфейс |
| WS Server | 3002 | WebSocket-мост для Agent |

### Остановка

```bash
docker-compose down
```

### Пересборка после обновлений

```bash
git pull
docker-compose down
docker volume rm edgechat_db-data
docker-compose up -d --build
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
2. Введите **URL сервера**: `http://ваш-ip:3002`
3. Скопируйте **токен** из веб-интерфейса (Настройки → Токены Агента)
4. Вставьте токен в поле "Токен Агента"
5. Укажите **URL LM Studio**: `http://localhost:1234` (по умолчанию)
6. Нажмите "Подключить"

### Токены агентов

Токены привязаны к аккаунту пользователя. Можно:
- Генерировать новые токены (макс. 5 активных)
- Просматривать и копировать существующие
- Отзывать токены (агент сразу теряет доступ)

## Конфигурация

### Переменные окружения (.env)

| Переменная | Обязательна | Описание |
|-----------|-------------|----------|
| `DATABASE_URL` | Да | Путь к SQLite базе данных |
| `NEXTAUTH_SECRET` | Да | Секрет для JWT-сессий (мин. 32 символа) |
| `NEXTAUTH_URL` | Да | Базовый URL приложения |
| `WS_SERVER_URL` | Нет | URL WebSocket-сервера (по умолчанию `http://localhost:3002`) |

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
│   │   └── api/
│   │       ├── chat/route.ts     # Прокси запросов к LLM
│   │       ├── agent/
│   │       │   ├── tokens/       # CRUD токенов агентов
│   │       │   └── verify/route.ts # Верификация токена
│   │       ├── documents/        # Загрузка и эмбеддинг документов
│   │       ├── prompts/          # CRUD промптов
│   │       └── sessions/         # CRUD сессий чата
│   ├── components/
│   │   ├── ui/                   # shadcn/ui компоненты
│   │   └── chat/
│   │       └── markdown-message.tsx
│   ├── lib/
│   │   ├── db.ts                 # Prisma клиент
│   │   ├── store.ts              # Zustand состояние
│   │   ├── rag.ts                # Гибридный RAG-поиск
│   │   ├── rate-limit.ts         # Rate limiting
│   │   ├── chunker.ts            # Чанкинг текста
│   │   ├── embeddings.ts         # Эмбеддинги
│   │   └── pdf-parser.ts         # Парсинг PDF/TXT/MD
│   └── hooks/
│       └── use-mobile.ts         # Определение мобильного устройства
├── server/
│   └── ws-server.js              # Socket.IO сервер (мост SaaS ↔ Agent)
├── agent/
│   ├── main.js                   # Electron: подключение к WS + прокси к LLM
│   ├── preload.js                # Context bridge
│   └── index.html                # UI агента
├── prisma/
│   └── schema.prisma             # Схема базы данных
├── docker-compose.yml            # Docker Compose конфигурация
├── Dockerfile                    # Мульти-stage сборка
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
| Состояние | Zustand (с persist) |
| Reverse Proxy | Caddy |
| Контейнеризация | Docker, Docker Compose |

## Известные ограничения

- Стриминг ответов буферизуется (фейковый SSE) — вся генерация приходит разом
- `chat.tsx` — монолит на ~1900 строк (запланирован рефакторинг)
- SQLite не подходит для горизонтального масштабирования
- Rate limiting работает в in-memory (не для кластера)
