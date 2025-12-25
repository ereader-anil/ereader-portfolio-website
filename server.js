const express = require('express')
const session = require('express-session')
const bodyParser = require('body-parser')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const WebSocket = require('ws')

const app = express()
const PORT = process.env.PORT || 3000

// Create HTTP server
const server = require('http').createServer(app)

// WebSocket server
const wss = new WebSocket.Server({ server })

// WebSocket connections
let esp32Clients = new Set()

wss.on('connection', (ws) => {
  console.log('🔌 ESP32 connected via WebSocket')
  esp32Clients.add(ws)

  ws.on('message', (message) => {
    console.log('📨 Received from ESP32:', message.toString())
    // Handle messages from ESP32 if needed
  })

  ws.on('close', () => {
    console.log('🔌 ESP32 disconnected')
    esp32Clients.delete(ws)
  })

  ws.on('error', (error) => {
    console.error('WebSocket error:', error)
    esp32Clients.delete(ws)
  })
})

// Function to send commands to ESP32
function sendToESP32(station, command) {
  const message = JSON.stringify({
    stationId: station.stationId,
    chargerId: station.chargerId,
    command: command,
    topic: station.mqttTopic,
    timestamp: new Date().toISOString()
  })

  let sent = false
  esp32Clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
      sent = true
    }
  })

  return sent
}

// Data storage file
const DATA_FILE = path.join(__dirname, 'data.json')

// Configuration limits
const MAX_STATIONS = 1000
const MAX_LOGS_PER_STATION = 50

// Initialize data storage
let appData = {
  stations: [],
  awsSettings: {}
}

// Load data from file
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8')
      const parsed = JSON.parse(data)

      // Validate and sanitize data
      appData = {
        stations: Array.isArray(parsed.stations) ? parsed.stations.map(validateStation) : [],
        awsSettings: parsed.awsSettings || {}
      }

      console.log(`📂 Loaded ${appData.stations.length} stations from storage`)
    } else {
      console.log('📂 No existing data file found, starting fresh')
    }
  } catch (error) {
    console.error('❌ Error loading data, using backup if available:', error)

    // Try to load from backup
    const backupFile = DATA_FILE + '.backup'
    if (fs.existsSync(backupFile)) {
      try {
        const backupData = fs.readFileSync(backupFile, 'utf8')
        appData = JSON.parse(backupData)
        console.log('✅ Loaded data from backup file')
      } catch (backupError) {
        console.error('❌ Backup file also corrupted, starting fresh')
        appData = { stations: [], awsSettings: {} }
      }
    } else {
      appData = { stations: [], awsSettings: {} }
    }
  }
}

// Validate station data
function validateStation(station) {
  return {
    id: station.id || generateId(),
    stationId: station.stationId || 'Unknown',
    chargerId: station.chargerId || 'Unknown',
    cmdOn: station.cmdOn || '',
    cmdOff: station.cmdOff || '',
    online: Boolean(station.online),
    createdAt: station.createdAt ? new Date(station.createdAt) : new Date(),
    lastToggled: station.lastToggled ? new Date(station.lastToggled) : null,
    logs: Array.isArray(station.logs) ? station.logs.slice(0, MAX_LOGS_PER_STATION) : []
  }
}

// Save data to file
function saveData() {
  try {
    // Create backup before saving
    if (fs.existsSync(DATA_FILE)) {
      const backupFile = DATA_FILE + '.backup'
      fs.copyFileSync(DATA_FILE, backupFile)
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(appData, null, 2))
    console.log('💾 Data saved successfully')
  } catch (error) {
    console.error('❌ Error saving data:', error)
  }
}

// Periodic save every 5 minutes
setInterval(saveData, 5 * 60 * 1000)

// Load data on startup
loadData()

// Generate unique ID
function generateId() {
  return crypto.randomBytes(8).toString('hex')
}

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname)))

// Session configuration
app.use(session({
  secret: 'station-manager-secret-key-2025',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    sameSite: 'lax'
  }
}))

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session.isLoggedIn) {
    return next()
  }
  res.redirect('/login')
}

// Routes
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'))
})

app.get('/login', (req, res) => {
  // If already logged in, redirect to main app
  if (req.session.isLoggedIn) {
    return res.redirect('/')
  }
  res.sendFile(path.join(__dirname, 'login.html'))
})

// API Routes
app.post('/api/login', (req, res) => {
  console.log('Login attempt:', req.body)
  const { username, password } = req.body

  // Simple authentication (in production, use proper authentication)
  if (username === 'admin' && password === 'admin123') {
    req.session.isLoggedIn = true
    req.session.username = username
    req.session.loginTime = new Date()
    res.json({ success: true, message: 'Login successful' })
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' })
  }
})

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Logout failed' })
    }
    res.json({ success: true, message: 'Logout successful' })
  })
})

app.get('/api/session', (req, res) => {
  if (req.session.isLoggedIn) {
    res.json({
      isLoggedIn: true,
      username: req.session.username,
      loginTime: req.session.loginTime
    })
  } else {
    res.json({ isLoggedIn: false })
  }
})

// Stations API
app.get('/api/stations', requireAuth, (req, res) => {
  try {
    res.json(appData.stations)
  } catch (error) {
    console.error('Error getting stations:', error)
    res.status(500).json({ success: false, message: 'Failed to load stations' })
  }
})

app.post('/api/stations', requireAuth, (req, res) => {
  try {
    const { stationId, chargerId, mqttTopic, qos, msgOn, msgOff } = req.body

    // Validate required fields
    if (!stationId || !chargerId || !mqttTopic || !msgOn || !msgOff) {
      return res.status(400).json({ success: false, message: 'All fields are required' })
    }

    // Trim and validate input
    const trimmedStationId = stationId.trim()
    const trimmedChargerId = chargerId.trim()
    const trimmedMqttTopic = mqttTopic.trim()
    const trimmedMsgOn = msgOn.trim()
    const trimmedMsgOff = msgOff.trim()

    if (!trimmedStationId || !trimmedChargerId || !trimmedMqttTopic || !trimmedMsgOn || !trimmedMsgOff) {
      return res.status(400).json({ success: false, message: 'Fields cannot be empty or whitespace only' })
    }

    // Validate QoS
    const parsedQos = parseInt(qos)
    if (isNaN(parsedQos) || parsedQos < 0 || parsedQos > 2) {
      return res.status(400).json({ success: false, message: 'QoS must be 0, 1, or 2' })
    }

    // Check station limit
    if (appData.stations.length >= MAX_STATIONS) {
      return res.status(400).json({ success: false, message: `Maximum ${MAX_STATIONS} stations allowed` })
    }

    // Validate message lengths (basic check)
    if (trimmedMsgOn.length > 1000 || trimmedMsgOff.length > 1000) {
      return res.status(400).json({ success: false, message: 'Messages are too long (max 1000 characters)' })
    }

    const newStation = {
      id: generateId(),
      stationId: trimmedStationId,
      chargerId: trimmedChargerId,
      mqttTopic: trimmedMqttTopic,
      qos: parsedQos,
      msgOn: trimmedMsgOn,
      msgOff: trimmedMsgOff,
      online: false,
      createdAt: new Date(),
      logs: [{
        timestamp: new Date(),
        message: 'Station created',
        type: 'info'
      }]
    }

    appData.stations.push(newStation)
    saveData()

    console.log(`✅ Station created: ${trimmedStationId}`)
    res.json({ success: true, station: newStation })
  } catch (error) {
    console.error('❌ Error creating station:', error)
    res.status(500).json({ success: false, message: 'Failed to create station' })
  }
})

app.delete('/api/stations/:id', requireAuth, (req, res) => {
  try {
    const stationId = req.params.id
    const stationIndex = appData.stations.findIndex(s => s.id === stationId)

    if (stationIndex === -1) {
      return res.status(404).json({ success: false, message: 'Station not found' })
    }

    const removedStation = appData.stations.splice(stationIndex, 1)[0]
    saveData()

    res.json({ success: true, station: removedStation })
  } catch (error) {
    console.error('Error deleting station:', error)
    res.status(500).json({ success: false, message: 'Failed to delete station' })
  }
})

app.post('/api/stations/:id/toggle', requireAuth, async (req, res) => {
  try {
    const stationId = req.params.id
    const station = appData.stations.find(s => s.id === stationId)

    if (!station) {
      return res.status(404).json({ success: false, message: 'Station not found' })
    }

    const newStatus = !station.online
    const message = newStatus ? station.msgOn : station.msgOff

    // Send command to ESP32 via WebSocket
    const sent = sendToESP32(station, message)
    if (!sent) {
      console.warn('⚠️ No ESP32 clients connected, command not sent')
    }

    station.online = newStatus
    station.lastToggled = new Date()

    // Add log entry
    station.logs.unshift({
      timestamp: new Date(),
      message: `Station ${newStatus ? 'turned ON' : 'turned OFF'}${sent ? '' : ' (ESP32 not connected)'}`,
      type: 'action',
      message: message
    })

    // Keep only last MAX_LOGS_PER_STATION logs
    if (station.logs.length > MAX_LOGS_PER_STATION) {
      station.logs = station.logs.slice(0, MAX_LOGS_PER_STATION)
    }

    saveData()

    res.json({
      success: true,
      station: station,
      esp32Connected: sent
    })
  } catch (error) {
    console.error('Error toggling station:', error)
    res.status(500).json({ success: false, message: 'Failed to toggle station' })
  }
})

// AWS IoT Integration
async function sendAwsCommand(station, command) {
  const settings = appData.awsSettings
  if (!settings.endpoint || !settings.region || !settings.accessKeyId || !settings.secretAccessKey) {
    throw new Error('AWS IoT settings not configured')
  }

  // Configure AWS
  AWS.config.update({
    region: settings.region,
    accessKeyId: settings.accessKeyId,
    secretAccessKey: settings.secretAccessKey,
    ...(settings.sessionToken && { sessionToken: settings.sessionToken })
  })

  const iotdata = new AWS.IotData({ endpoint: settings.endpoint })

  // Build topic from template
  const topicTemplate = settings.topicTemplate || 'stations/{stationId}/charger/{chargerId}/command'
  const topic = topicTemplate
    .replace('{stationId}', station.stationId)
    .replace('{chargerId}', station.chargerId)

  // Prepare payload
  const payload = typeof command === 'string' ? command : JSON.stringify(command)

  // Publish to IoT topic
  const params = {
    topic: topic,
    payload: payload,
    qos: 1
  }

  return new Promise((resolve, reject) => {
    iotdata.publish(params, (err, data) => {
      if (err) {
        console.error('AWS IoT publish error:', err)
        reject(new Error(`AWS IoT publish failed: ${err.message}`))
      } else {
        console.log(`✅ Published to topic: ${topic}`)
        resolve({ success: true, message: 'Command sent successfully', topic, payload })
      }
    })
  })
}

// AWS Settings API
app.get('/api/aws-settings', requireAuth, (req, res) => {
  try {
    res.json(appData.awsSettings || {})
  } catch (error) {
    console.error('Error getting AWS settings:', error)
    res.status(500).json({ success: false, message: 'Failed to load AWS settings' })
  }
})

app.post('/api/aws-settings', requireAuth, (req, res) => {
  try {
    const { endpoint, region, accessKeyId, secretAccessKey, sessionToken, topicTemplate } = req.body

    appData.awsSettings = {
      endpoint,
      region,
      accessKeyId,
      secretAccessKey,
      sessionToken,
      topicTemplate: topicTemplate || 'stations/{stationId}/charger/{chargerId}/command'
    }

    saveData()

    res.json({ success: true, message: 'AWS settings saved' })
  } catch (error) {
    console.error('Error saving AWS settings:', error)
    res.status(500).json({ success: false, message: 'Failed to save AWS settings' })
  }
})

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ success: false, message: 'Something went wrong!' })
})

// 404 handler
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '404.html'))
})

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Station Manager server running on http://localhost:${PORT}`)
  console.log(`📱 Login page: http://localhost:${PORT}/login`)
  console.log(`🏠 Main app: http://localhost:${PORT}/`)
  console.log(`💾 Data stored in: ${DATA_FILE}`)
  console.log(`🔌 WebSocket server ready for ESP32 connections`)
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...')
  saveData()
  server.close(() => {
    console.log('✅ Server stopped')
    process.exit(0)
  })
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...')
  saveData()
  server.close(() => {
    console.log('✅ Server stopped')
    process.exit(0)
  })
})