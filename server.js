/**
 * =====================================================
 * server.js
 * =====================================================
 * Backend estable para Realtime WebRTC + frontend estático
 * - Sirve /public (index.html, app.js, style.css...)
 * - Sirve /utils (si lo tienes fuera de /public)
 * - Crea la conexión WebRTC con OpenAI vía /v1/realtime/calls
 * =====================================================
 */

import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Fix para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// JSON para endpoints normales
app.use(express.json());

// Static frontend
app.use(express.static(path.join(__dirname, "public")));

// Si tu carpeta utils está FUERA de /public, con esto la sirves:
app.use("/utils", express.static(path.join(__dirname, "utils")));

// Health check
app.get("/health", (req, res) => res.status(200).send("OK"));

/**
 * -------------------------------------
 * POST /session
 * -------------------------------------
 * Recibe SDP (offer) desde el navegador y devuelve SDP (answer)
 * Conecta con OpenAI Realtime WebRTC usando el API key del server.
 */
app.post(
  "/session",
  express.text({ type: ["application/sdp", "text/plain"] }),
  async (req, res) => {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).send("OPENAI_API_KEY no configurada");
      }

      // Puedes parametrizar esto por env si quieres
      const model = process.env.REALTIME_MODEL || "gpt-realtime";
      const voice = process.env.REALTIME_VOICE || "marin"; // pon aquí tu voz

      // Session config (Realtime)
      const sessionConfig = JSON.stringify({
        type: "realtime",
        model,
        audio: { output: { voice } },
      });

      // Enviar SDP + sessionConfig a OpenAI
      const fd = new FormData();
      fd.set("sdp", req.body);
      fd.set("session", sessionConfig);

      const resp = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: fd,
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error("OpenAI /realtime/calls error:", resp.status, errText);
        return res.status(500).send(errText);
      }

      const answerSdp = await resp.text();
      res.setHeader("Content-Type", "application/sdp");
      return res.status(200).send(answerSdp);
    } catch (error) {
      console.error("Error en /session:", error);
      return res.status(500).send(error?.message || "Error creando sesión");
    }
  }
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server listening on port ${PORT}`);
});

