/**
 * =====================================================
 * server.js  (MODELO BOLT CORRECTO)
 * =====================================================
 * - Sirve frontend estático
 * - Inyecta OPENAI_API_KEY en el HTML
 * - WebSocket directo desde el navegador
 * - SIN WebRTC
 * - SIN TTS
 * =====================================================
 */

import express from "express";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ES Modules fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Health check (Railway)
app.get("/health", (_, res) => res.send("OK"));

/**
 * -----------------------------------------------------
 * HTML con INYECCIÓN DE OPENAI_API_KEY
 * (CLAVE DEL MODELO BOLT)
 * -----------------------------------------------------
 */
app.get("/", (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).send("OPENAI_API_KEY missing");
  }

  const htmlPath = path.join(__dirname, "public", "index.html");
  let html = fs.readFileSync(htmlPath, "utf-8");

  // 🔴 INYECCIÓN GLOBAL (ANTES de app.js)
  html = html.replace(
    "</head>",
    `<script>
      window.OPENAI_API_KEY = "${process.env.OPENAI_API_KEY}";
    </script>
    </head>`
  );

  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

// Static assets (JS, CSS, utils…)
app.use(express.static(path.join(__dirname, "public")));
app.use("/utils", express.static(path.join(__dirname, "utils")));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server listening on port ${PORT}`);
});
