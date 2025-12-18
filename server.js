/**
 * =====================================================
 * server.js  (MODELO BOLT)
 * =====================================================
 * - Sirve frontend estático
 * - Inyecta OPENAI_API_KEY al navegador
 * - NO WebRTC
 * - NO TTS
 * =====================================================
 */

import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ES Modules fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Static frontend
app.use(express.static(path.join(__dirname, "public")));
app.use("/utils", express.static(path.join(__dirname, "utils")));

// Health check (Railway)
app.get("/health", (_, res) => res.send("OK"));

/**
 * -----------------------------------------------------
 * GET /config
 * Entrega configuración mínima al frontend
 * (MODELO BOLT)
 * -----------------------------------------------------
 */
app.get("/config", (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY missing" });
  }

  res.json({
    openaiKey: process.env.OPENAI_API_KEY
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server listening on port ${PORT}`);
});
