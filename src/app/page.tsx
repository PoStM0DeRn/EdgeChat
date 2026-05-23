'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useChatStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Send,
  Settings,
  MessageCircle,
  Wifi,
  WifiOff,
  Loader2,
  Trash2,
  CheckCircle2,
  XCircle,
  Server,
  Shield,
  Bot,
  User,
} from 'lucide-react'

export default function Home() {
  const {
    settings,
    setSettings,
    messages,
    isStreaming,
    addMessage,
    appendToLastAssistantMessage,
    setIsStreaming,
    clearMessages,
    healthStatus,
    healthModels,
    healthEndpoint,
    setHealthStatus,
  } = useChatStore()

  const [input, setInput] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [streamError, setStreamError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Health check
  const checkHealth = useCallback(async () => {
    if (!settings.tunnelUrl) return
    setHealthStatus('checking')
    try {
      const res = await fetch('/api/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tunnelUrl: settings.tunnelUrl,
          token: settings.token || undefined,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setHealthStatus('connected', data.models, data.endpoint)
        // Auto-fill model if not set and models available
        if (!settings.model && data.models?.length > 0) {
          setSettings({ model: data.models[0] })
        }
      } else {
        setHealthStatus('error')
      }
    } catch {
      setHealthStatus('error')
    }
  }, [settings.tunnelUrl, settings.token, settings.model, setSettings, setHealthStatus])

  // Send message and stream response
  const sendMessage = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return

    if (!settings.tunnelUrl) {
      setStreamError('Укажите URL туннеля в настройках')
      setSettingsOpen(true)
      return
    }

    setStreamError(null)
    setInput('')

    // Add user message
    addMessage({ role: 'user', content: trimmed })

    // Add empty assistant message (will be filled by stream)
    addMessage({ role: 'assistant', content: '' })
    setIsStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const chatMessages = [
        ...messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: trimmed },
      ]

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatMessages,
          tunnelUrl: settings.tunnelUrl,
          token: settings.token || undefined,
          model: settings.model || undefined,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        setStreamError(
          errorData.error || `Ошибка сервера: ${res.status}`
        )
        setIsStreaming(false)
        return
      }

      // Read SSE stream
      const reader = res.body?.getReader()
      if (!reader) {
        setStreamError('Нет потока ответа')
        setIsStreaming(false)
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmedLine = line.trim()
          if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue

          const data = trimmedLine.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            if (parsed.error) {
              setStreamError(parsed.error)
            } else if (parsed.content) {
              appendToLastAssistantMessage(parsed.content)
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setStreamError(`Ошибка соединения: ${err.message}`)
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [
    input,
    isStreaming,
    settings,
    messages,
    addMessage,
    appendToLastAssistantMessage,
    setIsStreaming,
  ])

  // Stop streaming
  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
    setIsStreaming(false)
  }, [setIsStreaming])

  // Handle Enter key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    },
    [sendMessage]
  )

  // Health status icon
  const HealthIcon = () => {
    if (healthStatus === 'checking')
      return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
    if (healthStatus === 'connected')
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    if (healthStatus === 'error')
      return <XCircle className="h-4 w-4 text-red-500" />
    return <WifiOff className="h-4 w-4 text-muted-foreground" />
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-4 py-3 bg-card">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">
              Дырявый чат
            </h1>
            <p className="text-xs text-muted-foreground">
              MVP — Проксирование к локальной LLM
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-sm">
            <HealthIcon />
            <span className="hidden sm:inline text-muted-foreground">
              {healthStatus === 'connected'
                ? 'Подключено'
                : healthStatus === 'checking'
                  ? 'Проверка...'
                  : healthStatus === 'error'
                    ? 'Ошибка'
                    : 'Не подключено'}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingsOpen(!settingsOpen)}
          >
            <Settings className="h-4 w-4 mr-1" />
            Настройки
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Settings Sidebar */}
        {settingsOpen && (
          <div className="w-80 border-r bg-card flex flex-col shrink-0">
            <div className="p-4 border-b">
              <h2 className="font-semibold flex items-center gap-2">
                <Server className="h-4 w-4" />
                Подключение
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Tunnel URL */}
              <div className="space-y-2">
                <Label htmlFor="tunnel-url" className="text-sm font-medium">
                  URL вашего туннеля
                </Label>
                <Input
                  id="tunnel-url"
                  type="url"
                  placeholder="https://my-llm.ngrok.io"
                  value={settings.tunnelUrl}
                  onChange={(e) =>
                    setSettings({ tunnelUrl: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Ngrok, Cloudflare Tunnel, LocalTunnel и т.д.
                </p>
              </div>

              {/* Bearer Token */}
              <div className="space-y-2">
                <Label htmlFor="token" className="text-sm font-medium">
                  <span className="flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5" />
                    Bearer Token
                  </span>
                </Label>
                <Input
                  id="token"
                  type="password"
                  placeholder="Необязательно"
                  value={settings.token}
                  onChange={(e) =>
                    setSettings({ token: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Если ваш эндпоинт защищён авторизацией
                </p>
              </div>

              {/* Model name */}
              <div className="space-y-2">
                <Label htmlFor="model" className="text-sm font-medium">
                  Модель
                </Label>
                <Input
                  id="model"
                  type="text"
                  placeholder="llama3, mistral, gpt-4..."
                  value={settings.model}
                  onChange={(e) =>
                    setSettings({ model: e.target.value })
                  }
                />
                {healthModels.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Доступные модели:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {healthModels.map((m) => (
                        <Badge
                          key={m}
                          variant={
                            settings.model === m ? 'default' : 'secondary'
                          }
                          className="cursor-pointer text-xs"
                          onClick={() => setSettings({ model: m })}
                        >
                          {m}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Health Check Button */}
              <div className="space-y-2">
                <Button
                  onClick={checkHealth}
                  disabled={!settings.tunnelUrl || healthStatus === 'checking'}
                  className="w-full"
                  variant={
                    healthStatus === 'connected' ? 'default' : 'outline'
                  }
                >
                  {healthStatus === 'checking' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Wifi className="h-4 w-4 mr-2" />
                  )}
                  Проверить подключение
                </Button>

                {healthStatus === 'connected' && (
                  <div className="rounded-md bg-green-500/10 border border-green-500/20 p-3 text-sm">
                    <div className="flex items-center gap-2 text-green-600 font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      Подключение установлено
                    </div>
                    {healthEndpoint && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Эндпоинт: {healthEndpoint}
                      </p>
                    )}
                    {healthModels.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Моделей найдено: {healthModels.length}
                      </p>
                    )}
                  </div>
                )}

                {healthStatus === 'error' && (
                  <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 text-sm">
                    <div className="flex items-center gap-2 text-red-600 font-medium">
                      <XCircle className="h-4 w-4" />
                      Не удалось подключиться
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Убедитесь, что туннель активен и модель запущена
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Chat Area */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center space-y-4 max-w-md">
                  <div className="flex justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <MessageCircle className="h-8 w-8" />
                    </div>
                  </div>
                  <h2 className="text-xl font-semibold">Начните диалог</h2>
                  <p className="text-sm text-muted-foreground">
                    Введите URL вашего туннеля в настройках, проверьте
                    подключение и отправьте первое сообщение. Текст будет
                    появляться по токенам в реальном времени.
                  </p>
                  {!settings.tunnelUrl && (
                    <Button
                      variant="outline"
                      onClick={() => setSettingsOpen(true)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Открыть настройки
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-w-3xl mx-auto">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={`rounded-2xl px-4 py-3 max-w-[80%] ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                        {message.content || (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Генерация...
                          </span>
                        )}
                      </div>
                    </div>
                    {message.role === 'user' && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground mt-0.5">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Error banner */}
          {streamError && (
            <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20">
              <div className="flex items-center gap-2 text-sm text-red-600 max-w-3xl mx-auto">
                <XCircle className="h-4 w-4 shrink-0" />
                <span>{streamError}</span>
                <button
                  onClick={() => setStreamError(null)}
                  className="ml-auto text-red-400 hover:text-red-600"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="border-t bg-card p-4">
            <div className="flex items-end gap-2 max-w-3xl mx-auto">
              <div className="flex-1 relative">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    settings.tunnelUrl
                      ? 'Введите сообщение... (Enter — отправить, Shift+Enter — новая строка)'
                      : 'Сначала укажите URL туннеля в настройках'
                  }
                  disabled={!settings.tunnelUrl || isStreaming}
                  className="min-h-[44px] max-h-[200px] resize-none pr-2"
                  rows={1}
                />
              </div>
              {isStreaming ? (
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={stopStreaming}
                  className="h-11 w-11 shrink-0"
                >
                  <span className="h-4 w-4">■</span>
                </Button>
              ) : (
                <Button
                  size="icon"
                  onClick={sendMessage}
                  disabled={!input.trim() || !settings.tunnelUrl}
                  className="h-11 w-11 shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearMessages}
                  className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive"
                  title="Очистить историю"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="flex justify-between mt-2 max-w-3xl mx-auto">
              <p className="text-xs text-muted-foreground">
                {settings.tunnelUrl
                  ? `→ ${settings.tunnelUrl}`
                  : 'Туннель не настроен'}
                {settings.model && ` | Модель: ${settings.model}`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
