const { Server } = require('socket.io')
const { WebSocketServer } = require('ws')
const http = require('http')
const { randomUUID } = require('crypto')

const PORT = process.env.PORT || 3000
const NEXT_INTERNAL_PORT = process.env.NEXT_INTERNAL_PORT || 3001
const SAAS_URL = process.env.SAAS_URL || 'http://localhost:3000'
const SAAS_HOST = new URL(SAAS_URL).hostname

async function verifyAgentToken(token) {
  try {
    const res = await fetch(`${SAAS_URL}/api/agent/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    return data
  } catch (err) {
    console.error('[WS] Token verification failed:', err.message)
    return { valid: false }
  }
}

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

  if (req.url === '/api/agent/embed' && req.method === 'POST') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', async () => {
      try {
        const { token, text, model } = JSON.parse(body)
        const embedding = await embedViaAgent(token, { text, model })
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, embedding }))
      } catch (err) {
        res.writeHead(502, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message }))
      }
    })
    return
  }

  if (req.url === '/api/agent/generate-image' && req.method === 'POST') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', async () => {
      try {
        const { token, requestId, prompt } = JSON.parse(body)
        const result = await sendImageRequestToAgent(token, { requestId, prompt })
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, url: result.url }))
      } catch (err) {
        res.writeHead(502, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message }))
      }
    })
    return
  }

  // Tunnel HTTP proxy — browser → SaaS → WS Server → Agent → ComfyUI
  if (req.url.startsWith('/api/agent/tunnel') && req.method === 'POST') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', async () => {
      try {
        const { token, method, path, headers, body: reqBody } = JSON.parse(body)
        const result = await sendTunnelRequest(token, { method, path, headers, body: reqBody })
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      } catch (err) {
        res.writeHead(502, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message }))
      }
    })
    return
  }

  const nextOpts = {
    hostname: SAAS_HOST,
    port: NEXT_INTERNAL_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `${SAAS_HOST}:${NEXT_INTERNAL_PORT}` },
  }
  const nextReq = http.request(nextOpts, (nextRes) => {
    res.writeHead(nextRes.statusCode, nextRes.headers)
    nextRes.pipe(res)
  })
  nextReq.on('error', (err) => {
    console.error('[WS] Next.js proxy error:', err.message)
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Next.js proxy error: ' + err.message }))
    }
  })
  req.pipe(nextReq)
})

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 25_000,
  pingTimeout: 30_000,
})

const agents = new Map()
const socketToToken = new Map()
const pendingRequests = new Map()
const pendingEmbedRequests = new Map()
const pendingImageRequests = new Map()
const pendingTunnelRequests = new Map()
const wsConnections = new Map()

// Raw WebSocket for ComfyUI tunnel
const wss = new WebSocketServer({ server, path: '/comfyui/ws' })

wss.on('connection', (browserWs, req) => {
  const url = new URL(req.url, 'http://localhost')
  const token = url.searchParams.get('token')
  if (!token) { browserWs.close(4001, 'Token required'); return }

  const agent = agents.get(token)
  if (!agent || Date.now() - agent.lastHeartbeat > 60_000) {
    browserWs.close(4001, 'Agent not connected'); return
  }

  const connectionId = randomUUID()
  wsConnections.set(connectionId, browserWs)

  io.to(agent.socketId).emit('tunnel:ws:open', {
    connectionId,
    query: url.searchParams.toString(),
  })

  browserWs.on('message', (data) => {
    const isBuf = Buffer.isBuffer(data)
    io.to(agent.socketId).emit('tunnel:ws:message', {
      connectionId,
      data: isBuf ? data.toString('base64') : data.toString(),
      binary: isBuf,
    })
  })

  browserWs.on('close', () => {
    io.to(agent.socketId).emit('tunnel:ws:close', { connectionId })
    wsConnections.delete(connectionId)
  })

  browserWs.on('error', () => {
    io.to(agent.socketId).emit('tunnel:ws:close', { connectionId })
    wsConnections.delete(connectionId)
  })
})

io.on('connection', (socket) => {
  console.log(`[WS] New connection: ${socket.id}`)

  socket.on('agent:connect', async (data) => {
    const { token, name, httpPort } = data
    if (!token) {
      socket.emit('agent:error', { error: 'Токен обязателен' })
      return
    }

    const verification = await verifyAgentToken(token)
    if (!verification.valid) {
      console.log(`[WS] Agent rejected: invalid token (${token.slice(0, 8)}...)`)
      socket.emit('agent:error', { error: 'Неверный или отозванный токен' })
      return
    }

    agents.set(token, {
      socketId: socket.id,
      name: name || 'Unknown Agent',
      token,
      userId: verification.userId,
      tokenName: verification.tokenName,
      connectedAt: Date.now(),
      lastHeartbeat: Date.now(),
      httpPort: httpPort || null,
    })
    socketToToken.set(socket.id, token)

    console.log(`[WS] Agent connected: ${name} (${verification.tokenName}) user=${verification.userId.slice(0, 8)}...`)
    socket.emit('agent:connected', { ok: true })
    io.emit('agent:status', { online: true, name })
  })

  socket.on('agent:heartbeat', () => {
    const token = socketToToken.get(socket.id)
    if (token) {
      const agent = agents.get(token)
      if (agent) {
        agent.lastHeartbeat = Date.now()
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

  socket.on('embed:result', (data) => {
    const { requestId, embedding, error } = data
    const pending = pendingEmbedRequests.get(requestId)
    if (pending) {
      clearTimeout(pending.timeout)
      pendingEmbedRequests.delete(requestId)
      if (error) {
        pending.reject(new Error(error))
      } else {
        pending.resolve(embedding)
      }
    }
  })

  socket.on('image:result', (data) => {
    const { requestId, url, error } = data
    const pending = pendingImageRequests.get(requestId)
    if (pending) {
      clearTimeout(pending.timeout)
      pendingImageRequests.delete(requestId)
      if (url) {
        pending.resolve({ url })
      } else if (error) {
        pending.reject(new Error(error))
      }
    }
  })

  // Tunnel HTTP response from Agent
  socket.on('tunnel:http:response', (data) => {
    const { requestId } = data
    const pending = pendingTunnelRequests.get(requestId)
    if (pending) {
      clearTimeout(pending.timeout)
      pendingTunnelRequests.delete(requestId)
      pending.resolve(data)
    }
  })

  // Tunnel WS relay from Agent → browser
  socket.on('tunnel:ws:opened', (data) => {
    // Agent подтвердил открытие WS — nothing to forward to browser
  })

  socket.on('tunnel:ws:message', (data) => {
    const { connectionId, data: msgData, binary } = data
    const bw = wsConnections.get(connectionId)
    if (bw && bw.readyState === 1) {
      bw.send(binary ? Buffer.from(msgData, 'base64') : msgData)
    }
  })

  socket.on('tunnel:ws:close', (data) => {
    const { connectionId } = data
    const bw = wsConnections.get(connectionId)
    if (bw && bw.readyState <= 2) bw.close()
    wsConnections.delete(connectionId)
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
      for (const [requestId, pending] of pendingImageRequests) {
        clearTimeout(pending.timeout)
        pending.reject(new Error('Агент отключился'))
        pendingImageRequests.delete(requestId)
      }
      for (const [requestId, pending] of pendingTunnelRequests) {
        clearTimeout(pending.timeout)
        pending.reject(new Error('Агент отключился'))
        pendingTunnelRequests.delete(requestId)
      }
      // Close all WS connections for this agent
      for (const [cid, bw] of wsConnections) {
        if (bw.readyState <= 2) bw.close()
        wsConnections.delete(cid)
      }
    }
  })
})

function getAgentStatus(token) {
  const agent = agents.get(token)
  if (!agent) return { online: false, name: null }
  const isStale = Date.now() - agent.lastHeartbeat > 60_000
  return { online: !isStale, name: agent.name, httpPort: agent.httpPort }
}

function sendToAgent(token, request, timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    const agent = agents.get(token)
    console.log(`[WS] sendToAgent: token=${token.slice(0, 8)}... found=${!!agent}`)
    if (!agent || Date.now() - agent.lastHeartbeat > 60_000) {
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

function embedViaAgent(token, request, timeoutMs = 60_000) {
  return new Promise((resolve, reject) => {
    const agent = agents.get(token)
    if (!agent || Date.now() - agent.lastHeartbeat > 60_000) {
      reject(new Error('Агент не подключён'))
      return
    }

    const requestId = `embed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const timeout = setTimeout(() => {
      pendingEmbedRequests.delete(requestId)
      reject(new Error('Таймаут эмбеддинга от Агента'))
    }, timeoutMs)

    pendingEmbedRequests.set(requestId, { resolve, reject, timeout })

    io.to(agent.socketId).emit('embed:request', {
      requestId,
      text: request.text,
      model: request.model,
    })

    console.log(`[WS] Sent embed request to ${agent.name}: ${requestId}`)
  })
}

function sendImageRequestToAgent(token, request, timeoutMs = 180_000) {
  return new Promise((resolve, reject) => {
    const agent = agents.get(token)
    if (!agent || Date.now() - agent.lastHeartbeat > 60_000) {
      reject(new Error('Агент не подключён'))
      return
    }

    const timeout = setTimeout(() => {
      pendingImageRequests.delete(request.requestId)
      reject(new Error('Таймаут генерации изображения'))
    }, timeoutMs)

    pendingImageRequests.set(request.requestId, {
      resolve,
      reject,
      timeout,
    })

    io.to(agent.socketId).emit('image:request', {
      requestId: request.requestId,
      prompt: request.prompt,
    })

    console.log(`[WS] Sent image request to ${agent.name}: ${request.requestId}`)
  })
}

io.engine.on('connection_error', (err) => {
  console.error('[WS] Connection error:', err.message)
})

server.listen(PORT, () => {
  console.log(`[WS] WebSocket server running on port ${PORT}`)
})

function sendTunnelRequest(token, request, timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    const agent = agents.get(token)
    if (!agent || Date.now() - agent.lastHeartbeat > 60_000) {
      reject(new Error('Агент не подключён'))
      return
    }

    const requestId = `tunnel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const timeout = setTimeout(() => {
      pendingTunnelRequests.delete(requestId)
      reject(new Error('Таймаут туннеля'))
    }, timeoutMs)

    pendingTunnelRequests.set(requestId, { resolve, reject, timeout })

    io.to(agent.socketId).emit('tunnel:http:request', {
      requestId,
      method: request.method,
      path: request.path,
      headers: request.headers,
      body: request.body || null,
    })
  })
}

module.exports = { io, server, getAgentStatus, sendToAgent, embedViaAgent }
