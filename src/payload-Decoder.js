// ======================================================
// 🧩 Decodificador de Payload LoRa binario (10 bytes)
// Autor: Andres Duarte
// ======================================================

export function payloadDecoder(hexStr) {
  try {
    // Convertir HEX a Buffer
    const data = Buffer.from(hexStr, "hex");
    if (data.length !== 10) {
      throw new Error(`El payload debe tener 10 bytes, tiene ${data.length}`);
    }

    // Decodificar según el formato binario (big endian)
    const dist = data.readUInt16BE(0) / 10.0;   // [0-1] distancia (uint16)
    const temp = data.readInt16BE(2) / 10.0;    // [2-3] temperatura (int16)
    const hum  = data.readUInt16BE(4) / 10.0;   // [4-5] humedad (uint16)
    const lat  = data.readInt16BE(6) / 100.0;   // [6-7] latitud (int16)
    const lon  = data.readInt16BE(8) / 100.0;   // [8-9] longitud (int16)

    console.log("📦 Payload en HEX :", hexStr);
    console.log(`📏 Distancia : ${dist.toFixed(1)} cm`);
    console.log(`🌡️ Temperatura: ${temp.toFixed(1)} °C`);
    console.log(`💧 Humedad   : ${hum.toFixed(1)} %`);
    console.log(`📍 Latitud   : ${lat.toFixed(2)}°`);
    console.log(`📍 Longitud  : ${lon.toFixed(2)}°`);

    // Retornar resultado
    return {
      distance_cm: dist,
      temperature_C: temp,
      humidity_pct: hum,
      latitude_deg: lat,
      longitude_deg: lon,
    };

  } catch (e) {
    console.error("❌ Error al decodificar:", e.message);
    return null;
  }
}

