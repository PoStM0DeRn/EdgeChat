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
}

interface ChatState {
  // Settings
  settings: Settings
  setSettings: (settings: Partial<Settings>) => void

  // Chat
  messages: Message[]
  isStreaming: boolean
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void
  updateLastAssistantMessage: (content: string) => void
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
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      // Settings
      settings: {
        tunnelUrl: '',
        token: '',
        model: '',
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
            {
              ...message,
              id: crypto.randomUUID(),
              timestamp: Date.now(),
            },
          ],
        })),
      updateLastAssistantMessage: (content) =>
        set((state) => {
          const msgs = [...state.messages]
          const lastIdx = msgs.findLastIndex((m) => m.role === 'assistant')
          if (lastIdx >= 0) {
            msgs[lastIdx] = { ...msgs[lastIdx], content }
          }
          return { messages: msgs }
        }),
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
    }),
    {
      name: 'leaky-chat-storage',
      partialize: (state) => ({
        settings: state.settings,
        messages: state.messages,
      }),
    }
  )
)
