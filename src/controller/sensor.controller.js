import {
  getAllSensorData as getAllSensorDataFromService,
  getSensorDataByDocId,
  getSensorDataByDevEUI
} from '../service/sensor-service.js'


    
const normalizeDevEUI = (s = '') =>
  s.replace(/-/g, '').trim().toUpperCase()

const isHex16 = (s = '') => /^[A-F0-9]{16}$/.test(s)

export const getAllSensorData = async (req, res) => {
  try {
    const data = await getAllSensorDataFromService()
    return res.status(200).json(data)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

// export const getSensorDataById = async (req, res) => {
//   const { deviceId } = req.params
//   try {
//     const data = await getSensorDataByIdFromService(deviceId)
//     return res.status(200).json(data)
//   } catch (error) {
//     return res.status(404).json({ message: error.message })
//   }
// }

export const getSensorDataById = async (req, res) => {
  try {
    const raw = (req.params?.idOrEui || '').trim()
    if (!raw) return res.status(400).json({ message: 'Missing idOrEui in URL' })

    const maybeEui = normalizeDevEUI(raw)
    let data

    if (isHex16(maybeEui)) {
      console.log(`[SENSORS] lookup by devEUI: ${maybeEui}`)
      data = await getSensorDataByDevEUI(maybeEui)
    } else {
      console.log(`[SENSORS] lookup by docId: ${raw}`)
      data = await getSensorDataByDocId(raw)
    }

    return res.status(200).json(data)
  } catch (error) {
    console.error('[SENSORS] error:', error)
    const code = /No se encontraron datos|not found/i.test(error.message) ? 404 : 500
    return res.status(code).json({ message: error.message })
  }
}