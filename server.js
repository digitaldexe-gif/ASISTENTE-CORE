/**
 * =====================================================
 * server.js
 * =====================================================
 * Backend estable para OpenAI Realtime WebRTC
 * - Sirve frontend estático (/public)
 * - Crea sesión Realtime con AUDIO REAL
 * =====================================================
 */

import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Fix ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// JSON normal
app.use(express.json());

// Frontend
app.use(express.static(path.join(__dirname, "public")));
app.use("/utils", express.static(path.join(__dirname, "utils")));

// Health
app.get("/health", (_, res) => res.send("OK"));

/**
 * -------------------------------------
 * POST /session
 * -------------------------------------
 * Recibe SDP (offer) del navegador
 * Devuelve SDP (answer) desde OpenAI Realtime
 */
app.post(
  "/session",
  express.text({ type: ["application/sdp"] }),
  async (req, res) => {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).send("OPENAI_API_KEY no configurada");
      }

      const model =
        process.env.REALTIME_MODEL ||
        "gpt-4o-mini-realtime-preview";

      // ⚠️ VOZ REAL (la misma que usas en voice-config.js)
      const voice = "coral";

      // 👉 Enviar SDP DIRECTAMENTE (no FormData)
      const openaiResp = await fetch(
        `https://api.openai.com/v1/realtime?model=${model}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/sdp",
          },
          body: req.body,
        }
      );

      if (!openaiResp.ok) {
        const err = await openaiResp.text();
        console.error("❌ OpenAI Realtime error:", err);
        return res.status(500).send(err);
      }

      const answerSdp = await openaiResp.text();

      res.setHeader("Content-Type", "application/sdp");
      return res.status(200).send(answerSdp);
    } catch (err) {
      console.error("❌ Error en /session:", err);
      return res.status(500).send("Error creando sesión Realtime");
    }
  }
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server listening on port ${PORT}`);
});
