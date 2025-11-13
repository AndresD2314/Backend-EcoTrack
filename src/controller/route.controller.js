// controller/route.controller.js
import { computeRoute } from '../service/route-service.js'

export const calculateRoute = async (req, res) => {

  console.log('[ROUTE] calculateRoute called', req.body)
  try {
    const { origin, threshold } = req.body || {}
    const data = await computeRoute({ origin, threshold })
    return res.json(data)
  } catch (error) {
    console.error('[ROUTE] error:', error)
    return res.status(400).json({ error: error?.message || 'route error' })
  }
}
