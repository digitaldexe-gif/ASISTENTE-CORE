/**
 * =====================================================
 * server.js
 * =====================================================
 * BACKEND MÍNIMO Y ESTABLE DEL ASISTENTE
 *
 * Compatible con:
 * - DEV (navegador)
 * - PROD (Railway / telefonía)
 *
 * Importancia: CRÍTICA
 * =====================================================
 */

import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Fix para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/**
 * -------------------------------------
 * HEALTH CHECK (Railway)
 * -------------------------------------
 */
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

/**
 * -------------------------------------
 * POST /session
 * -------------------------------------
 * Crea una sesión Realtime segura
 * Devuelve client_secret al navegador
 */
app.post("/session", async (req, res) => {
  try {
    const { model, voice, instructions } = req.body;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY no configurada",
      });
    }

    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          voice,
          instructions,
        }),
      }
    );

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error creando sesión:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * -------------------------------------
 * START SERVER (Railway compatible)
 * -------------------------------------
 */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server listening on port ${PORT}`);
});
