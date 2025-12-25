// storage.js - simple localStorage helpers for stations
const ST_KEY = 'stations_v1'

export function loadStations(){
  try{ return JSON.parse(localStorage.getItem(ST_KEY) || '[]') }
  catch(e){ return [] }
}

export function saveStations(list){
  localStorage.setItem(ST_KEY, JSON.stringify(list))
}
