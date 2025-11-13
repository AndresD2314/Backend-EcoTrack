// models/sensor.model.js
class SensorData {
  constructor({
    devEUI,
    deviceId,
    name,          // 👈 nuevo: nombre amigable del REGISTRY
    rssi,
    snr,
    fPort,
    received_at,
    payload_hex,
    decoded = {}
  }) {
    const num = (v) => (typeof v === 'number' && Number.isFinite(v)) ? v : null;

    // Identidad
    this.devEUI = (devEUI || '').toUpperCase() || null;
    this.name   = name || null;                  // 👈 lo guardamos también
    this.deviceId = deviceId || this.name || this.devEUI;

    if (!this.deviceId) throw new Error('deviceId/devEUI es obligatorio');

    // Datos del payload decodificado (formato bin10_v1)
    this.distance_cm   = num(decoded.distance_cm);
    this.temperature_c = num(decoded.temperature_C);
    this.humidity_pct  = num(decoded.humidity_pct);
    this.latitude      = num(decoded.latitude_deg);
    this.longitude     = num(decoded.longitude_deg);

    // Señal y radio
    this.signal = {
      rssi: num(rssi),
      snr:  num(snr),
    };
    this.radio = {
      fPort: fPort ?? null,
    };

    // Tiempos
    this.timestamp = received_at || new Date().toISOString();

    // Guarda el payload original si lo deseas
    this.payload_hex = payload_hex || null;
  }

  toFirestoreFormat() {
    return {
      deviceId: this.deviceId,   // p.ej. "arduinowan1"
      name: this.name,           // p.ej. "arduinowan1" (para consultas rápidas)
      devEUI: this.devEUI,       // p.ej. "A8610A33383B9211"
      distance_cm: this.distance_cm,
      temperature_c: this.temperature_c,
      humidity_pct: this.humidity_pct,
      latitude: this.latitude,
      longitude: this.longitude,
      signal: this.signal,
      radio: this.radio,
      timestamp: this.timestamp,
      payload_hex: this.payload_hex,
    };
  }
}

export default SensorData;
