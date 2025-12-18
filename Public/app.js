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

import { VOICE_CONFIG } from "./voice-config.js";
import { getGreetingByTime } from "./utils/greeting.js";

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");

let pc;
let dataChannel;
let localStream;
let remoteAudio;

function log(msg) {
  logEl.textContent += msg + "\n";
  logEl.scrollTop = logEl.scrollHeight;
}

async function startCall() {
  startBtn.disabled = true;
  stopBtn.disabled = false;

  const greeting = getGreetingByTime();
  const systemPrompt = VOICE_CONFIG.buildSystemPrompt({ greeting });

  const sessionRes = await fetch("/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: VOICE_CONFIG.model,
      voice: VOICE_CONFIG.voice,
      instructions: systemPrompt
    })
  });

  const session = await sessionRes.json();

  pc = new RTCPeerConnection();

  remoteAudio = document.createElement("audio");
  remoteAudio.autoplay = true;
  document.body.appendChild(remoteAudio);

  pc.ontrack = (e) => {
    remoteAudio.srcObject = e.streams[0];
  };

  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

  dataChannel = pc.createDataChannel("oai-events");
  dataChannel.onopen = () => {
    log("🟢 Conectado");
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

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

  const answer = await sdpRes.text();
  await pc.setRemoteDescription({ type: "answer", sdp: answer });

  statusEl.textContent = "En llamada…";
}

function stopCall() {
  startBtn.disabled = false;
  stopBtn.disabled = true;

  pc?.close();
  localStream?.getTracks().forEach((t) => t.stop());
  remoteAudio?.remove();

  statusEl.textContent = "Listo.";
}

startBtn.onclick = startCall;
stopBtn.onclick = stopCall;
