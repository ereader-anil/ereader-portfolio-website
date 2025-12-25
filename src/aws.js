// mqtt.js - MQTT client helpers for HiveMQ
export function loadMqttSettings(){
  try{ return JSON.parse(localStorage.getItem('mqtt_settings') || '{}') }
  catch(e){ return {} }
}

export function saveMqttSettings(cfg){
  localStorage.setItem('mqtt_settings', JSON.stringify(cfg))
}

let mqttClient = null

function getMqttClient() {
  if (mqttClient && mqttClient.connected) {
    return mqttClient
  }
  
  const cfg = loadAwsSettings()
  if (!cfg.broker) {
    throw new Error('MQTT broker not configured')
  }
  
  const protocol = cfg.secure ? 'wss' : 'ws'
  const port = cfg.port || (cfg.secure ? 8884 : 8883)
  const url = `${protocol}://${cfg.broker}:${port}/mqtt`
  
  const options = {
    username: cfg.username,
    password: cfg.password,
    clientId: `station-manager-${Date.now()}`,
    clean: true,
    reconnectPeriod: 1000,
    connectTimeout: 30000,
  }
  
  mqttClient = mqtt.connect(url, options)
  
  return mqttClient
}

export async function publishAws(topic, payload){
  const cfg = loadMqttSettings()
  if(!cfg.broker){
    // not configured, fallback to simulated delay
    return new Promise(r=>setTimeout(r, 450))
  }

  const client = getMqttClient()
  
  return new Promise((resolve, reject) => {
    if (!client.connected) {
      client.on('connect', () => {
        client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })
      client.on('error', reject)
    } else {
      client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
        if (err) reject(err)
        else resolve()
      })
    }
  })
}
