/**
 * =====================================================
 * server.js
 * =====================================================
 * BACKEND MÍNIMO Y ESTABLE DEL ASISTENTE
 *
 * RESPONSABILIDADES:
 * - Servir el frontend (carpeta /public)
 * - Generar sesiones efímeras Realtime (client_secret)
 * - Proteger la API Key (nunca va al navegador)
 *
 * NO HACE:
 * - Lógica de negocio
 * - Tablas
 * - Endpoints de agenda
 *
 * Este archivo es válido tanto para:
 * - DEV (navegador)
 * - PROD (telefonía, más adelante)
 *
 * Importancia: ALTA
 */

import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

/**
 * POST /session
 * -----------------------------------------------------
 * Crea una sesión Realtime segura y devuelve un
 * client_secret efímero para el navegador.
 *
 * Importancia: CRÍTICA
 * Sin esto, expondrías la API Key.
 */
app.post("/session", async (req, res) => {
  try {
    const { model, voice, instructions } = req.body;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY no configurada" });
    }

    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          voice,
          instructions
        })
      }
    );

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server activo en http://localhost:${PORT}`);
});
