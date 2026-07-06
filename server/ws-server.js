const { Server } = require('socket.io')
const http = require('http')

const PORT = process.env.WS_PORT || 3002

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, port: PORT }))
    return
  }

  if (req.url === '/api/agent/status' && req.method === 'POST') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      try {
        const { token } = JSON.parse(body)
        const status = getAgentStatus(token)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(status))
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid request' }))
      }
    })
    return
  }

  if (req.url === '/api/agent/chat' && req.method === 'POST') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', async () => {
      try {
        const { token, requestId, messages, model, systemPrompt } = JSON.parse(body)
        const result = await sendToAgent(token, { requestId, messages, model, systemPrompt })
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, chunks: result }))
      } catch (err) {
        res.writeHead(502, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message }))
      }
    })
    return
  }

  res.writeHead(404)
  res.end()
})

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 25_000,
  pingTimeout: 10_000,
})

const agents = new Map()
const socketToToken = new Map()
const pendingRequests = new Map()

io.on('connection', (socket) => {
  console.log(`[WS] New connection: ${socket.id}`)

  socket.on('agent:connect', (data) => {
    const { token, name } = data
    if (!token) {
      socket.emit('agent:error', { error: 'Токен обязателен' })
      return
    }

    agents.set(token, {
      socketId: socket.id,
      name: name || 'Unknown Agent',
      token,
      connectedAt: Date.now(),
      lastHeartbeat: Date.now(),
    })
    socketToToken.set(socket.id, token)

    console.log(`[WS] Agent connected: ${name} (${token.slice(0, 8)}...)`)
    socket.emit('agent:connected', { ok: true })
    io.emit('agent:status', { online: true, name })
  })

  socket.on('agent:heartbeat', () => {
    const token = socketToToken.get(socket.id)
    if (token) {
      const agent = agents.get(token)
      if (agent) {
        agent.lastHeartbeat = Date.now()
        console.log(`[WS] Heartbeat from ${agent.name}`)
      }
    }
  })

  socket.on('chat:stream', (data) => {
    const { requestId, type, content, done } = data
    const pending = pendingRequests.get(requestId)
    if (pending) {
      if (done) {
        pending.resolve(pending.chunks)
        clearTimeout(pending.timeout)
        pendingRequests.delete(requestId)
      } else if (type && content !== undefined) {
        pending.chunks.push({ type, content })
      }
    }
  })

  socket.on('disconnect', () => {
    const token = socketToToken.get(socket.id)
    if (token) {
      const agent = agents.get(token)
      console.log(`[WS] Agent disconnected: ${agent?.name}`)
      agents.delete(token)
      socketToToken.delete(socket.id)

      io.emit('agent:status', { online: false, name: agent?.name })

      for (const [requestId, pending] of pendingRequests) {
        clearTimeout(pending.timeout)
        pending.reject(new Error('Агент отключился'))
        pendingRequests.delete(requestId)
      }
    }
  })
})

function getAgentStatus(token) {
  const agent = agents.get(token)
  if (!agent) return { online: false, name: null }
  const isStale = Date.now() - agent.lastHeartbeat > 35_000
  return { online: !isStale, name: agent.name }
}

function sendToAgent(token, request, timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    const agent = agents.get(token)
    console.log(`[WS] sendToAgent: token=${token.slice(0, 8)}... found=${!!agent}`)
    if (!agent || Date.now() - agent.lastHeartbeat > 35_000) {
      reject(new Error('Агент не подключён'))
      return
    }

    const timeout = setTimeout(() => {
      pendingRequests.delete(request.requestId)
      reject(new Error('Таймаут ответа от Агента'))
    }, timeoutMs)

    pendingRequests.set(request.requestId, {
      resolve,
      reject,
      timeout,
      chunks: [],
    })

    io.to(agent.socketId).emit('chat:request', {
      requestId: request.requestId,
      messages: request.messages,
      model: request.model,
      systemPrompt: request.systemPrompt,
    })

    console.log(`[WS] Sent request to ${agent.name}: ${request.requestId}`)
  })
}

io.engine.on('connection_error', (err) => {
  console.error('[WS] Connection error:', err.message)
})

server.listen(PORT, () => {
  console.log(`[WS] WebSocket server running on port ${PORT}`)
})

module.exports = { io, server, getAgentStatus, sendToAgent }
