/**
 * =====================================================
 * app.js  (DIAGNÓSTICO FORENSE – MODELO BOLT)
 * =====================================================
 * - WebSocket directo a OpenAI Realtime
 * - Audio PCM16 reproducido con AudioContext
 * - LOG EXTENDIDO ABSOLUTO
 * =====================================================
 */

import { VOICE_CONFIG } from "./voice-config.js";
import { getGreetingByTime } from "./utils/greeting.js";

console.log("✅ app.js cargado (modo diagnóstico)");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");

let ws = null;
let audioCtx = null;
let audioQueue = [];
let isPlaying = false;
let audioReceived = false;

/* =========================
   LOG UTIL
========================= */
function log(msg, data) {
  const line =
    `[${new Date().toLocaleTimeString()}] ${msg}` +
    (data ? "\n" + JSON.stringify(data, null, 2) : "");
  logEl.textContent += line + "\n";
  logEl.scrollTop = logEl.scrollHeight;
  console.log(msg, data ?? "");
}

/* =========================
   AUDIO PCM16 → AUDIOCONTEXT
========================= */
function playPCM16(base64Audio) {
  audioReceived = true;
  log("🔊 playPCM16() llamado");

  if (!audioCtx) {
    log("❌ audioCtx NO existe");
    return;
  }

  const binary = atob(base64Audio);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);

  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }

  const pcm16 = new Int16Array(buffer);
  const audioBuffer = audioCtx.createBuffer(1, pcm16.length, 24000);

  const channel = audioBuffer.getChannelData(0);
  for (let i = 0; i < pcm16.length; i++) {
    channel[i] = pcm16[i] / 32768;
  }

  audioQueue.push(audioBuffer);
  if (!isPlaying) playQueue();
}

function playQueue() {
  if (audioQueue.length === 0) {
    isPlaying = false;
    return;
  }

  isPlaying = true;
  const buffer = audioQueue.shift();
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.start();
  source.onended = playQueue;
}

/* =========================
   START CALL
========================= */
async function startCall() {
  startBtn.disabled = true;
  stopBtn.disabled = false;
  statusEl.textContent = "Conectando…";

  log("📞 Llamar pulsado");

  audioCtx = new AudioContext({ sampleRate: 24000 });
  await audioCtx.resume();
  log("🎧 AudioContext activo", audioCtx.state);

  if (!window.OPENAI_API_KEY) {
    log("❌ OPENAI_API_KEY NO INYECTADA");
    return;
  }

  const greeting = getGreetingByTime();
  const systemPrompt = VOICE_CONFIG.buildSystemPrompt({ greeting });

  ws = new WebSocket(
    `wss://api.openai.com/v1/realtime?model=${VOICE_CONFIG.model}`,
    {
      headers: {
        Authorization: `Bearer ${window.OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1"
      }
    }
  );

  ws.onopen = () => {
    log("🟢 WebSocket OPEN");

    ws.send(JSON.stringify({
      type: "session.update",
      session: {
        modalities: ["audio", "text"],
        voice: VOICE_CONFIG.voice,
        instructions: systemPrompt,
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        turn_detection: { type: "server_vad" }
      }
    }));

    ws.send(JSON.stringify({
      type: "response.create",
      response: {
        modalities: ["audio", "text"],
        instructions:
          `Di exactamente: "${greeting}, ${VOICE_CONFIG.clinicName}, le atiende ${VOICE_CONFIG.assistantName}."`
      }
    }));

    statusEl.textContent = "En llamada…";

    // Watchdog
    setTimeout(() => {
      if (!audioReceived) {
        log("⚠️ DIAGNÓSTICO: OpenAI NO ha enviado audio");
      }
    }, 4000);
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    log("📩 EVENTO", msg);

    if (msg.type === "response.audio.delta") {
      log("🎵 AUDIO DELTA RECIBIDO", msg.delta?.length);
      playPCM16(msg.delta);
    }

    if (msg.type === "error") {
      log("❌ ERROR OPENAI", msg.error);
    }
  };
}

/* =========================
   STOP CALL
========================= */
function stopCall() {
  log("🛑 Colgar pulsado");

  try { ws?.close(); } catch {}
  try { audioCtx?.close(); } catch {}

  ws = null;
  audioCtx = null;
  audioQueue = [];
  isPlaying = false;
  audioReceived = false;

  startBtn.disabled = false;
  stopBtn.disabled = true;
  statusEl.textContent = "Listo.";
}

startBtn.onclick = startCall;
stopBtn.onclick = stopCall;
