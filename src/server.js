import app from './app.js'
import admin from "firebase-admin"
import { readFileSync } from 'fs'

const credentials = JSON.parse(readFileSync("./serviceAccountKey.json"))

admin.initializeApp({
  credential: admin.credential.cert(credentials)
})

const PORT = process.env.PORT || 3000

const db = admin.firestore()

// Corrección: escuchar en 0.0.0.0 para aceptar conexiones externas
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://192.168.1.3:${PORT}`)
})

export default db
