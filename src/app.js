import express from 'express'
import morgan from 'morgan'
import authRoutes from './routes/auth.router.js'
import sensorRoutes from './routes/sensor.router.js'
import routeRoutes from './routes/route.router.js'
import './mqtt-client.js'
const app = express()

app.use(morgan('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/sensors', sensorRoutes) // Corrige falta de "/" al principio
app.use('/api/v1/route', routeRoutes)

export default app
