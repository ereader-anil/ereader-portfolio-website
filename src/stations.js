import { loadStations, saveStations } from './storage.js'
import { publishAws } from './mqtt.js'

export function listStations(){ return loadStations() }

export function addStation(obj){
  const list = loadStations()
  obj.online = false
  list.push(obj)
  saveStations(list)
}

export function removeStation(index){
  const list = loadStations()
  const removed = list.splice(index,1)[0]
  saveStations(list)
  return removed
}

export async function toggleStation(index){
  const list = loadStations()
  const s = list[index]
  const toOn = !s.online
  const message = toOn ? s.msgOn : s.msgOff
  const topic = s.mqttTopic.replace(/\{stationId\}/g, s.stationId).replace(/\{chargerId\}/g, s.chargerId)
  const payload = message // Send the custom message directly
  // attempt publish; if fails, this throws and callers can handle
  await publishAws(topic, payload, s.qos)
  s.online = toOn
  saveStations(list)
  return s
}
