import { Router } from 'express'
import { getAllSensorData, getSensorDataById } from '../controller/sensor.controller.js'

const router = Router()

router.get('/getSensorsData', getAllSensorData)
router.get('/getSensorData/:idOrEui', getSensorDataById)
export default router  