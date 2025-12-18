/**
 * =====================================================
 * app.js
 * =====================================================
 * Frontend WebRTC para pruebas del asistente.
 *
 * Responsabilidades:
 * - Captura audio del micrófono
 * - Conecta con OpenAI Realtime
 * - Inyecta contexto conversacional
 * - Garantiza que el saludo SIEMPRE suene
 *
 * Importancia: ALTA
 */

console.log("✅ app.js cargado");

import { VOICE_CONFIG } from "./voice-config.js";
import { getGreetingByTime } from "./utils/greeting.js";

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");

let pc = null;
let dataChannel = null;
let localStream = null;
let remoteAudio = null;

function log(msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logEl.textContent += line + "\n";
  logEl.scrollTop = logEl.scrollHeight;
  console.log(line);
}

async function startCall() {
  try {
    log("▶️ Llamar pulsado");

    startBtn.disabled = true;
    stopBtn.disabled = false;
    statusEl.innerHTML = "<strong>Estado:</strong> Conectando…";

    const greeting = getGreetingByTime();
    const systemPrompt = VOICE_CONFIG.buildSystemPrompt({ greeting });

    log("📡 Creando sesión Realtime…");

    const sessionRes = await fetch("/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: VOICE_CONFIG.model,
        voice: VOICE_CONFIG.voice,
        instructions: systemPrompt
      })
    });

    if (!sessionRes.ok) {
      throw new Error("Error creando sesión Realtime");
    }

    const session = await sessionRes.json();
    log("🔑 Sesión creada correctamente");

    pc = new RTCPeerConnection();

    remoteAudio = document.createElement("audio");
    remoteAudio.autoplay = true;
    document.body.appendChild(remoteAudio);

    pc.ontrack = (e) => {
      log("🔊 Audio remoto recibido");
      remoteAudio.srcObject = e.streams[0];
    };

    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
    log("🎙️ Micrófono capturado");

    dataChannel = pc.createDataChannel("oai-events");
    dataChannel.onopen = () => log("🟢 DataChannel abierto");
    dataChannel.onerror = (e) => log("❌ DataChannel error");

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    log("📨 Enviando SDP a OpenAI…");

    const sdpRes = await fetch(
      `https://api.openai.com/v1/realtime?model=${VOICE_CONFIG.model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.client_secret.value}`,
          "Content-Type": "application/sdp"
        },
        body: offer.sdp
      }
    );

    if (!sdpRes.ok) {
      throw new Error("Error intercambiando SDP con OpenAI");
    }

    const answer = await sdpRes.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answer });

    statusEl.innerHTML = "<strong>Estado:</strong> En llamada…";
    log("✅ Llamada establecida");
  } catch (err) {
    log("❌ ERROR: " + err.message);
    stopCall();
  }
}

function stopCall() {
  log("⛔ Colgar pulsado");

  startBtn.disabled = false;
  stopBtn.disabled = true;

  if (pc) {
    pc.close();
    pc = null;
  }

  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }

  if (remoteAudio) {
    remoteAudio.remove();
    remoteAudio = null;
  }

  statusEl.innerHTML = "<strong>Estado:</strong> Listo.";
  log("🔴 Llamada finalizada");
}

startBtn.addEventListener("click", startCall);
stopBtn.addEventListener("click", stopCall);
