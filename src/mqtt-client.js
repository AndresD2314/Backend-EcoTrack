import mqtt from 'mqtt'
import { saveSensorData } from './service/sensor-service.js'
import { payloadDecoder } from './payload-Decoder.js' // usa el mismo decoder JS que hicimos

// ================== CONFIG ==================
const GW_PREFIX = 'gateway/ConduitBogota' // prefijo del bridge AEP
const MQTT_URL = 'mqtt://192.168.1.3:1883'

// Mapa devEUI → nombre amigable
const REGISTRY = {
  'A8610A33383B9211': 'arduinowan1',
  'A8610A33392D6312': 'arduinowan2',
  'A8610A33392A5E0B': 'arduinowan3',
}

// ================== CONEXIÓN MQTT ==================
const client = mqtt.connect(MQTT_URL, {
  reconnectPeriod: 3000,
  connectTimeout: 10000,
})

client.on('connect', () => {
  console.log('[MQTT] ✅ Conectado a', MQTT_URL)

  const topics = [
    `${GW_PREFIX}/lora/+/up`, // uplinks descifrados
    `${GW_PREFIX}/lora/+/packet_recv`, // opcional debug
  ]

  client.subscribe(topics, { qos: 1 }, (err) => {
    if (err) console.error('[MQTT] ❌ Error al suscribirse:', err)
    else console.log(`[MQTT] 📡 Suscripción activa: ${topics.join(', ')}`)
  })
})

client.on('reconnect', () => console.log('[MQTT] 🔄 Reintentando…'))
client.on('error', (err) => console.error('[MQTT] ❌ Error MQTT:', err.message))
client.on('offline', () => console.warn('[MQTT] ⚠️ MQTT offline'))
client.on('close', () => console.warn('[MQTT] 🔌 MQTT cerrado'))

// ================== HELPERS ==================
function normalizeEui(s = '') {
  return s.replace(/-/g, '').toUpperCase()
}

function isUpTopic(topic) {
  return topic.startsWith(`${GW_PREFIX}/lora/`) && topic.endsWith('/up')
}
function isPacketRecvTopic(topic) {
  return topic.startsWith(`${GW_PREFIX}/lora/`) && topic.endsWith('/packet_recv')
}

function extractDevEUI(topic, json) {
  const candidate =
    json?.devEUI ||
    json?.endDeviceDevEUI ||
    json?.deviceEUI ||
    json?.deveui ||
    ''
  const fromJson = normalizeEui(candidate)
  if (/^[A-F0-9]{16}$/.test(fromJson)) return fromJson

  const parts = topic.split('/')
  const maybeDev = normalizeEui(parts[3] || '')
  if (/^[A-F0-9]{16}$/.test(maybeDev)) return maybeDev

  return ''
}

// ================== BASE64 DECODER ==================
function bufFromMaybeBase64(s) {
  if (!s || typeof s !== 'string') return null
  try {
    const b = Buffer.from(s.trim(), 'base64')
    return b.length ? b : null
  } catch {
    return null
  }
}

function extractRawPayloadBuffer(payload) {
  const candidates = [
    payload?.data,
    payload?.frmPayload,
    payload?.payload,
    payload?.raw,
    payload?.phyPayload,
    payload?.rx?.data,
    payload?.rx?.frmPayload,
  ]
  for (const c of candidates) {
    const b = bufFromMaybeBase64(c)
    if (b && b.length > 0) {
      console.log(`[MQTT] 📦 Payload extraído: len=${b.length} hex=${b.toString('hex')}`)
      return b
    }
  }
  return null
}

// ================== MANEJO DE MENSAJES ==================
client.on('message', async (topic, message) => {
  console.log(`\n[MQTT] 📥 Mensaje en: ${topic}`)
  console.log(`[MQTT] 📨 Bruto: ${message.toString()}`)

  if (!isUpTopic(topic)) {
    if (isPacketRecvTopic(topic)) {
      console.log('[MQTT] 🧪 packet_recv (cifrado) → solo debug.')
    } else {
      console.log('[MQTT] ⏭️  No es uplink up.')
    }
    return
  }

  try {
    const bodyTxt = message.toString()
    let payload
    try {
      payload = JSON.parse(bodyTxt)
    } catch {
      console.warn('[MQTT] ⚠️ Mensaje no-JSON en tópico up. Ignorado.')
      return
    }

    const devEUI = extractDevEUI(topic, payload)
    const name = REGISTRY[devEUI] || devEUI || 'UNKNOWN'
    console.log(`[MQTT] 🆔 DevEUI detectado: ${name}`)

    const rawBuf = extractRawPayloadBuffer(payload)
    if (!rawBuf || rawBuf.length === 0) {
      console.warn(`[UPLINK] ${name} (${devEUI}) → sin payload válido.`)
      return
    }

    // Convertir a HEX y decodificar igual que Python
    const hexPayload = rawBuf.toString('hex')
    const decoded = payloadDecoder(hexPayload)
    if (!decoded) {
      console.warn(`[UPLINK] ${name} (${devEUI}) → no decodificado.`)
      return
    }

    console.log(`[UPLINK] ✅ Decodificación OK →`, decoded)

    // Crear registro enriquecido para guardar
    const enriched = {
      received_at: new Date().toISOString(),
      topic,
      devEUI,
      name,
      rssi: payload.rssi ?? payload.rxrssi ?? payload.rx?.rssi ?? null,
      snr: payload.snr ?? payload.rxsnr ?? payload.rx?.snr ?? null,
      frequency: payload.frequency ?? payload.freq ?? payload.rx?.freq ?? null,
      decoded,
    }

    await saveSensorData(enriched)
    console.log(`[DB] ✅ Guardado: ${name} (${devEUI})`)
    console.log(`[UP] ${name} (${devEUI}) →`, decoded)
  } catch (err) {
    console.error('[MQTT] ❌ Error procesando mensaje:', err?.message || err)
  }
})

export default client
