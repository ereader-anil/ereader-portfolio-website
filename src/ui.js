import { listStations, addStation, removeStation, toggleStation } from './stations.js'
import { loadMqttSettings, saveMqttSettings } from './mqtt.js'

function escapeHtml(str){return String(str).replace(/[&<>"']/g, c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

// API helper functions
async function apiRequest(endpoint, options = {}) {
  const response = await fetch(endpoint, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || 'API request failed')
  }

  return data
}

// Stats functionality
export function updateStats() {
  // Stats will be updated when stations are loaded
}

// Load stations from API
async function loadStations() {
  try {
    const data = await apiRequest('/api/stations')
    return data
  } catch (error) {
    console.error('Failed to load stations:', error)
    return []
  }
}

// Add station via API
async function createStation(stationData) {
  try {
    const data = await apiRequest('/api/stations', {
      method: 'POST',
      body: JSON.stringify(stationData)
    })
    return data.station
  } catch (error) {
    throw new Error(`Failed to add station: ${error.message}`)
  }
}

// Remove station via API
async function deleteStation(stationId) {
  try {
    await apiRequest(`/api/stations/${stationId}`, {
      method: 'DELETE'
    })
    return true
  } catch (error) {
    throw new Error(`Failed to remove station: ${error.message}`)
  }
}

// Toggle station via API
async function toggleStationAPI(stationId) {
  try {
    const data = await apiRequest(`/api/stations/${stationId}/toggle`, {
      method: 'POST'
    })
    return data
  } catch (error) {
    throw new Error(`Failed to toggle station: ${error.message}`)
  }
}

export async function renderStations(){
  const container = document.getElementById('stations')
  const stations = await loadStations()

  container.innerHTML = ''

  if(stations.length === 0){
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔋</div>
        <h3>No stations yet</h3>
        <p>Click "Add Station" to get started</p>
      </div>`
    return
  }

  stations.forEach((s, idx)=>{
    const el = document.createElement('div')
    el.className = 'station'
    el.innerHTML = `
      <h3>${escapeHtml(s.stationId)}</h3>
      <div class="meta">Charger: ${escapeHtml(s.chargerId)}</div>
      <div class="status">
        <span class="dot ${s.online ? 'online' : 'offline'}"></span>
        <strong>${s.online ? 'Online' : 'Offline'}</strong>
      </div>
      <div class="station-log" id="station-log-${s.id}">
        <div class="log-header">Activity Log</div>
        <div class="log-entries" id="log-entries-${s.id}"></div>
      </div>
      <div class="controls">
        <button class="btn primary toggle" data-station-id="${s.id}">${s.online ? 'Turn OFF' : 'Turn ON'}</button>
        <button class="btn remove" data-station-id="${s.id}">Remove</button>
      </div>`

    container.appendChild(el)

    // Initialize station log
    updateStationLog(s.id, s.logs || [])

    el.querySelector('.toggle').addEventListener('click', async ()=>{
      const button = el.querySelector('.toggle')
      const originalText = button.textContent
      button.textContent = 'Processing...'
      button.disabled = true

      try{
        const result = await toggleStationAPI(s.id)
        renderStations()
        updateStats()
        log(`Toggled ${s.stationId} -> ${result.station.online ? 'Online' : 'Offline'}`)
      }catch(err){
        log(`Failed to send command: ${err.message}`)
        button.textContent = originalText
        button.disabled = false
      }
    })

    el.querySelector('.remove').addEventListener('click', async ()=>{
      if (confirm(`Are you sure you want to remove station ${s.stationId}?`)) {
        try {
          await deleteStation(s.id)
          renderStations()
          updateStats()
          log(`Removed station ${s.stationId}`)
        } catch (error) {
          log(`Failed to remove station: ${error.message}`)
        }
      }
    })
  })

  // Update stats
  updateStatsDisplay(stations)
}

function updateStatsDisplay(stations) {
  const total = stations.length
  const online = stations.filter(s => s.online).length
  const offline = total - online

  document.getElementById('totalStations').textContent = total
  document.getElementById('onlineStations').textContent = online
  document.getElementById('offlineStations').textContent = offline
}

export function log(msg){
  const el = document.getElementById('log')
  const p = document.createElement('div')
  p.innerHTML = `<span class="log-time">${new Date().toLocaleTimeString()}</span> — <span class="log-message">${escapeHtml(msg)}</span>`
  el.prepend(p)

  // Auto-scroll to top of logs
  el.scrollTop = 0
}

function updateStationLog(stationId, logs) {
  const logContainer = document.getElementById(`log-entries-${stationId}`)
  if (!logContainer) return

  logContainer.innerHTML = ''
  logs.slice(0, 5).forEach(entry => {
    const logEntry = document.createElement('div')
    logEntry.className = `station-log-entry ${entry.type || 'info'}`
    const timestamp = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString()
    logEntry.innerHTML = `<span class="log-time">${timestamp}</span> — ${escapeHtml(entry.message)}`
    logContainer.appendChild(logEntry)
  })
}

function handleLogout() {
  fetch('/api/logout', { method: 'POST' })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        window.location.href = '/login'
      }
    })
    .catch(error => {
      console.error('Logout failed:', error)
      // Force logout on client side
      window.location.href = '/login'
    })
}

export async function initUi(){
  // Logout handler
  const logoutBtn = document.getElementById('logoutBtn')
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout)
  }

  // Station management
  const addBtn = document.getElementById('addStationBtn')
  const modal = document.getElementById('modal')
  const form = document.getElementById('stationForm')
  const cancel = document.getElementById('cancelBtn')

  if (addBtn && modal) {
    addBtn.addEventListener('click', () => { modal.classList.remove('hidden') })
  }

  if (cancel && form) {
    cancel.addEventListener('click', () => {
      modal.classList.add('hidden')
      form.reset()
    })
  }

  if (form) {
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault()
      const fd = new FormData(form)
      const stationId = fd.get('stationId').trim()
      const chargerId = fd.get('chargerId').trim()
      const mqttTopic = fd.get('mqttTopic').trim()
      const qos = parseInt(fd.get('qos')) || 1
      const msgOn = fd.get('msgOn').trim()
      const msgOff = fd.get('msgOff').trim()

      if (!stationId || !chargerId || !mqttTopic || !msgOn || !msgOff) {
        log('Please fill in all required fields')
        return
      }

      try {
        await createStation({stationId, chargerId, mqttTopic, qos, msgOn, msgOff})
        modal.classList.add('hidden')
        form.reset()
        renderStations()
        log(`Station added: ${stationId}`)
      } catch (error) {
        if (error.message.includes('authentication') || error.message.includes('login')) {
          window.location.href = '/login'
        } else {
          log(`Failed to add station: ${error.message}`)
        }
      }
    })
  }

  // AWS settings modal
  const awsBtn = document.getElementById('awsSettingsBtn')
  const awsModal = document.getElementById('awsModal')
  const awsForm = document.getElementById('awsForm')
  const awsCancel = document.getElementById('awsCancelBtn')

  if (awsBtn && awsModal) {
    awsBtn.addEventListener('click', () => { awsModal.classList.remove('hidden') })
  }

  if (awsCancel && awsModal) {
    awsCancel.addEventListener('click', () => { awsModal.classList.add('hidden') })
  }

  if (awsForm) {
    // Load MQTT settings
    try {
      const settings = await apiRequest('/api/aws-settings')
      awsForm.broker.value = settings.broker || ''
      awsForm.port.value = settings.port || '8883'
      awsForm.secure.checked = settings.secure !== false
      awsForm.username.value = settings.username || ''
      awsForm.password.value = settings.password || ''
      awsForm.clientIdPrefix.value = settings.clientIdPrefix || 'station-manager'
      awsForm.keepAlive.value = settings.keepAlive || '60'
      awsForm.qos.value = settings.qos || '1'
      awsForm.retain.checked = settings.retain || false
      awsForm.topicTemplate.value = settings.topicTemplate || 'stations/{stationId}/charger/{chargerId}/command'
    } catch (error) {
      console.error('Failed to load MQTT settings:', error)
    }

    awsForm.addEventListener('submit', async (ev) => {
      ev.preventDefault()
      const fd = new FormData(awsForm)
      const settings = {
        broker: fd.get('broker').trim(),
        port: fd.get('port').trim() || '8883',
        secure: fd.get('secure') === 'on',
        username: fd.get('username').trim(),
        password: fd.get('password').trim(),
        clientIdPrefix: fd.get('clientIdPrefix').trim() || 'station-manager',
        keepAlive: parseInt(fd.get('keepAlive')) || 60,
        qos: parseInt(fd.get('qos')) || 1,
        retain: fd.get('retain') === 'on',
        topicTemplate: fd.get('topicTemplate').trim() || 'stations/{stationId}/charger/{chargerId}/command'
      }

      try {
        await apiRequest('/api/aws-settings', {
          method: 'POST',
          body: JSON.stringify(settings)
        })
        awsModal.classList.add('hidden')
        log('MQTT settings saved successfully')
      } catch (error) {
        log(`Failed to save MQTT settings: ${error.message}`)
      }
    })
  }

  // Logs toggle
  const toggleLogsBtn = document.getElementById('toggleLogsBtn')
  if (toggleLogsBtn) {
    toggleLogsBtn.addEventListener('click', toggleLogs)
  }

  // Initial render
  await renderStations()

  // Set current user
  try {
    const session = await apiRequest('/api/session')
    if (session.isLoggedIn && session.username) {
      document.getElementById('currentUser').textContent = session.username
    }
  } catch (error) {
    console.error('Failed to get session:', error)
  }

  log('Station Manager initialized')
}

// Enhanced log toggle functionality
function toggleLogs() {
  const logsContainer = document.getElementById('logsContainer')
  const toggleBtn = document.getElementById('toggleLogsBtn')
  const toggleIcon = toggleBtn.querySelector('.toggle-icon')

  const isCollapsed = logsContainer.classList.contains('collapsed')

  if (isCollapsed) {
    logsContainer.classList.remove('collapsed')
    toggleBtn.innerHTML = '<span class="toggle-icon">▼</span> Hide Logs'
  } else {
    logsContainer.classList.add('collapsed')
    toggleBtn.innerHTML = '<span class="toggle-icon">▶</span> Show Logs'
  }
}
