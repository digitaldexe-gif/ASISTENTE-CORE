/**
 * =====================================================
 * server.js
 * =====================================================
 * Backend estable para OpenAI Realtime WebRTC
 * =====================================================
 */

import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ES modules fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Static frontend
app.use(express.static(path.join(__dirname, "public")));
app.use("/utils", express.static(path.join(__dirname, "utils")));

// Health
app.get("/health", (_, res) => res.send("OK"));

/**
 * POST /session
 * Recibe SDP (offer)
 * Devuelve SDP (answer)
 */
app.post(
  "/session",
  express.text({ type: ["application/sdp"] }),
  async (req, res) => {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).send("OPENAI_API_KEY missing");
      }

      const model = "gpt-4o-mini-realtime-preview";

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
        const errText = await openaiResp.text();
        console.error("OpenAI error:", errText);
        return res.status(500).send(errText);
      }

      const answerSdp = await openaiResp.text();

      // 🔎 DEBUG CRÍTICO
      if (!answerSdp.startsWith("v=")) {
        console.error("❌ OpenAI did NOT return SDP:");
        console.error(answerSdp.slice(0, 200));
        return res.status(500).send("Invalid SDP from OpenAI");
      }

      res.setHeader("Content-Type", "application/sdp");
      return res.send(answerSdp);
    } catch (err) {
      console.error("Server /session error:", err);
      res.status(500).send("Server error");
    }
  }
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server listening on ${PORT}`);
});
