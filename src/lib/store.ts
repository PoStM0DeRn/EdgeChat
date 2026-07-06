import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoningContent?: string
  timestamp: number
}

export interface Settings {
  token: string
  model: string
  embedModel: string
  agentToken: string
}

export interface DocumentInfo {
  id: string
  filename: string
  fileType: string
  fileSize: number
  status: string
  chunkCount: number
  errorMsg?: string
  createdAt: string
}

export interface PromptInfo {
  id: string
  title: string
  content: string
  isDefault: boolean
  isPublic: boolean
}

export interface SessionInfo {
  id: string
  title: string
  model: string | null
  systemPromptId: string | null
  documentId: string | null
  messageCount: number
  createdAt: string
  updatedAt: string
}

interface ChatState {
  // Settings
  settings: Settings
  setSettings: (settings: Partial<Settings>) => void

  // Chat
  messages: Message[]
  isStreaming: boolean
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void
  appendToLastAssistantMessage: (token: string) => void
  appendToLastAssistantReasoning: (token: string) => void
  setIsStreaming: (value: boolean) => void
  clearMessages: () => void
  removeMessage: (id: string) => void
  replaceMessage: (id: string, content: string) => void

  // Agent
  agentOnline: boolean
  agentName: string | null
  setAgentStatus: (online: boolean, name: string | null) => void

  // Documents (RAG)
  documents: DocumentInfo[]
  setDocuments: (docs: DocumentInfo[]) => void
  selectedDocumentId: string | null
  setSelectedDocumentId: (id: string | null) => void

  // Prompts
  prompts: PromptInfo[]
  setPrompts: (prompts: PromptInfo[]) => void
  selectedPromptId: string | null
  setSelectedPromptId: (id: string | null) => void

  // Sessions
  sessions: SessionInfo[]
  setSessions: (sessions: SessionInfo[]) => void
  currentSessionId: string | null
  setCurrentSessionId: (id: string | null) => void
  currentSessionTitle: string
  setCurrentSessionTitle: (title: string) => void

  // UI State
  sidebarTab: 'settings' | 'documents' | 'prompts' | 'sessions'
  setSidebarTab: (tab: 'settings' | 'documents' | 'prompts' | 'sessions') => void
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
  sidebarWidth: number
  setSidebarWidth: (width: number) => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      // Settings
      settings: {
        token: '',
        model: '',
        embedModel: 'nomic-embed-text',
        agentToken: '',
      },
      setSettings: (partial) =>
        set((state) => ({
          settings: { ...state.settings, ...partial },
        })),

      // Chat
      messages: [],
      isStreaming: false,
      addMessage: (message) =>
        set((state) => ({
          messages: [
            ...state.messages,
            { ...message, id: crypto.randomUUID(), timestamp: Date.now() },
          ],
        })),
      appendToLastAssistantMessage: (token) =>
        set((state) => {
          const msgs = [...state.messages]
          const lastIdx = msgs.findLastIndex((m) => m.role === 'assistant')
          if (lastIdx >= 0) {
            msgs[lastIdx] = {
              ...msgs[lastIdx],
              content: msgs[lastIdx].content + token,
            }
          }
          return { messages: msgs }
        }),
      appendToLastAssistantReasoning: (token) =>
        set((state) => {
          const msgs = [...state.messages]
          const lastIdx = msgs.findLastIndex((m) => m.role === 'assistant')
          if (lastIdx >= 0) {
            msgs[lastIdx] = {
              ...msgs[lastIdx],
              reasoningContent: (msgs[lastIdx].reasoningContent || '') + token,
            }
          }
          return { messages: msgs }
        }),
      setIsStreaming: (value) => set({ isStreaming: value }),
      clearMessages: () => set({ messages: [] }),
      removeMessage: (id) =>
        set((state) => ({
          messages: state.messages.filter((m) => m.id !== id),
        })),
      replaceMessage: (id, content) =>
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === id ? { ...m, content } : m
          ),
        })),

      // Agent
      agentOnline: false,
      agentName: null,
      setAgentStatus: (online, name) =>
        set({
          agentOnline: online,
          agentName: name,
        }),

      // Documents
      documents: [],
      setDocuments: (docs) => set({ documents: docs }),
      selectedDocumentId: null,
      setSelectedDocumentId: (id) => set({ selectedDocumentId: id }),

      // Prompts
      prompts: [],
      setPrompts: (prompts) => set({ prompts: prompts }),
      selectedPromptId: null,
      setSelectedPromptId: (id) => set({ selectedPromptId: id }),

      // Sessions
      sessions: [],
      setSessions: (sessions) => set({ sessions }),
      currentSessionId: null,
      setCurrentSessionId: (id) => set({ currentSessionId: id }),
      currentSessionTitle: 'Новый чат',
      setCurrentSessionTitle: (title) => set({ currentSessionTitle: title }),

      // UI
      sidebarTab: 'settings',
      setSidebarTab: (tab) => set({ sidebarTab: tab }),
      settingsOpen: false,
      setSettingsOpen: (open) => set({ settingsOpen: open }),
      sidebarWidth: 320,
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
    }),
    {
      name: 'leaky-chat-storage-v2',
      partialize: (state) => ({
        settings: state.settings,
        currentSessionId: state.currentSessionId,
        currentSessionTitle: state.currentSessionTitle,
        selectedDocumentId: state.selectedDocumentId,
        selectedPromptId: state.selectedPromptId,
        sidebarWidth: state.sidebarWidth,
      }),
    }
  )
)
