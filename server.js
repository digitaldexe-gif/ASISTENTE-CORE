/**
 * =====================================================
 * server.js
 * BACKEND ESTABLE PARA RAILWAY
 * =====================================================
 */

import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import path from "path";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 👉 Railway ejecuta desde /app
const PUBLIC_DIR = path.join(process.cwd(), "public");

// ---------- MIDDLEWARES ----------
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// ---------- HEALTH CHECK ----------
app.get("/health", (_req, res) => {
  res.status(200).send("OK");
});

// ---------- FRONTEND ROOT ----------
app.get("/", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// ---------- REALTIME SESSION ----------
app.post("/session", async (req, res) => {
  try {
    const { model, voice, instructions } = req.body;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY no configurada en Railway",
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
  } catch (err) {
    console.error("Error creando sesión:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- START SERVER ----------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server listening on port ${PORT}`);
});
