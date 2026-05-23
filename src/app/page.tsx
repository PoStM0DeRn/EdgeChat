'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useChatStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Send,
  Settings,
  FileText,
  MessageCircle,
  Wifi,
  WifiOff,
  Loader2,
  Trash2,
  CheckCircle2,
  XCircle,
  Bot,
  User,
  Upload,
  BookOpen,
  Sparkles,
  Plus,
  File,
  X,
  Server,
  Shield,
  PanelLeftClose,
  PanelLeft,
  Database,
  Play,
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
    documents,
    setDocuments,
    selectedDocumentId,
    setSelectedDocumentId,
    prompts,
    setPrompts,
    selectedPromptId,
    setSelectedPromptId,
    sidebarTab,
    setSidebarTab,
    settingsOpen,
    setSettingsOpen,
  } = useChatStore()

  const [input, setInput] = useState('')
  const [streamError, setStreamError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [embeddingDocId, setEmbeddingDocId] = useState<string | null>(null)
  const [promptDialogOpen, setPromptDialogOpen] = useState(false)
  const [newPromptTitle, setNewPromptTitle] = useState('')
  const [newPromptContent, setNewPromptContent] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load documents on mount
  useEffect(() => {
    loadDocuments()
  }, [])

  // Load prompts on mount
  useEffect(() => {
    loadPrompts()
  }, [])

  const loadDocuments = useCallback(async () => {
    try {
      const res = await fetch('/api/documents')
      if (res.ok) {
        const data = await res.json()
        setDocuments(data)
      }
    } catch (err) {
      console.error('Failed to load documents:', err)
    }
  }, [setDocuments])

  const loadPrompts = useCallback(async () => {
    try {
      const res = await fetch('/api/prompts')
      if (res.ok) {
        const data = await res.json()
        setPrompts(data)
      }
    } catch (err) {
      console.error('Failed to load prompts:', err)
    }
  }, [setPrompts])

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

    addMessage({ role: 'user', content: trimmed })
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

      // Get system prompt content
      const systemPrompt = selectedPromptId
        ? prompts.find((p) => p.id === selectedPromptId)?.content
        : undefined

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatMessages,
          tunnelUrl: settings.tunnelUrl,
          token: settings.token || undefined,
          model: settings.model || undefined,
          documentId: selectedDocumentId || undefined,
          systemPrompt,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        setStreamError(errorData.error || `Ошибка сервера: ${res.status}`)
        setIsStreaming(false)
        return
      }

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
    selectedDocumentId,
    selectedPromptId,
    prompts,
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

  // File upload handler
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      if (!settings.tunnelUrl) {
        setStreamError('Укажите URL туннеля в настройках для загрузки файлов')
        setSettingsOpen(true)
        return
      }

      setUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          setStreamError(errorData.error || 'Ошибка загрузки файла')
        } else {
          await loadDocuments()
        }
      } catch (err) {
        setStreamError('Ошибка загрузки файла')
        console.error(err)
      } finally {
        setUploading(false)
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    },
    [settings.tunnelUrl, loadDocuments]
  )

  // Vectorize document
  const embedDocument = useCallback(
    async (docId: string) => {
      if (!settings.tunnelUrl) {
        setStreamError('Укажите URL туннеля в настройках для векторизации')
        return
      }
      setEmbeddingDocId(docId)
      try {
        const res = await fetch('/api/documents/embed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId: docId,
            tunnelUrl: settings.tunnelUrl,
            token: settings.token || undefined,
            embedModel: settings.embedModel || 'nomic-embed-text',
          }),
        })

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          setStreamError(errorData.error || 'Ошибка векторизации')
        } else {
          await loadDocuments()
        }
      } catch (err) {
        setStreamError('Ошибка векторизации')
        console.error(err)
      } finally {
        setEmbeddingDocId(null)
      }
    },
    [settings.tunnelUrl, settings.token, settings.embedModel, loadDocuments]
  )

  // Delete document
  const deleteDocument = useCallback(
    async (docId: string) => {
      try {
        const res = await fetch('/api/documents', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: docId }),
        })
        if (res.ok) {
          if (selectedDocumentId === docId) {
            setSelectedDocumentId(null)
          }
          await loadDocuments()
        }
      } catch (err) {
        console.error('Delete document error:', err)
      }
    },
    [selectedDocumentId, setSelectedDocumentId, loadDocuments]
  )

  // Create prompt
  const createPrompt = useCallback(async () => {
    if (!newPromptTitle.trim() || !newPromptContent.trim()) return
    try {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newPromptTitle.trim(),
          content: newPromptContent.trim(),
        }),
      })
      if (res.ok) {
        setNewPromptTitle('')
        setNewPromptContent('')
        setPromptDialogOpen(false)
        await loadPrompts()
      }
    } catch (err) {
      console.error('Create prompt error:', err)
    }
  }, [newPromptTitle, newPromptContent, loadPrompts])

  // Delete prompt
  const deletePrompt = useCallback(
    async (promptId: string) => {
      try {
        const res = await fetch(`/api/prompts/${promptId}`, {
          method: 'DELETE',
        })
        if (res.ok) {
          if (selectedPromptId === promptId) {
            setSelectedPromptId(null)
          }
          await loadPrompts()
        }
      } catch (err) {
        console.error('Delete prompt error:', err)
      }
    },
    [selectedPromptId, setSelectedPromptId, loadPrompts]
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

  // Document status badge
  const StatusBadge = ({ status }: { status: string }) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      uploading: { variant: 'secondary', label: 'Загрузка' },
      processing: { variant: 'secondary', label: 'Обработка' },
      parsed: { variant: 'outline', label: 'Обработан' },
      embedded: { variant: 'default', label: 'Векторизован' },
      error: { variant: 'destructive', label: 'Ошибка' },
    }
    const config = variants[status] || { variant: 'secondary' as const, label: status }
    return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>
  }

  // Get selected document name
  const selectedDocument = documents.find((d) => d.id === selectedDocumentId)
  const selectedPrompt = prompts.find((p) => p.id === selectedPromptId)

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-4 py-3 bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="shrink-0"
          >
            {settingsOpen ? (
              <PanelLeftClose className="h-5 w-5" />
            ) : (
              <PanelLeft className="h-5 w-5" />
            )}
          </Button>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">
              Дырявый чат
            </h1>
            <p className="text-xs text-muted-foreground hidden sm:block">
              RAG — Проксирование к локальной LLM
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Active context indicators */}
          {selectedDocument && (
            <Badge variant="outline" className="hidden sm:flex items-center gap-1 text-xs">
              <FileText className="h-3 w-3" />
              {selectedDocument.filename}
              <button
                onClick={() => setSelectedDocumentId(null)}
                className="ml-0.5 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {selectedPrompt && (
            <Badge variant="outline" className="hidden sm:flex items-center gap-1 text-xs">
              <BookOpen className="h-3 w-3" />
              {selectedPrompt.title}
              <button
                onClick={() => setSelectedPromptId(null)}
                className="ml-0.5 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          <div className="flex items-center gap-1.5 text-sm">
            <HealthIcon />
            <span className="hidden sm:inline text-muted-foreground text-xs">
              {healthStatus === 'connected'
                ? 'Подключено'
                : healthStatus === 'checking'
                  ? 'Проверка...'
                  : healthStatus === 'error'
                    ? 'Ошибка'
                    : 'Не подключено'}
            </span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {settingsOpen && (
          <div className="w-80 border-r bg-card flex flex-col shrink-0 overflow-hidden">
            <Tabs
              value={sidebarTab}
              onValueChange={(v) =>
                setSidebarTab(v as 'settings' | 'documents' | 'prompts')
              }
              className="flex flex-col flex-1 overflow-hidden"
            >
              <TabsList className="w-full rounded-none border-b bg-transparent p-0 h-auto">
                <TabsTrigger
                  value="settings"
                  className="flex-1 py-2.5 data-[state=active]:bg-muted rounded-none text-xs"
                >
                  <Settings className="h-3.5 w-3.5 mr-1" />
                  Настройки
                </TabsTrigger>
                <TabsTrigger
                  value="documents"
                  className="flex-1 py-2.5 data-[state=active]:bg-muted rounded-none text-xs"
                >
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  Документы
                </TabsTrigger>
                <TabsTrigger
                  value="prompts"
                  className="flex-1 py-2.5 data-[state=active]:bg-muted rounded-none text-xs"
                >
                  <BookOpen className="h-3.5 w-3.5 mr-1" />
                  Промпты
                </TabsTrigger>
              </TabsList>

              {/* Settings Tab */}
              <TabsContent
                value="settings"
                className="flex-1 overflow-y-auto m-0 p-4 space-y-5"
              >
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
                </div>

                {/* Chat Model */}
                <div className="space-y-2">
                  <Label htmlFor="model" className="text-sm font-medium">
                    Модель чата
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

                {/* Embedding Model */}
                <div className="space-y-2">
                  <Label htmlFor="embed-model" className="text-sm font-medium">
                    <span className="flex items-center gap-1.5">
                      <Database className="h-3.5 w-3.5" />
                      Модель эмбеддингов
                    </span>
                  </Label>
                  <Input
                    id="embed-model"
                    type="text"
                    placeholder="nomic-embed-text"
                    value={settings.embedModel}
                    onChange={(e) =>
                      setSettings({ embedModel: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Для векторизации документов через Ollama
                  </p>
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
              </TabsContent>

              {/* Documents Tab */}
              <TabsContent
                value="documents"
                className="flex-1 overflow-hidden m-0 flex flex-col"
              >
                <div className="p-4 border-b space-y-3 shrink-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Загрузка документов</h3>
                    {uploading && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.md,.markdown"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {uploading ? 'Загрузка...' : 'Загрузить файл (PDF, TXT, MD)'}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Загрузите документ для RAG — поиска по содержимому
                  </p>
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-2">
                    {documents.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <File className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Нет загруженных документов</p>
                      </div>
                    ) : (
                      documents.map((doc) => (
                        <div
                          key={doc.id}
                          className={`rounded-lg border p-3 space-y-2 transition-colors ${
                            selectedDocumentId === doc.id
                              ? 'border-primary bg-primary/5'
                              : 'hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {doc.filename}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <StatusBadge status={doc.status} />
                                <span className="text-xs text-muted-foreground">
                                  {(doc.fileSize / 1024).toFixed(1)} КБ
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {doc.chunkCount} чанков
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {doc.status === 'parsed' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => embedDocument(doc.id)}
                                disabled={embeddingDocId === doc.id}
                              >
                                {embeddingDocId === doc.id ? (
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                ) : (
                                  <Sparkles className="h-3 w-3 mr-1" />
                                )}
                                Векторизовать
                              </Button>
                            )}
                            <Button
                              variant={
                                selectedDocumentId === doc.id
                                  ? 'default'
                                  : 'outline'
                              }
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() =>
                                setSelectedDocumentId(
                                  selectedDocumentId === doc.id
                                    ? null
                                    : doc.id
                                )
                              }
                              disabled={
                                doc.status !== 'parsed' &&
                                doc.status !== 'embedded'
                              }
                            >
                              {selectedDocumentId === doc.id ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Выбран
                                </>
                              ) : (
                                <>
                                  <Play className="h-3 w-3 mr-1" />
                                  Для RAG
                                </>
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs ml-auto text-muted-foreground hover:text-destructive"
                              onClick={() => deleteDocument(doc.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>

                          {doc.status === 'error' && doc.errorMsg && (
                            <p className="text-xs text-destructive">
                              {doc.errorMsg}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Prompts Tab */}
              <TabsContent
                value="prompts"
                className="flex-1 overflow-hidden m-0 flex flex-col"
              >
                <div className="p-4 border-b shrink-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Системные промпты</h3>
                    <Dialog
                      open={promptDialogOpen}
                      onOpenChange={setPromptDialogOpen}
                    >
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7">
                          <Plus className="h-3 w-3 mr-1" />
                          Создать
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Новый промпт</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-2">
                          <div className="space-y-2">
                            <Label>Заголовок</Label>
                            <Input
                              value={newPromptTitle}
                              onChange={(e) =>
                                setNewPromptTitle(e.target.value)
                              }
                              placeholder="Например: Переводчик"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Содержание</Label>
                            <Textarea
                              value={newPromptContent}
                              onChange={(e) =>
                                setNewPromptContent(e.target.value)
                              }
                              placeholder="Ты переводчик с русского на английский..."
                              rows={5}
                            />
                          </div>
                          <Button
                            onClick={createPrompt}
                            disabled={
                              !newPromptTitle.trim() ||
                              !newPromptContent.trim()
                            }
                            className="w-full"
                          >
                            Создать промпт
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-2">
                    {prompts.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Нет промптов</p>
                      </div>
                    ) : (
                      prompts.map((prompt) => (
                        <div
                          key={prompt.id}
                          className={`rounded-lg border p-3 space-y-2 transition-colors ${
                            selectedPromptId === prompt.id
                              ? 'border-primary bg-primary/5'
                              : 'hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <BookOpen className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-medium truncate">
                                  {prompt.title}
                                </p>
                                {prompt.isDefault && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] px-1 py-0"
                                  >
                                    По умолчанию
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                {prompt.content}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Button
                              variant={
                                selectedPromptId === prompt.id
                                  ? 'default'
                                  : 'outline'
                              }
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() =>
                                setSelectedPromptId(
                                  selectedPromptId === prompt.id
                                    ? null
                                    : prompt.id
                                )
                              }
                            >
                              {selectedPromptId === prompt.id ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Выбран
                                </>
                              ) : (
                                'Использовать'
                              )}
                            </Button>
                            {!prompt.isDefault && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs ml-auto text-muted-foreground hover:text-destructive"
                                onClick={() => deletePrompt(prompt.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Main Chat Area */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Top context bar */}
          {(selectedDocument || selectedPrompt) && (
            <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30 text-xs overflow-x-auto shrink-0">
              <span className="text-muted-foreground whitespace-nowrap">
                Контекст:
              </span>
              {selectedDocument && (
                <Badge
                  variant="outline"
                  className="flex items-center gap-1 text-xs shrink-0"
                >
                  <FileText className="h-3 w-3" />
                  {selectedDocument.filename}
                  {selectedDocument.status === 'embedded' && (
                    <Sparkles className="h-3 w-3 text-green-500" />
                  )}
                  <button
                    onClick={() => setSelectedDocumentId(null)}
                    className="ml-0.5 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {selectedPrompt && (
                <Badge
                  variant="outline"
                  className="flex items-center gap-1 text-xs shrink-0"
                >
                  <BookOpen className="h-3 w-3" />
                  {selectedPrompt.title}
                  <button
                    onClick={() => setSelectedPromptId(null)}
                    className="ml-0.5 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {selectedDocumentId && selectedDocument?.status !== 'embedded' && (
                <span className="text-yellow-600 text-xs whitespace-nowrap">
                  ⚠ Без векторного поиска
                </span>
              )}
            </div>
          )}

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
                    подключение и отправьте первое сообщение. Загрузите
                    документы для RAG-поиска.
                  </p>
                  {!settings.tunnelUrl && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSettingsOpen(true)
                        setSidebarTab('settings')
                      }}
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
                      message.role === 'user'
                        ? 'justify-end'
                        : 'justify-start'
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
            <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 shrink-0">
              <div className="flex items-center gap-2 text-sm text-red-600 max-w-3xl mx-auto">
                <XCircle className="h-4 w-4 shrink-0" />
                <span className="flex-1">{streamError}</span>
                <button
                  onClick={() => setStreamError(null)}
                  className="text-red-400 hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="border-t bg-card p-4 shrink-0">
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
                {settings.model && ` | ${settings.model}`}
                {selectedDocumentId && ' | RAG'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
