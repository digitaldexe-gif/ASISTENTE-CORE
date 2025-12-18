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
 * - GARANTIZA que el audio remoto SUENE
 *
 * Importancia: CRÍTICA
 */

console.log("app.js cargado");

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
let audioContext; // 🔥 CLAVE

function log(msg) {
  const time = new Date().toLocaleTimeString();
  logEl.textContent += `[${time}] ${msg}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

async function startCall() {
  try {
    startBtn.disabled = true;
    stopBtn.disabled = false;

    log("📞 Llamar pulsado");

    // 🔓 DESBLOQUEAR AUDIO (OBLIGATORIO EN NAVEGADORES)
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") {
      await audioContext.resume();
      log("🔓 AudioContext reanudado");
    }

    const greeting = getGreetingByTime();
    const systemPrompt = VOICE_CONFIG.buildSystemPrompt({ greeting });

    log("🧠 Creando sesión Realtime...");

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
    log("✅ Sesión creada correctamente");

    pc = new RTCPeerConnection();

    // 🎧 AUDIO REMOTO
    remoteAudio = document.createElement("audio");
    remoteAudio.autoplay = true;
    remoteAudio.muted = false;
    remoteAudio.volume = 1.0;
    remoteAudio.setAttribute("playsinline", "");
    document.body.appendChild(remoteAudio);

    pc.ontrack = (e) => {
      log("🔊 Audio remoto recibido");

      const stream = e.streams[0];
      remoteAudio.srcObject = stream;

      // 🔥 FORZAR SALIDA DE AUDIO
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(audioContext.destination);

      remoteAudio.play().catch(err => {
        console.warn("⚠️ Play bloqueado:", err);
      });
    };

    // 🎤 MICRÓFONO
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
    log("🎤 Micrófono capturado");

    // 📡 DATA CHANNEL
    dataChannel = pc.createDataChannel("oai-events");
    dataChannel.onopen = () => {
      log("📡 DataChannel abierto");
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    log("📤 Enviando SDP a OpenAI...");

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
    log("🟢 Llamada establecida");
  } catch (err) {
    console.error(err);
    log("❌ Error en la llamada");
    statusEl.textContent = "Error";
    stopCall();
  }
}

function stopCall() {
  log("🔴 Colgar pulsado");

  startBtn.disabled = false;
  stopBtn.disabled = true;

  pc?.close();
  pc = null;

  localStream?.getTracks().forEach((t) => t.stop());
  localStream = null;

  remoteAudio?.remove();
  remoteAudio = null;

  audioContext?.close();
  audioContext = null;

  statusEl.textContent = "Listo.";
  log("🛑 Llamada finalizada");
}

startBtn.onclick = startCall;
stopBtn.onclick = stopCall;
