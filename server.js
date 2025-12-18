/**
 * =====================================================
 * server.js
 * =====================================================
 * Backend mínimo para:
 * - Servir frontend /public
 * - POST /session (Realtime)
 * - GET /health (Railway)
 * =====================================================
 */

import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());

// 1) Servir estáticos
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

// 2) Root -> index.html (forzado)
app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// 3) Health check
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// 4) Crear sesión Realtime
app.post("/session", async (req, res) => {
  try {
    const { model, voice, instructions } = req.body;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY no configurada" });
    }

    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, voice, instructions }),
    });

    const data = await response.json();
    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    console.error("Error creando sesión:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server listening on port ${PORT}`);
});
