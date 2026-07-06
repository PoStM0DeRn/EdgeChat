import { Server as SocketIOServer, Socket } from 'socket.io'

export interface AgentInfo {
  socketId: string
  name: string
  token: string
  connectedAt: number
  lastHeartbeat: number
}

export interface ChatRequest {
  requestId: string
  messages: { role: string; content: string }[]
  model: string
  systemPrompt?: string
}

export interface StreamChunk {
  requestId: string
  type: 'thinking' | 'content'
  content: string
}

class AgentManager {
  private agents: Map<string, AgentInfo> = new Map()
  private socketToToken: Map<string, string> = new Map()
  private io: SocketIOServer | null = null
  private pendingRequests: Map<string, {
    resolve: (chunks: StreamChunk[]) => void
    reject: (err: Error) => void
    timeout: ReturnType<typeof setTimeout>
  }> = new Map()

  setIO(io: SocketIOServer) {
    this.io = io
  }

  registerAgent(token: string, socketId: string, name: string) {
    const agent: AgentInfo = {
      socketId,
      name,
      token,
      connectedAt: Date.now(),
      lastHeartbeat: Date.now(),
    }
    this.agents.set(token, agent)
    this.socketToToken.set(socketId, token)
    console.log(`[AgentManager] Agent registered: ${name} (${token.slice(0, 8)}...) socket=${socketId}`)
  }

  removeAgent(socketId: string) {
    const token = this.socketToToken.get(socketId)
    if (token) {
      const agent = this.agents.get(token)
      console.log(`[AgentManager] Agent disconnected: ${agent?.name} (${token.slice(0, 8)}...)`)
      this.agents.delete(token)
      this.socketToToken.delete(socketId)
      this.rejectPendingForAgent(socketId)
    }
  }

  updateHeartbeat(socketId: string) {
    const token = this.socketToToken.get(socketId)
    if (token) {
      const agent = this.agents.get(token)
      if (agent) {
        agent.lastHeartbeat = Date.now()
      }
    }
  }

  getAgent(token: string): AgentInfo | null {
    const agent = this.agents.get(token)
    if (!agent) return null
    const isStale = Date.now() - agent.lastHeartbeat > 30_000
    return isStale ? null : agent
  }

  isAgentOnline(token: string): boolean {
    return this.getAgent(token) !== null
  }

  getAgentStatus(token: string): { online: boolean; name: string | null } {
    const agent = this.agents.get(token)
    if (!agent) return { online: false, name: null }
    const isStale = Date.now() - agent.lastHeartbeat > 30_000
    return { online: !isStale, name: agent.name }
  }

  async sendToAgent(token: string, request: ChatRequest, timeoutMs = 120_000): Promise<StreamChunk[]> {
    const agent = this.getAgent(token)
    if (!agent) {
      throw new Error('Агент не подключён')
    }

    if (!this.io) {
      throw new Error('WebSocket сервер не инициализирован')
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.requestId)
        reject(new Error('Таймаут ответа от Агента'))
      }, timeoutMs)

      this.pendingRequests.set(request.requestId, { resolve, reject, timeout })

      this.io!.to(agent.socketId).emit('chat:request', {
        requestId: request.requestId,
        messages: request.messages,
        model: request.model,
        systemPrompt: request.systemPrompt,
      })

      console.log(`[AgentManager] Sent chat request to ${agent.name}: ${request.requestId}`)
    })
  }

  resolveRequest(requestId: string, chunks: StreamChunk[]) {
    const pending = this.pendingRequests.get(requestId)
    if (pending) {
      clearTimeout(pending.timeout)
      pending.resolve(chunks)
      this.pendingRequests.delete(requestId)
    }
  }

  rejectRequest(requestId: string, error: string) {
    const pending = this.pendingRequests.get(requestId)
    if (pending) {
      clearTimeout(pending.timeout)
      pending.reject(new Error(error))
      this.pendingRequests.delete(requestId)
    }
  }

  private rejectPendingForAgent(socketId: string) {
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('Агент отключился'))
      this.pendingRequests.delete(requestId)
    }
  }
}

const globalForAgentManager = globalThis as unknown as {
  agentManager: AgentManager | undefined
}

export const agentManager = globalForAgentManager.agentManager ?? new AgentManager()

if (process.env.NODE_ENV !== 'production') {
  globalForAgentManager.agentManager = agentManager
}
