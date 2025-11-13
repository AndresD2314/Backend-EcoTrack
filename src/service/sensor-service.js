// service/sensor-service.js
import db from '../server.js'
import SensorData from '../models/sensor.model.js'

export const saveSensorData = async (rawData) => {
  try {
    // 👇 Forzar que el ID del doc sea el nombre amigable del REGISTRY
    const deviceId = rawData?.name || rawData?.deviceId || rawData?.devEUI
    if (!deviceId) throw new Error('Falta name/devEUI para construir deviceId')

    const sensor = new SensorData({ ...rawData, deviceId })
    console.log(`[SERVICE] Datos recibidos para ${sensor.deviceId}:`, sensor)

    // Generar el payload que se va a persistir
    const firestoreData = sensor.toFirestoreFormat()

    // === REGLA: preservar la lat/long previa ===
    // - Si lat y long llegan exactamente 0 y 0 ⇒ NO actualizar ninguna.
    // - Si alguna llega null/undefined ⇒ NO actualizar esa en particular.
    const bothZero =
      firestoreData.latitude === 0 &&
      firestoreData.longitude === 0

    // Si ambas son cero, eliminamos ambas del update para que merge conserve las previas
    if (bothZero) {
      delete firestoreData.latitude
      delete firestoreData.longitude
    } else {
      // Si vienen nulas/indefinidas, no las enviamos (para no pisar valores previos)
      if (firestoreData.latitude == null) delete firestoreData.latitude
      if (firestoreData.longitude == null) delete firestoreData.longitude
    }

    // (Opcional) también evita sobreescribir con null otros campos numéricos
    if (firestoreData.distance_cm == null) delete firestoreData.distance_cm
    if (firestoreData.temperature_c == null) delete firestoreData.temperature_c
    if (firestoreData.humidity_pct == null) delete firestoreData.humidity_pct

    // 👉 Guardar/mergear sin los campos eliminados
    await db.collection('sensors').doc(sensor.deviceId).set(firestoreData, { merge: true })

    console.log(`[SERVICE] Datos guardados para ${sensor.deviceId}`)
    return { success: true }
  } catch (error) {
    console.error('[SERVICE] Error al guardar datos del sensor:', error.message)
    throw error
  }
}

export const getSensorDataById = async (id) => {
    console.log(`[SERVICE] Buscando datos para el sensor ${id}`)

  if (!id || typeof id !== 'string') {
    throw new Error('Invalid sensor id')
  }
  const doc = await db.collection('sensors').doc(id).get()
  if (!doc.exists) throw new Error(`No se encontraron datos para ${id}`)
  return { deviceId: doc.id, ...doc.data() }
}


export const getAllSensorData = async () => {
  const snapshot = await db.collection('sensors').get()
  return snapshot.docs.map(doc => ({ deviceId: doc.id, ...doc.data() }))
}

export const getSensorDataByDocId = async (docId) => {
  if (!docId || typeof docId !== 'string') throw new Error('Invalid document id')
  const doc = await db.collection('sensors').doc(docId).get()
  if (!doc.exists) throw new Error(`No se encontraron datos para ${docId}`)
  return { deviceId: doc.id, ...doc.data() }
}

export const getSensorDataByDevEUI = async (devEUI) => {
  if (!devEUI || typeof devEUI !== 'string') throw new Error('Invalid devEUI')
  // Busca por el campo "devEUI" almacenado en cada doc
  const snap = await db.collection('sensors')
    .where('devEUI', '==', devEUI)
    .limit(1)
    .get()

  if (snap.empty) throw new Error(`No se encontraron datos para devEUI ${devEUI}`)
  const doc = snap.docs[0]
  return { deviceId: doc.id, ...doc.data() }
}