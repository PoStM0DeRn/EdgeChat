'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useChatStore } from '@/lib/store'
import { MarkdownMessage } from '@/components/chat/markdown-message'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  History,
  PenLine,
  PlusCircle,
  ChevronDown,
  Download,
  Search,
} from 'lucide-react'

export function ChatPage() {
  const {
    settings,
    setSettings,
    messages,
    isStreaming,
    addMessage,
    appendToLastAssistantMessage,
    appendToLastAssistantReasoning,
    setIsStreaming,
    clearMessages: clearLocalMessages,
    agentOnline,
    agentName,
    setAgentStatus,
    documents,
    setDocuments,
    selectedDocumentId,
    setSelectedDocumentId,
    prompts,
    setPrompts,
    selectedPromptId,
    setSelectedPromptId,
    sessions,
    setSessions,
    currentSessionId,
    setCurrentSessionId,
    currentSessionTitle,
    setCurrentSessionTitle,
    sidebarTab,
    setSidebarTab,
    settingsOpen,
    setSettingsOpen,
    sidebarWidth,
    setSidebarWidth,
    removeMessage,
    replaceMessage,
  } = useChatStore()

  const [input, setInput] = useState('')
  const [streamError, setStreamError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [embeddingDocId, setEmbeddingDocId] = useState<string | null>(null)
  const [promptDialogOpen, setPromptDialogOpen] = useState(false)
  const [newPromptTitle, setNewPromptTitle] = useState('')
  const [newPromptContent, setNewPromptContent] = useState('')
  const [isResizing, setIsResizing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isNearBottomRef = useRef(true)
  const [showScrollButton, setShowScrollButton] = useState(false)

  // Smart auto-scroll: only scroll if user is near bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView()
    }
  }, [messages])

  // Track if user is near bottom using IntersectionObserver
  useEffect(() => {
    const el = messagesEndRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        const near = entry.isIntersecting
        isNearBottomRef.current = near
        setShowScrollButton(!near)
      },
      { rootMargin: '150px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Sidebar drag resize
  useEffect(() => {
    if (!isResizing) return
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(240, Math.min(600, e.clientX))
      setSidebarWidth(newWidth)
    }
    const handleMouseUp = () => setIsResizing(false)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, setSidebarWidth])

  // Load documents on mount
  useEffect(() => {
    loadDocuments()
  }, [])

  // Load prompts on mount
  useEffect(() => {
    loadPrompts()
  }, [])

  // Load sessions on mount, restore current session messages
  useEffect(() => {
    loadSessions()
    if (currentSessionId) {
      loadSessionMessages(currentSessionId)
    }
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

  // Load sessions
  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions')
      if (res.ok) {
        const data = await res.json()
        setSessions(data)
      }
    } catch (err) {
      console.error('Failed to load sessions:', err)
    }
  }, [setSessions])

  // Load messages for a specific session
  const loadSessionMessages = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`)
      if (res.ok) {
        const data = await res.json()
        // Replace local messages with DB messages
        // We use the store directly to batch-set messages
        const msgs = data.messages.map((m: { id: string; role: string; content: string; createdAt: string }) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
          timestamp: new Date(m.createdAt).getTime(),
        }))
        useChatStore.setState({ messages: msgs })
        setCurrentSessionTitle(data.title)
      }
    } catch (err) {
      console.error('Failed to load session messages:', err)
    }
  }, [setCurrentSessionTitle])

  // Save a message to the current session
  const saveMessageToSession = useCallback(async (sessionId: string, role: string, content: string) => {
    try {
      await fetch(`/api/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, content }),
      })
    } catch (err) {
      console.error('Failed to save message:', err)
    }
  }, [])

  // Ensure a session exists before sending messages
  const ensureSession = useCallback(async () => {
    if (currentSessionId) return currentSessionId

    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Новый чат',
        model: settings.model || undefined,
        systemPromptId: selectedPromptId || undefined,
        documentId: selectedDocumentId || undefined,
      }),
    })
    if (!res.ok) {
      console.error('Failed to create session')
      return null
    }
    const session = await res.json()
    setCurrentSessionId(session.id)
    setCurrentSessionTitle(session.title)

    // Migrate any existing localStorage messages to the new session
    const state = useChatStore.getState()
    if (state.messages.length > 0) {
      for (const msg of state.messages) {
        await saveMessageToSession(session.id, msg.role, msg.content)
      }
    }
    await loadSessions()
    return session.id
  }, [currentSessionId, settings.model, selectedPromptId, selectedDocumentId, setCurrentSessionId, setCurrentSessionTitle, saveMessageToSession, loadSessions])

  // Switch to a different session
  const switchSession = useCallback(async (sessionId: string) => {
    setCurrentSessionId(sessionId)
    setCurrentSessionTitle('')
    await loadSessionMessages(sessionId)
  }, [setCurrentSessionId, setCurrentSessionTitle, loadSessionMessages])

  // Create a new empty session
  const createNewSession = useCallback(async () => {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Новый чат',
        model: settings.model || undefined,
      }),
    })
    if (!res.ok) return
    const session = await res.json()
    setCurrentSessionId(session.id)
    setCurrentSessionTitle(session.title)
    useChatStore.setState({ messages: [] })
    await loadSessions()
  }, [settings.model, setCurrentSessionId, setCurrentSessionTitle, loadSessions])

  // Delete a session
  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
      })
      if (res.ok || res.status === 204) {
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null)
          setCurrentSessionTitle('Новый чат')
          useChatStore.setState({ messages: [] })
        }
        await loadSessions()
      }
    } catch (err) {
      console.error('Failed to delete session:', err)
    }
  }, [currentSessionId, setCurrentSessionId, setCurrentSessionTitle, loadSessions])

  // Clear messages with session cleanup
  const handleClearMessages = useCallback(async () => {
    if (currentSessionId) {
      await deleteSession(currentSessionId)
    } else {
      clearLocalMessages()
    }
  }, [currentSessionId, deleteSession, clearLocalMessages])

  // Generate a title from the first user message
  const generateSessionTitle = useCallback((content: string) => {
    const cleaned = content.replace(/[\r\n]+/g, ' ').trim()
    return cleaned.length > 50 ? cleaned.slice(0, 50) + '...' : cleaned
  }, [])

  // Update session title via API
  const updateSessionTitle = useCallback(async (sessionId: string, title: string) => {
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      setCurrentSessionTitle(title)
      await loadSessions()
    } catch (err) {
      console.error('Failed to update session title:', err)
    }
  }, [setCurrentSessionTitle, loadSessions])

  // Delete a single message
  const handleDeleteMessage = useCallback(async (messageId: string) => {
    removeMessage(messageId)
    if (currentSessionId) {
      try {
        await fetch(`/api/sessions/${currentSessionId}/messages/${messageId}`, {
          method: 'DELETE',
        })
        await loadSessions()
      } catch (err) {
        console.error('Failed to delete message from DB:', err)
      }
    }
  }, [currentSessionId, removeMessage, loadSessions])

  // Send a message programmatically (for edit/resend)
  const sendEditedMessage = useCallback(async (content: string) => {
    if (!settings.agentToken) {
      setStreamError('Укажите токен Агента в настройках')
      setSettingsOpen(true)
      return
    }
    setStreamError(null)
    addMessage({ role: 'assistant', content: '' })
    setIsStreaming(true)
    const controller = new AbortController()
    abortRef.current = controller
    let sessionId = currentSessionId
    if (!sessionId) {
      sessionId = await ensureSession()
    }
    try {
      const state = useChatStore.getState()
      const chatMessages = state.messages
        .filter((m) => m.role !== 'system' && !(m.role === 'assistant' && !m.content))
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      const systemPrompt = selectedPromptId
        ? prompts.find((p) => p.id === selectedPromptId)?.content
        : undefined
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatMessages,
          token: settings.token || undefined,
          model: settings.model || undefined,
          documentId: selectedDocumentId || undefined,
          systemPrompt,
          agentToken: settings.agentToken || undefined,
        }),
        signal: controller.signal,
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        setStreamError(errorData.error || `Ошибка сервера: ${res.status}`)
        const errState = useChatStore.getState()
        const emptyAssistant = errState.messages.at(-1)
        if (emptyAssistant && emptyAssistant.role === 'assistant' && !emptyAssistant.content) {
          removeMessage(emptyAssistant.id)
        }
        setIsStreaming(false)
        return
      }
      const reader = res.body?.getReader()
      if (!reader) {
        setStreamError('Нет потока ответа')
        const errState = useChatStore.getState()
        const emptyAssistant = errState.messages.at(-1)
        if (emptyAssistant && emptyAssistant.role === 'assistant' && !emptyAssistant.content) {
          removeMessage(emptyAssistant.id)
        }
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
            } else if (parsed.type === 'thinking' && parsed.content) {
              appendToLastAssistantReasoning(parsed.content)
            } else if (parsed.content) {
              appendToLastAssistantMessage(parsed.content)
            }
          } catch {}
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setStreamError(`Ошибка соединения: ${err.message}`)
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
      if (sessionId) {
        const s = useChatStore.getState()
        const lastMsg = s.messages.at(-1)
        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content) {
          await saveMessageToSession(sessionId, 'assistant', lastMsg.content)
        }
        await loadSessions()
      }
    }
  }, [settings, selectedPromptId, selectedDocumentId, prompts, currentSessionId, ensureSession,     addMessage,
    appendToLastAssistantMessage,
    appendToLastAssistantReasoning,
    setIsStreaming, removeMessage, saveMessageToSession, loadSessions])

  // Edit a user message and resend
  const handleEditMessage = useCallback(async (messageId: string, newContent: string) => {
    if (isStreaming) return
    replaceMessage(messageId, newContent)
    if (currentSessionId) {
      try {
        await fetch(`/api/sessions/${currentSessionId}/messages/${messageId}`, {
          method: 'DELETE',
        })
      } catch {}
      await saveMessageToSession(currentSessionId, 'user', newContent)
    }
    const state = useChatStore.getState()
    const msgIdx = state.messages.findIndex((m) => m.id === messageId)
    if (msgIdx >= 0) {
      const msgsToRemove = state.messages.slice(msgIdx + 1)
      for (const m of msgsToRemove) {
        removeMessage(m.id)
        if (currentSessionId) {
          try {
            await fetch(`/api/sessions/${currentSessionId}/messages/${m.id}`, {
              method: 'DELETE',
            })
          } catch {}
        }
      }
    }
    await sendEditedMessage(newContent)
  }, [isStreaming, currentSessionId, replaceMessage, removeMessage, saveMessageToSession, sendEditedMessage])

  // Resend a user message
  const handleResendMessage = useCallback(async (messageId: string) => {
    if (isStreaming) return
    const state = useChatStore.getState()
    const msg = state.messages.find((m) => m.id === messageId)
    if (!msg || msg.role !== 'user') return
    const msgIdx = state.messages.findIndex((m) => m.id === messageId)
    if (msgIdx >= 0 && msgIdx + 1 < state.messages.length) {
      const nextMsg = state.messages[msgIdx + 1]
      if (nextMsg.role === 'assistant') {
        removeMessage(nextMsg.id)
        if (currentSessionId) {
          try {
            await fetch(`/api/sessions/${currentSessionId}/messages/${nextMsg.id}`, {
              method: 'DELETE',
            })
          } catch {}
        }
      }
    }
    await sendEditedMessage(msg.content)
  }, [isStreaming, currentSessionId, removeMessage, sendEditedMessage])

  // Export chat as JSON
  const handleExportChat = useCallback(() => {
    if (messages.length === 0) return
    const data = {
      title: currentSessionTitle || 'Чат',
      model: settings.model || '',
      exportedAt: new Date().toISOString(),
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: new Date(m.timestamp).toISOString(),
      })),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tunnelchat-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [messages, currentSessionTitle, settings.model])

  const checkAgentStatus = useCallback(async () => {
    if (!settings.agentToken) {
      setAgentStatus(false, null)
      return
    }
    try {
      const res = await fetch('/api/agent/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: settings.agentToken }),
      })
      const data = await res.json()
      setAgentStatus(data.online, data.name)
    } catch {
      setAgentStatus(false, null)
    }
  }, [settings.agentToken, setAgentStatus])

  // Poll agent status
  useEffect(() => {
    if (!settings.agentToken) return
    checkAgentStatus()
    const interval = setInterval(checkAgentStatus, 10_000)
    return () => clearInterval(interval)
  }, [settings.agentToken, checkAgentStatus])

  // Send message and stream response
  const sendMessage = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return

    if (!settings.agentToken) {
      setStreamError('Укажите токен Агента в настройках')
      setSettingsOpen(true)
      return
    }

    setStreamError(null)
    setInput('')

    // Ensure we have a session before sending
    let sessionId = currentSessionId
    if (!sessionId) {
      sessionId = await ensureSession()
    }
    const isFirstMessage = sessionId && messages.length === 0

    addMessage({ role: 'user', content: trimmed })

    // Save user message to DB immediately
    if (sessionId) {
      await saveMessageToSession(sessionId, 'user', trimmed)
      // If this is the first message, set it as session title
      if (isFirstMessage) {
        const title = generateSessionTitle(trimmed)
        await updateSessionTitle(sessionId, title)
      }
    }

    addMessage({ role: 'assistant', content: '' })
    setIsStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const chatMessages = useChatStore.getState().messages
        .filter((m) => m.role !== 'system' && !(m.role === 'assistant' && !m.content))
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

      // Get system prompt content
      const systemPrompt = selectedPromptId
        ? prompts.find((p) => p.id === selectedPromptId)?.content
        : undefined

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatMessages,
          token: settings.token || undefined,
          model: settings.model || undefined,
          documentId: selectedDocumentId || undefined,
          systemPrompt,
          agentToken: settings.agentToken || undefined,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        setStreamError(errorData.error || `Ошибка сервера: ${res.status}`)
        const errState = useChatStore.getState()
        const emptyAssistant = errState.messages.at(-1)
        if (emptyAssistant && emptyAssistant.role === 'assistant' && !emptyAssistant.content) {
          removeMessage(emptyAssistant.id)
        }
        setIsStreaming(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        setStreamError('Нет потока ответа')
        const errState = useChatStore.getState()
        const emptyAssistant = errState.messages.at(-1)
        if (emptyAssistant && emptyAssistant.role === 'assistant' && !emptyAssistant.content) {
          removeMessage(emptyAssistant.id)
        }
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
            } else if (parsed.type === 'thinking' && parsed.content) {
              appendToLastAssistantReasoning(parsed.content)
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

      // Save assistant message after streaming completes
      if (sessionId) {
        const state = useChatStore.getState()
        const lastMsg = state.messages.at(-1)
        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content) {
          await saveMessageToSession(sessionId, 'assistant', lastMsg.content)
        }
        await loadSessions()
      }
    }
  }, [
    input,
    isStreaming,
    settings,
    messages,
    currentSessionId,
    ensureSession,
    saveMessageToSession,
    generateSessionTitle,
    updateSessionTitle,
    loadSessions,
    addMessage,
    appendToLastAssistantMessage,
    appendToLastAssistantReasoning,
    setIsStreaming,
    removeMessage,
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
    [loadDocuments]
  )

  // Vectorize document
  const embedDocument = useCallback(
    async (docId: string) => {
      setEmbeddingDocId(docId)
      try {
        const res = await fetch('/api/documents/embed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId: docId,
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
    [settings.token, settings.embedModel, loadDocuments]
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
    <div className="flex h-screen flex-col bg-background overflow-hidden">
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
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-tight truncate max-w-[200px]">
                {currentSessionId
                  ? currentSessionTitle || 'Новый чат'
                  : 'TunnelChat'}
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {currentSessionId
                  ? `${
                      messages.length
                    } сообщений`
                  : 'RAG — Проксирование к локальной LLM'}
              </p>
            </div>
            {currentSessionId && messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={handleExportChat}
                title="Экспортировать чат"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            {currentSessionId && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={createNewSession}
                title="Новый чат"
              >
                <PlusCircle className="h-4 w-4" />
              </Button>
            )}
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
            <span className="hidden sm:inline text-muted-foreground text-xs">
              {agentOnline ? '🟢 Агент' : '🔴 Агент'}
            </span>
          </div>


        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {settingsOpen && (
          <div
            style={{ width: sidebarWidth, minWidth: 240, maxWidth: 600 }}
            className="h-full border-r bg-card flex flex-col shrink-0 overflow-hidden relative"
          >
            {/* Resize handle */}
            <div
              className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 z-10"
              onMouseDown={(e) => {
                setIsResizing(true)
                e.preventDefault()
              }}
            />
              <Tabs
                  value={sidebarTab}
                  onValueChange={(v) =>
                    setSidebarTab(v as 'settings' | 'documents' | 'prompts' | 'sessions')
                  }
                  className="flex flex-col flex-1 overflow-hidden"
                >
                  <TabsList className="w-full rounded-none border-b bg-transparent p-0 h-auto">
                    <TabsTrigger
                      value="sessions"
                      className="flex-1 py-2.5 data-[state=active]:bg-muted rounded-none text-xs"
                    >
                      <History className="h-3.5 w-3.5 mr-1" />
                      История
                    </TabsTrigger>
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

              {/* Sessions Tab */}
              <TabsContent
                value="sessions"
                className="flex-1 overflow-hidden m-0 flex flex-col"
              >
                <div className="p-4 border-b space-y-3 shrink-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">История чатов</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7"
                      onClick={createNewSession}
                    >
                      <PlusCircle className="h-3 w-3 mr-1" />
                      Новый чат
                    </Button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Поиск по истории..."
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-2">
                    {sessions.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Нет сохранённых чатов</p>
                        <p className="text-xs mt-1">
                          Сообщения будут сохраняться автоматически
                        </p>
                      </div>
                    ) : (
                      sessions
                        .filter((s) =>
                          s.title.toLowerCase().includes(searchQuery.toLowerCase())
                        )
                        .map((s) => (
                        <div
                          key={s.id}
                          className={`rounded-lg border p-3 space-y-2 transition-colors ${
                            currentSessionId === s.id
                              ? 'border-primary bg-primary/5'
                              : 'hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <MessageCircle className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {s.title}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground">
                                  {s.messageCount}{' '}
                                  {s.messageCount === 1
                                    ? 'сообщение'
                                    : s.messageCount < 5
                                      ? 'сообщения'
                                      : 'сообщений'}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(s.updatedAt).toLocaleDateString('ru-RU', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Button
                              variant={
                                currentSessionId === s.id
                                  ? 'default'
                                  : 'outline'
                              }
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => switchSession(s.id)}
                            >
                              {currentSessionId === s.id ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Текущий
                                </>
                              ) : (
                                'Открыть'
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs ml-auto text-muted-foreground hover:text-destructive"
                              onClick={() => deleteSession(s.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent
                value="settings"
                className="flex-1 overflow-y-auto m-0 p-4 space-y-5 flex flex-col"
              >
                {/* Agent Status */}
                <div className="space-y-2">
                  <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-md ${
                    agentOnline
                      ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                      : 'bg-red-500/10 text-red-600 dark:text-red-400'
                  }`}>
                    <span className={`h-2 w-2 rounded-full ${agentOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                    {agentOnline ? `Агент онлайн: ${agentName || 'Подключён'}` : 'Агент оффлайн'}
                  </div>
                </div>

                {/* Agent Token */}
                <div className="space-y-2">
                  <Label htmlFor="agent-token" className="text-sm font-medium">
                    <span className="flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5" />
                      Токен Агента
                    </span>
                  </Label>
                  <Input
                    id="agent-token"
                    type="password"
                    placeholder="Вставьте токен из приложения Агента"
                    value={settings.agentToken}
                    onChange={(e) =>
                      setSettings({ agentToken: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Получите токен при запуске Desktop-Агента
                  </p>
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
          <div className="relative flex flex-col flex-1 min-h-0">
            <ScrollArea className="flex-1 p-4 overflow-hidden">
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
                      Подключите Desktop-Агент с запущенным LM Studio,
                      настройте токен и отправьте первое сообщение.
                      Загрузите документы для RAG-поиска.
                    </p>
                    {!settings.agentToken && (
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
                <div className="space-y-4 max-w-3xl mx-auto pb-6">
                  {messages.map((message) => (
                    <MarkdownMessage
                      key={message.id}
                      message={message}
                      onDelete={handleDeleteMessage}
                      onEdit={handleEditMessage}
                      onResend={handleResendMessage}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>
            {/* Scroll-to-bottom button */}
            {showScrollButton && messages.length > 0 && (
              <button
                onClick={() => {
                  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
                  isNearBottomRef.current = true
                  setShowScrollButton(false)
                }}
                className="absolute bottom-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border bg-background shadow-md hover:bg-muted transition-colors"
                title="Прокрутить вниз"
              >
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              </button>
            )}
          </div>

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
                    agentOnline
                      ? 'Введите сообщение... (Enter — отправить, Shift+Enter — новая строка)'
                      : 'Дождитесь подключения Агента'
                  }
                  disabled={isStreaming || !agentOnline}
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
                  disabled={!input.trim() || !agentOnline}
                  className="h-11 w-11 shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClearMessages}
                  className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive"
                  title="Очистить историю"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="flex justify-between mt-2 max-w-3xl mx-auto">
              <p className="text-xs text-muted-foreground">
                {agentOnline
                  ? `🖥️ Агент: ${agentName || 'Подключён'}`
                  : '🖥️ Агент оффлайн'
                }
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
