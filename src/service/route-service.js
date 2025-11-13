// service/route-service.js
// Cálculo de ruta: lectura de sensores, filtro por umbral, Haversine, Dijkstra y permutaciones.

import { getAllSensorData } from './sensor-service.js'

// ====== CONFIG ======
const CAPACITY_CM = 23.0
const DEFAULT_THRESHOLD = 0.70 // 70%

// (Opcional) Limitar a estos deviceId si quieres whitelistear sólo 3 dispositivos.
const DEVICE_WHITELIST = [
  'arduinowan1',
  'arduinowan2',
  'arduinowan3',
]

// ====== GEODESIA ======
function toRad(d) { return d * Math.PI / 180 }
function haversineMeters(a, b) {
  const R = 6371000
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// ====== PERMUTACIONES ======
function permutations(arr) {
  if (arr.length <= 1) return [arr]
  const out = []
  for (let i = 0; i < arr.length; i++) {
    const head = arr[i]
    const rest = arr.slice(0, i).concat(arr.slice(i + 1))
    for (const p of permutations(rest)) out.push([head, ...p])
  }
  return out
}

// ====== GRAFO COMPLETO (peso = Haversine) ======
function buildCompleteGraph(points) {
  const edges = new Map()
  for (const a of points) {
    const nbrs = []
    for (const b of points) {
      if (a.id === b.id) continue
      nbrs.push({ to: b.id, w: haversineMeters(a, b) })
    }
    edges.set(a.id, nbrs)
  }
  return edges
}

// ====== DIJKSTRA ======
function dijkstra(nodes, edges, sourceId, targetId) {
  const dist = new Map(nodes.map(n => [n.id, Infinity]))
  const prev = new Map(nodes.map(n => [n.id, null]))
  const Q = new Set(nodes.map(n => n.id))
  dist.set(sourceId, 0)

  while (Q.size) {
    let u = null, best = Infinity
    for (const id of Q) {
      const d = dist.get(id)
      if (d < best) { best = d; u = id }
    }
    if (u === null) break
    Q.delete(u)
    if (u === targetId) break

    const nbrs = edges.get(u) || []
    for (const { to, w } of nbrs) {
      if (!Q.has(to)) continue
      const alt = dist.get(u) + w
      if (alt < dist.get(to)) {
        dist.set(to, alt)
        prev.set(to, u)
      }
    }
  }

  const path = []
  let cur = targetId
  if (prev.get(cur) !== null || cur === sourceId) {
    while (cur !== null) { path.unshift(cur); cur = prev.get(cur) }
  }
  return { distance: dist.get(targetId), path }
}

// ====== LECTURA Y RUTA ======
export async function computeRoute({ origin, threshold }) {
  if (!origin || typeof origin.lat !== 'number' || typeof origin.lon !== 'number') {
    throw new Error('origin {lat, lon} es requerido')
  }
  const thr = typeof threshold === 'number' ? threshold : DEFAULT_THRESHOLD

  // 1) Leer último estado de TODOS los sensores (cada doc es el último snapshot)
  const all = await getAllSensorData()

  // 2) Normalizar y filtrar por whitelist (si aplica), y por campos válidos
  const candidates = all
    .filter(s => (!DEVICE_WHITELIST.length || DEVICE_WHITELIST.includes(s.deviceId)))
    .map(s => ({
      id: s.deviceId,
      devEUI: s.devEUI || s.deviceId,
      name: s.name || s.deviceId,
      lat: typeof s.latitude === 'number' ? s.latitude : null,
      lon: typeof s.longitude === 'number' ? s.longitude : null,
      distance_cm: typeof s.distance_cm === 'number' ? s.distance_cm : null
    }))
    .filter(s => s.lat !== null && s.lon !== null && s.distance_cm !== null)

  // 3) Calcular fill_pct
  const bins = candidates.map(b => {
    const fillPct = Math.max(0, Math.min(100, (1 - (b.distance_cm / CAPACITY_CM)) * 100))
    return { ...b, fill_pct: fillPct }
  })

  // Listas ordenadas por nivel de llenado
  const byFillDescAll = [...bins].sort((a, b) => b.fill_pct - a.fill_pct)
  const device_ids_by_fill_desc = byFillDescAll.map(b => b.id)

  // 4) Elegibles por umbral
  const eligible = bins.filter(b => b.fill_pct >= (thr * 100))
  const eligible_ids_by_fill_desc = [...eligible].sort((a, b) => b.fill_pct - a.fill_pct).map(b => b.id)

  if (eligible.length === 0) {
    return {
      origin: { lat: origin.lat, lon: origin.lon },
      criteria: { threshold: thr, optimize: 'distance', round_trip: false },
      served_bins: [],
      order: ['depot'],
      distance_m: 0,
      segments: [],         // 👈 sin tramos
      legs_polyline: [],    // 👈 nuevo: array de arrays, vacía
      polyline: [],         // 👈 global vacío
      bins_status: bins.map(b => ({
        id: b.id, devEUI: b.devEUI, fill_pct: b.fill_pct, distance_cm: b.distance_cm
      })),
      device_ids_by_fill_desc,
      eligible_ids_by_fill_desc
    }
  }

  // 5) Nodos = origen + elegibles
  const start = { id: 'depot', lat: origin.lat, lon: origin.lon }
  const nodes = [start, ...eligible.map(b => ({ id: b.id, lat: b.lat, lon: b.lon }))]
  const edges = buildCompleteGraph(nodes)

  // 6) Minimizar distancia evaluando todas las permutaciones (termina en el último contenedor)
  const targets = eligible.map(b => b.id)
  const perms = permutations(targets)

  let best = null
  for (const order of perms) {
    let cur = 'depot'
    let total = 0
    const legs = []
    let ok = true

    for (const nxt of order) {
      const run = dijkstra(nodes, edges, cur, nxt)
      if (!run.path || run.path.length === 0 || !isFinite(run.distance)) { ok = false; break }
      total += run.distance
      legs.push({ from: cur, to: nxt, distance_m: run.distance, path: run.path })
      cur = nxt
    }
    if (!ok) continue
    if (!best || total < best.total) best = { total, order, legs }
  }

  // 7) Construir polyline global y segmentos explícitos
  const id2node = new Map(nodes.map(n => [n.id, n]))
  const polyline = []
  const segments = []
  const legs_polyline = []  // 👈 NUEVO: arreglo de coords por tramo (para dibujar cada polyline por separado)

  best.legs.forEach((leg, idx) => {
    // path de IDs → coords {lat, lon}
    const coords = leg.path.map(id => {
      const node = id2node.get(id)
      return { lat: node.lat, lon: node.lon }
    })

    // Garantizar al menos 2 puntos por segmento: si Dijkstra da [from,to], ya vale. Si por algo viniera 1, forzamos endpoints:
    if (coords.length < 2) {
      const fromNode = id2node.get(leg.from)
      const toNode = id2node.get(leg.to)
      coords.length = 0
      coords.push({ lat: fromNode.lat, lon: fromNode.lon })
      coords.push({ lat: toNode.lat, lon: toNode.lon })
    }

    // polyline global (concatenada)
    if (polyline.length === 0) {
      polyline.push(...coords)
    } else {
      // evita duplicar el punto de unión
      polyline.push(...coords.slice(1))
    }

    // segmento explícito (para dibujar por separado en el front)
    segments.push({
      index: idx,
      from: leg.from,
      to: leg.to,
      distance_m: leg.distance_m,
      coords
    })

    // agregar a legs_polyline
    legs_polyline.push(coords)
  })

  const served_bins = eligible
    .sort((a, b) => best.order.indexOf(a.id) - best.order.indexOf(b.id))
    .map(b => ({ id: b.id, devEUI: b.devEUI, fill_pct: b.fill_pct, distance_cm: b.distance_cm }))

  return {
    origin: { lat: origin.lat, lon: origin.lon },     // 👈 útil en el front
    criteria: { threshold: thr, optimize: 'distance', round_trip: false },
    served_bins,
    order: ['depot', ...best.order],                  // 👈 siempre empieza con depot
    distance_m: best.total,
    segments,                                         // 👈 cada tramo con coords propias
    legs_polyline,                                    // 👈 NUEVO: array de arrays (coords por tramo)
    polyline,                                         // 👈 ruta completa concatenada
    bins_status: bins.map(b => ({
      id: b.id, devEUI: b.devEUI, fill_pct: b.fill_pct, distance_cm: b.distance_cm
    })),
    device_ids_by_fill_desc,
    eligible_ids_by_fill_desc
  }
}
