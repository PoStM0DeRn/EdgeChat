import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export interface Settings {
  tunnelUrl: string
  token: string
  model: string
  embedModel: string
}

export interface DocumentInfo {
  id: string
  filename: string
  fileType: string
  fileSize: number
  status: string
  chunkCount: number
  createdAt: string
}

export interface PromptInfo {
  id: string
  title: string
  content: string
  isDefault: boolean
  isPublic: boolean
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
  setIsStreaming: (value: boolean) => void
  clearMessages: () => void

  // Health
  healthStatus: 'unknown' | 'checking' | 'connected' | 'error'
  healthModels: string[]
  healthEndpoint: string
  setHealthStatus: (
    status: 'unknown' | 'checking' | 'connected' | 'error',
    models?: string[],
    endpoint?: string
  ) => void

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

  // UI State
  sidebarTab: 'settings' | 'documents' | 'prompts'
  setSidebarTab: (tab: 'settings' | 'documents' | 'prompts') => void
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      // Settings
      settings: {
        tunnelUrl: '',
        token: '',
        model: '',
        embedModel: 'nomic-embed-text',
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
      setIsStreaming: (value) => set({ isStreaming: value }),
      clearMessages: () => set({ messages: [] }),

      // Health
      healthStatus: 'unknown',
      healthModels: [],
      healthEndpoint: '',
      setHealthStatus: (status, models, endpoint) =>
        set({
          healthStatus: status,
          healthModels: models || [],
          healthEndpoint: endpoint || '',
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

      // UI
      sidebarTab: 'settings',
      setSidebarTab: (tab) => set({ sidebarTab: tab }),
      settingsOpen: false,
      setSettingsOpen: (open) => set({ settingsOpen: open }),
    }),
    {
      name: 'leaky-chat-storage-v2',
      partialize: (state) => ({
        settings: state.settings,
        messages: state.messages,
        selectedDocumentId: state.selectedDocumentId,
        selectedPromptId: state.selectedPromptId,
      }),
    }
  )
)
