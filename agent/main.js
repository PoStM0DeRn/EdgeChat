const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron')
const path = require('path')
const { io } = require('socket.io-client')
const http = require('http')
const fs = require('fs')

const LMSTUDIO_URL = process.env.LMSTUDIO_URL || 'http://localhost:1234'
const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json')

let mainWindow = null
let tray = null
let socket = null
let isConnected = false
let currentStatus = { online: false, name: 'Agent' }
let heartbeatInterval = null

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
    }
  } catch {}
  return { saasUrl: '', agentToken: '', agentName: 'My PC', lmstudioUrl: 'http://localhost:1234', lmstudioModel: 'qwythos-9b-claude-mythos-5-1m' }
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

  const wsUrl = saasUrl.replace(/\/+$/, '').replace(/:\d+$/, '') + ':3002'

  socket = io(wsUrl, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
  })

  socket.on('connect', () => {
    console.log('Connected to server:', wsUrl)
    socket.emit('agent:connect', {
      token: agentToken,
      name: agentName || 'My PC',
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
          console.log('Heartbeat sent')
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

  socket.on('disconnect', (reason) => {
    isConnected = false
    currentStatus = { online: false, name: agentName || 'My PC' }
    mainWindow?.webContents.send('status', currentStatus)
    updateTrayMenu()
    console.log('Disconnected:', reason)
  })

  socket.on('connect_error', (err) => {
    console.error('Connection error:', err.message)
    mainWindow?.webContents.send('status', {
      online: false,
      error: `Ошибка подключения: ${err.message}`,
    })
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

// IPC handlers from renderer
ipcMain.handle('get-config', () => loadConfig())
ipcMain.handle('save-config', (_, config) => {
  saveConfig(config)
  return { ok: true }
})
ipcMain.handle('connect-agent', (_, { saasUrl, agentToken, agentName, lmstudioUrl, lmstudioModel }) => {
  saveConfig({ saasUrl, agentToken, agentName, lmstudioUrl, lmstudioModel })
  connect(saasUrl, agentToken, agentName)
})
ipcMain.handle('disconnect-agent', () => disconnect())
ipcMain.handle('get-status', () => currentStatus)

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

app.whenReady().then(() => {
  createWindow()
  createTray()

  // Auto-connect if config exists
  const config = loadConfig()
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
