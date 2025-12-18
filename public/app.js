/**
 * =====================================================
 * app.js  (DIAGNÓSTICO FORENSE – MODELO BOLT)
 * =====================================================
 * - WebSocket directo a OpenAI Realtime
 * - Audio PCM16 reproducido con AudioContext
 * - LOG EXTENDIDO ABSOLUTO
 * - Objetivo: VER SI OPENAI ENVÍA AUDIO O NO
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
  const audioBuffer = audioCtx.createBuffer(
    1,
    pcm16.length,
    24000
  );

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
    log("🔇 Cola de audio vacía");
    return;
  }

  isPlaying = true;
  const buffer = audioQueue.shift();
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.start();

  source.onended = () => {
    log("🔁 Fragmento de audio terminado");
    playQueue();
  };
}

/* =========================
   START CALL
========================= */
async function startCall() {
  startBtn.disabled = true;
  stopBtn.disabled = false;
  statusEl.textContent = "Conectando…";

  log("📞 Llamar pulsado");

  /* 🔴 PASO CRÍTICO ANTES DEL WS (CAMBIO PEDIDO) */
  audioCtx = new AudioContext({ sampleRate: 24000 });
  await audioCtx.resume();
  log("🎧 AudioContext creado y resumido", {
    state: audioCtx.state,
    sampleRate: audioCtx.sampleRate
  });

  if (!window.OPENAI_API_KEY) {
    log("❌ OPENAI_API_KEY NO INYECTADA EN FRONTEND");
    statusEl.textContent = "Error API KEY";
    return;
  }

  log("🔑 OPENAI_API_KEY presente (no se muestra)");

  const greeting = getGreetingByTime();
  const systemPrompt = VOICE_CONFIG.buildSystemPrompt({ greeting });

  log("🧠 System prompt generado", systemPrompt);

  /* =========================
     WEBSOCKET
  ========================= */
  const wsUrl = `wss://api.openai.com/v1/realtime?model=${VOICE_CONFIG.model}`;
  log("🌐 Abriendo WebSocket", wsUrl);

  ws = new WebSocket(wsUrl, {
    headers: {
      Authorization: `Bearer ${window.OPENAI_API_KEY}`,
      "OpenAI-Beta": "realtime=v1"
    }
  });

  ws.onopen = () => {
    log("🟢 WebSocket OPEN");

    /* SESSION.UPDATE */
    const sessionUpdate = {
      type: "session.update",
      session: {
        modalities: ["audio", "text"],
        voice: VOICE_CONFIG.voice,
        instructions: systemPrompt,
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        turn_detection: { type: "server_vad" }
      }
    };

    log("📤 Enviando session.update", sessionUpdate);
    ws.send(JSON.stringify(sessionUpdate));

    /* RESPONSE.CREATE (SALUDO) */
    const responseCreate = {
      type: "response.create",
      response: {
        modalities: ["audio", "text"],
        instructions:
          `${greeting}, ${VOICE_CONFIG.clinicName}, le atiende ${VOICE_CONFIG.assistantName}.`
      }
    };

    log("📤 Enviando response.create (saludo)", responseCreate);
    ws.send(JSON.stringify(responseCreate));

    statusEl.textContent = "En llamada…";
  };

  ws.onmessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      log("❌ Mensaje NO JSON recibido", event.data);
      return;
    }

    log("📩 EVENTO RECIBIDO", msg);

    if (msg.type === "response.audio.delta") {
      log("🎵 AUDIO DELTA RECIBIDO (base64 length)", msg.delta?.length);
      playPCM16(msg.delta);
    }

    if (msg.type === "response.done") {
      log("✅ response.done");
    }

    if (msg.type === "error") {
      log("❌ ERROR OPENAI", msg.error);
    }
  };

  ws.onerror = (e) => {
    log("❌ WebSocket ERROR", e);
  };

  ws.onclose = (e) => {
    log("🔴 WebSocket CLOSED", e);
  };
}

/* =========================
   STOP CALL
========================= */
function stopCall() {
  log("🛑 Colgar pulsado");

  startBtn.disabled = false;
  stopBtn.disabled = true;

  try { ws?.close(); } catch {}
  try { audioCtx?.close(); } catch {}

  ws = null;
  audioCtx = null;
  audioQueue = [];
  isPlaying = false;

  statusEl.textContent = "Listo.";
}

startBtn.onclick = startCall;
stopBtn.onclick = stopCall;
