// routes/route.router.js
import { Router } from 'express'
import { calculateRoute } from '../controller/route.controller.js'

const router = Router()

// POST /api/route
router.post('/calculateRoute', calculateRoute)

export default router
