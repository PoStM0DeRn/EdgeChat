const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog } = require('electron')
const path = require('path')
const { io } = require('socket.io-client')
const http = require('http')
const fs = require('fs')
const net = require('net')
const { randomUUID } = require('crypto')

const LMSTUDIO_URL = process.env.LMSTUDIO_URL || 'http://localhost:1234'
const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json')
const tunnelHttpAgent = new http.Agent({ keepAlive: true, maxSockets: 8 })

let mainWindow = null
let tray = null
let socket = null
let isConnected = false
let currentStatus = { online: false, name: 'Agent' }
let heartbeatInterval = null
let currentAgentToken = null
let tunnelHttpPort = null

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
    }
  } catch {}
  return { saasUrl: '', agentToken: '', agentName: 'My PC', lmstudioUrl: 'http://localhost:1234', lmstudioModel: 'qwythos-9b-claude-mythos-5-1m', comfyUrl: 'http://localhost:8188', workflowPath: '' }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8')
  } catch (err) {
    console.error('Failed to save config:', err)
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 580,
    resizable: false,
    frame: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'icon.png'),
    show: false,
  })

  mainWindow.loadFile(path.join(__dirname, 'index.html'))

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('close', (e) => {
    if (isConnected) {
      e.preventDefault()
      mainWindow.hide()
    }
  })
}

function createTray() {
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setToolTip('TunnelChat Agent')

  updateTrayMenu()

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    }
  })
}

function updateTrayMenu() {
  if (!tray) return

  const statusLabel = isConnected ? '🟢 Подключён' : '🔴 Отключён'
  const menu = Menu.buildFromTemplate([
    { label: statusLabel, enabled: false },
    { type: 'separator' },
    {
      label: 'Показать окно',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      },
    },
    {
      label: isConnected ? 'Отключиться' : 'Подключиться',
      click: () => {
        if (isConnected) {
          disconnect()
        } else {
          const config = loadConfig()
          connect(config.saasUrl, config.agentToken, config.agentName)
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Выйти',
      click: () => {
        disconnect()
        app.quit()
      },
    },
  ])

  tray.setContextMenu(menu)
}

function connect(saasUrl, agentToken, agentName) {
  currentAgentToken = agentToken
  if (!saasUrl || !agentToken) {
    mainWindow?.webContents.send('status', {
      online: false,
      error: 'Укажите URL сервера и токен',
    })
    return
  }

  if (socket?.connected) {
    socket.disconnect()
  }

  // Build WS URL: Agent connects directly to WS Server on port 3000
  let wsUrl
  try {
    const parsed = new URL(saasUrl)
    wsUrl = `${parsed.protocol}//${parsed.hostname}:3000`
  } catch {
    wsUrl = saasUrl.replace(/\/+$/, '').replace(/:\d+$/, '').replace(/\/.*$/, '') + ':3000'
  }

  let reconnectAttempt = 0

  socket = io(wsUrl, {
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
  })

  socket.on('connect', () => {
    reconnectAttempt = 0
    console.log('Connected to server:', wsUrl)
    socket.emit('agent:connect', {
      token: agentToken,
      name: agentName || 'My PC',
      httpPort: tunnelHttpPort,
    })
  })

  socket.on('agent:connected', (data) => {
    if (data.ok) {
      isConnected = true
      currentStatus = { online: true, name: agentName || 'My PC' }
      mainWindow?.webContents.send('status', currentStatus)
      updateTrayMenu()
      console.log('Agent registered successfully')

      if (heartbeatInterval) clearInterval(heartbeatInterval)
      heartbeatInterval = setInterval(() => {
        if (socket?.connected) {
          socket.emit('agent:heartbeat')
        }
      }, 5000)
    }
  })

  socket.on('agent:error', (data) => {
    console.error('Agent registration error:', data.error)
    mainWindow?.webContents.send('status', {
      online: false,
      error: data.error,
    })
  })

  socket.on('chat:request', async (data) => {
    console.log('Chat request received:', data.requestId)
    handleChatRequest(data)
  })

  socket.on('embed:request', async (data) => {
    console.log('Embed request received:', data.requestId)
    handleEmbedRequest(data)
  })

  socket.on('image:request', async (data) => {
    console.log('Image request received:', data.requestId)
    await handleImageRequest(data)
  })

  // Tunnel HTTP — SaaS → Agent → ComfyUI
  socket.on('tunnel:http:request', async (data) => {
    const { requestId, method, path, headers, body } = data
    const config = loadConfig()
    const parsedUrl = new URL(config.comfyUrl || 'http://localhost:8188')
    const comfyPort = parsedUrl.port || 8188

    const fixedHeaders = { ...(headers || {}) }
    delete fixedHeaders.host
    delete fixedHeaders.Host
    delete fixedHeaders.origin
    delete fixedHeaders.Origin
    delete fixedHeaders.referer
    delete fixedHeaders.Referer
    for (const k of Object.keys(fixedHeaders)) {
      if (k.toLowerCase().startsWith('sec-')) delete fixedHeaders[k]
    }
    fixedHeaders.host = `127.0.0.1:${comfyPort}`

    try {
      const result = await httpRequestFull(
        '127.0.0.1', comfyPort, path, method || 'GET',
        fixedHeaders,
        body || null
      )
      socket?.emit('tunnel:http:response', {
        requestId,
        statusCode: result.statusCode,
        headers: result.headers,
        body: result.body.toString('base64'),
      })
    } catch (err) {
      socket?.emit('tunnel:http:response', {
        requestId,
        error: err.message,
      })
    }
  })

  // Tunnel WS — Agent ↔ ComfyUI
  const comfyWsConnections = new Map()

  socket.on('tunnel:ws:open', async (data) => {
    const { connectionId, query } = data
    try {
      const WebSocket = require('ws')
      const config = loadConfig()
      const comfyUrl = new URL(config.comfyUrl || 'http://localhost:8188')
      const comfyPort = comfyUrl.port || 8188
      const ws = new WebSocket(`ws://127.0.0.1:${comfyPort}/ws?${query || ''}`)

      ws.on('open', () => {
        comfyWsConnections.set(connectionId, ws)
        socket?.emit('tunnel:ws:opened', { connectionId })
      })

      ws.on('message', (data) => {
        const isBuf = Buffer.isBuffer(data)
        socket?.emit('tunnel:ws:message', {
          connectionId,
          data: isBuf ? data.toString('base64') : data.toString(),
          binary: isBuf,
        })
      })

      ws.on('close', () => {
        comfyWsConnections.delete(connectionId)
        socket?.emit('tunnel:ws:close', { connectionId })
      })

      ws.on('error', (err) => {
        console.error(`[Tunnel WS] Error ${connectionId}: ${err.message}`)
        comfyWsConnections.delete(connectionId)
      })
    } catch (err) {
      socket?.emit('tunnel:ws:close', { connectionId })
    }
  })

  socket.on('tunnel:ws:message', (data) => {
    const { connectionId, data: msgData, binary } = data
    const ws = comfyWsConnections.get(connectionId)
    if (ws && ws.readyState === ws.OPEN) {
      ws.send(binary ? Buffer.from(msgData, 'base64') : msgData)
    }
  })

  socket.on('tunnel:ws:close', (data) => {
    const { connectionId } = data
    const ws = comfyWsConnections.get(connectionId)
    if (ws) { ws.close(); comfyWsConnections.delete(connectionId) }
  })

  socket.on('disconnect', (reason) => {
    // Don't update UI during transport upgrades or server-initiated reconnects
    if (reason === 'io server disconnect' || reason === 'transport close' || reason === 'ping timeout') {
      console.log('Disconnect (will reconnect):', reason)
      return
    }
    isConnected = false
    currentStatus = { online: false, name: agentName || 'My PC' }
    mainWindow?.webContents.send('status', currentStatus)
    updateTrayMenu()
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
      heartbeatInterval = null
    }
    console.log('Disconnected:', reason)
  })

  socket.on('connect_error', (err) => {
    reconnectAttempt++
    // Only log first attempt and every 5th as warning, not error
    if (reconnectAttempt === 1 || reconnectAttempt % 5 === 0) {
      console.warn(`Connection attempt ${reconnectAttempt}: ${err.message}`)
    }
    // Don't spam UI during transport upgrades — only show on first 3 attempts
    if (reconnectAttempt <= 3 && !isConnected) {
      mainWindow?.webContents.send('status', {
        online: false,
        error: `Ошибка подключения: ${err.message}`,
      })
    }
  })
}

function disconnect() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
    heartbeatInterval = null
  }
  if (socket) {
    socket.disconnect()
    socket = null
  }
  isConnected = false
  currentStatus = { online: false, name: currentStatus.name }
  mainWindow?.webContents.send('status', currentStatus)
  updateTrayMenu()
}

async function handleChatRequest(data) {
  const { requestId, messages, model } = data
  const config = loadConfig()
  const lmstudioUrl = config.lmstudioUrl || LMSTUDIO_URL
  const lmstudioModel = config.lmstudioModel || 'qwythos-9b-claude-mythos-5-1m'

  console.log(`Chat request: model=${model} → lmstudio=${lmstudioModel} @ ${lmstudioUrl}`)

  try {
    const url = new URL(lmstudioUrl)

    const postData = JSON.stringify({
      model: lmstudioModel,
      messages: messages,
      stream: true,
    })

    const options = {
      hostname: url.hostname,
      port: url.port || 1234,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    }

    const req = http.request(options, (res) => {
      if (res.statusCode !== 200) {
        let errorBody = ''
        res.on('data', (chunk) => { errorBody += chunk })
        res.on('end', () => {
          console.error('LM Studio error:', res.statusCode, errorBody)
          socket?.emit('chat:stream', { requestId, done: true })
        })
        return
      }

      let buffer = ''

      res.on('data', (chunk) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim() || line === 'data: [DONE]') continue
          try {
            const json = JSON.parse(line.replace(/^data: /, ''))
            const delta = json.choices?.[0]?.delta
            if (delta?.content) {
              socket?.emit('chat:stream', {
                requestId,
                type: 'content',
                content: delta.content,
              })
            }
            if (delta?.reasoning_content) {
              socket?.emit('chat:stream', {
                requestId,
                type: 'thinking',
                content: delta.reasoning_content,
              })
            }
          } catch {}
        }
      })

      res.on('end', () => {
        if (buffer.trim() && buffer.trim() !== 'data: [DONE]') {
          try {
            const json = JSON.parse(buffer.trim().replace(/^data: /, ''))
            const delta = json.choices?.[0]?.delta
            if (delta?.content) {
              socket?.emit('chat:stream', {
                requestId,
                type: 'content',
                content: delta.content,
              })
            }
          } catch {}
        }
        socket?.emit('chat:stream', { requestId, done: true })
      })
    })

    req.on('error', (err) => {
      console.error('LM Studio request error:', err.message)
      socket?.emit('chat:stream', { requestId, done: true })
    })

    req.write(postData)
    req.end()
  } catch (err) {
    console.error('Chat request error:', err.message)
    socket?.emit('chat:stream', { requestId, done: true })
  }
}

async function handleEmbedRequest(data) {
  const { requestId, text, model } = data
  const config = loadConfig()
  const lmstudioUrl = config.lmstudioUrl || LMSTUDIO_URL
  const embedModel = model || 'nomic-embed-text'

  console.log(`Embed request: model=${embedModel} @ ${lmstudioUrl}`)

  try {
    const url = new URL(lmstudioUrl)

    // Try Ollama native endpoint first
    try {
      const postData = JSON.stringify({ model: embedModel, prompt: text })
      const result = await httpRequest({
        hostname: url.hostname,
        port: url.port || 1234,
        path: '/api/embeddings',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
      }, postData)
      const json = JSON.parse(result)
      if (json.embedding && Array.isArray(json.embedding)) {
        socket?.emit('embed:result', { requestId, embedding: json.embedding })
        return
      }
    } catch {}

    // Try OpenAI-compatible endpoint
    const postData = JSON.stringify({ model: embedModel, input: text })
    const result = await httpRequest({
      hostname: url.hostname,
      port: url.port || 1234,
      path: '/v1/embeddings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
    }, postData)
    const json = JSON.parse(result)
    if (json.data?.[0]?.embedding) {
      socket?.emit('embed:result', { requestId, embedding: json.data[0].embedding })
      return
    }

    socket?.emit('embed:result', { requestId, error: 'Не удалось получить эмбеддинги' })
  } catch (err) {
    console.error('Embed request error:', err.message)
    socket?.emit('embed:result', { requestId, error: err.message })
  }
}

function httpRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`))
        } else {
          resolve(data)
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')) })
    if (postData) req.write(postData)
    req.end()
  })
}

// IPC handlers from renderer
ipcMain.handle('get-config', () => loadConfig())
ipcMain.handle('save-config', (_, config) => {
  saveConfig(config)
  return { ok: true }
})
ipcMain.handle('connect-agent', (_, { saasUrl, agentToken, agentName, lmstudioUrl, lmstudioModel, comfyUrl, workflowPath }) => {
  saveConfig({ saasUrl, agentToken, agentName, lmstudioUrl, lmstudioModel, comfyUrl, workflowPath })
  connect(saasUrl, agentToken, agentName)
})
ipcMain.handle('disconnect-agent', () => disconnect())
ipcMain.handle('get-status', () => currentStatus)
ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Workflow JSON', extensions: ['json'] }],
  })
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0]
  }
  return null
})

// LM Studio availability check
ipcMain.handle('check-lmstudio', async () => {
  const config = loadConfig()
  const lmstudioUrl = config.lmstudioUrl || LMSTUDIO_URL
  try {
    const url = new URL(lmstudioUrl)
    return new Promise((resolve) => {
      const req = http.request({
        hostname: url.hostname,
        port: url.port || 1234,
        path: '/v1/models',
        method: 'GET',
        timeout: 5000,
      }, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            resolve({ ok: true, models: json.data?.map((m) => m.id) || [] })
          } catch {
            resolve({ ok: false, error: 'Invalid response' })
          }
        })
      })
      req.on('error', (err) => resolve({ ok: false, error: err.message }))
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'Timeout' }) })
      req.end()
    })
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

// ── ComfyUI / Image Generation ──

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function startComfyProxy(targetHost = '127.0.0.1', targetPort = 8188, proxyPort = 8189) {
  const server = net.createServer((client) => {
    const target = new net.Socket()
    target.connect(targetPort, targetHost, () => {
      client.pipe(target)
      target.pipe(client)
    })
    target.on('error', (err) => {
      console.error('[ComfyProxy] Target error:', err.message)
      client.destroy()
    })
    client.on('error', (err) => {
      console.error('[ComfyProxy] Client error:', err.message)
      target.destroy()
    })
  })
  server.listen(proxyPort, '127.0.0.1', () => {
    console.log(`[ComfyProxy] :${proxyPort} → ${targetHost}:${targetPort}`)
  })
  server.on('error', (err) => {
    console.error('[ComfyProxy] Server error:', err.message)
  })
  return server
}

function startTunnelHttpProxy() {
  const server = http.createServer((req, res) => {
    const token = (req.headers['x-agent-token'] || '').trim()
    if (!currentAgentToken || token !== currentAgentToken) {
      res.writeHead(403)
      res.end('Forbidden')
      return
    }

    const config = loadConfig()
    const comfyUrl = new URL(config.comfyUrl || 'http://localhost:8188')
    const comfyHost = comfyUrl.hostname || '127.0.0.1'
    const comfyPort = comfyUrl.port || 8188

    const options = {
      hostname: comfyHost,
      port: parseInt(comfyPort, 10),
      path: req.url || '/',
      method: req.method,
      headers: { ...req.headers, host: `${comfyHost}:${comfyPort}` },
      timeout: 120000,
      agent: tunnelHttpAgent,
    }

    delete options.headers['x-agent-token']
    delete options.headers['proxy-connection']

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers)
      proxyRes.pipe(res)
    })

    proxyReq.on('error', (err) => {
      console.error('[Tunnel HTTP] Proxy error:', err.message)
      if (!res.headersSent) {
        res.writeHead(502)
        res.end(JSON.stringify({ error: err.message }))
      }
    })

    req.pipe(proxyReq)
  })

  server.listen(0, '127.0.0.1', () => {
    tunnelHttpPort = server.address().port
    console.log(`[Tunnel HTTP] :${tunnelHttpPort} → ComfyUI`)
  })

  server.on('error', (err) => {
    console.error('[Tunnel HTTP] Server error:', err.message)
  })

  return server
}

function httpRequestJson(url, method, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    }
    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data))
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`))
          }
        } catch (e) {
          reject(new Error(`Parse error: ${data.slice(0, 100)}`))
        }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')) })
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

function httpRequestBuffer(url, method) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      timeout: 30000,
    }
    const req = http.request(options, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(Buffer.concat(chunks))
        } else {
          reject(new Error(`HTTP ${res.statusCode}`))
        }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')) })
    req.end()
  })
}

// Full HTTP request for tunneling (returns body as Buffer, preserves status/headers)
function httpRequestFull(hostname, port, path, method, headers, body) {
  return new Promise((resolve, reject) => {
    const options = { hostname, port, path, method, headers, timeout: 120000, agent: tunnelHttpAgent }
    const req = http.request(options, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks),
        })
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')) })
    if (body) req.write(Buffer.isBuffer(body) ? body : Buffer.from(body, 'base64'))
    req.end()
  })
}

function uploadFile(url, buffer, filename) {
  console.log(`[Upload] token present: ${!!currentAgentToken}, prefix: ${(currentAgentToken || '').slice(0, 16)}...`)
  console.log(`[Upload] URL: ${url}`)
  const boundary = '----FormBoundary' + randomUUID().replace(/-/g, '')
  const header = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`
  )
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`)
  const body = Buffer.concat([header, buffer, footer])

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        'agent-token': currentAgentToken || '',
      },
      timeout: 30000,
    }
    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data))
          } else {
            reject(new Error(`Upload failed: HTTP ${res.statusCode}: ${data.slice(0, 200)}`))
          }
        } catch (e) {
          reject(new Error(`Upload parse error: ${data.slice(0, 100)}`))
        }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')) })
    req.write(body)
    req.end()
  })
}

async function handleImageRequest(data) {
  const { requestId, prompt } = data
  const config = loadConfig()
  const comfyUrl = config.comfyUrl || 'http://localhost:8188'
  const workflowPath = config.workflowPath

  console.log(`[Image] Request: ${requestId}, prompt: "${(prompt || '').slice(0, 60)}..."`)

  try {
    if (!workflowPath || !fs.existsSync(workflowPath)) {
      throw new Error(`Workflow не найден: ${workflowPath}`)
    }

    const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf-8'))

    // Auto-detect nodes by class_type (works with ANY workflow)
    for (const [nodeId, node] of Object.entries(workflow)) {
      if (!node?.inputs) continue
      const ct = node.class_type
      if (ct === 'CLIPTextEncode') {
        node.inputs.text = prompt
      } else if (ct === 'KSampler') {
        node.inputs.seed = Math.floor(Math.random() * 2 ** 53)
        node.inputs.steps = 8
      } else if (ct === 'KSamplerAdvanced') {
        node.inputs.seed = Math.floor(Math.random() * 2 ** 53)
        node.inputs.steps = 5
        node.inputs.denoise = 0.33
      } else if (ct === 'EmptyLatentImage') {
        node.inputs.width = 1024
        node.inputs.height = 1024
      }
    }

    const clientId = randomUUID()
    const promptResp = await httpRequestJson(`${comfyUrl}/prompt`, 'POST', {
      prompt: workflow,
      client_id: clientId,
    })
    const promptId = promptResp.prompt_id
    console.log(`[Image] Queued: ${promptId}`)

    let history = null
    for (let i = 0; i < 300; i++) {
      await sleep(1000)
      try {
        const histResp = await httpRequestJson(`${comfyUrl}/history/${promptId}`, 'GET')
        if (histResp[promptId]) {
          const h = histResp[promptId]
          if (h.status?.completed || h.status?.status_str === 'success') {
            history = h
            break
          }
          if (h.status?.error) throw new Error(`ComfyUI error: ${JSON.stringify(h.status.error)}`)
        }
      } catch (e) {
        if (e.message.includes('ComfyUI error')) throw e
      }
    }

    if (!history) throw new Error('Таймаут ожидания ComfyUI')
    console.log(`[Image] Completed: ${promptId}`)

    const outputEntry = Object.entries(history.outputs || {}).find(
      ([, output]) => output.images?.[0]
    )
    if (!outputEntry) throw new Error('Нет изображения в output')
    const img = outputEntry[1].images[0]

    const params = new URLSearchParams({
      filename: img.filename,
      subfolder: img.subfolder || '',
      type: img.type || 'output',
    })
    const imageBuffer = await httpRequestBuffer(`${comfyUrl}/view?${params}`, 'GET')

    const saasUrl = config.saasUrl.replace(/\/+$/, '')
    const uploadResult = await uploadFile(`${saasUrl}/api/upload`, imageBuffer, img.filename)

    console.log(`[Image] Uploaded: ${uploadResult.url}`)

    socket?.emit('image:result', {
      requestId,
      url: uploadResult.url,
    })
  } catch (err) {
    console.error(`[Image] Error:`, err.message)
    socket?.emit('image:result', {
      requestId,
      error: err.message,
    })
  }
}

app.whenReady().then(() => {
  createWindow()
  createTray()

  // Start ComfyUI proxy (TCP :8189 → :8188)
  const config = loadConfig()
  const comfyHost = '127.0.0.1'
  const comfyPort = parseInt(new URL(config.comfyUrl || 'http://localhost:8188').port, 10) || 8188
  startComfyProxy(comfyHost, comfyPort, 8189)

  // Start HTTP proxy (direct HTTP tunnel)
  startTunnelHttpProxy()

  // Auto-connect if config exists
  if (config.saasUrl && config.agentToken) {
    connect(config.saasUrl, config.agentToken, config.agentName)
  }
})

app.on('window-all-closed', () => {
  // Keep running in tray
})

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show()
  } else {
    createWindow()
  }
})

app.on('before-quit', () => {
  disconnect()
})
