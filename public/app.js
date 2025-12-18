/**
 * =====================================================
 * app.js
 * =====================================================
 * Frontend WebRTC para OpenAI Realtime
 * - NO define audio
 * - SOLO envía instrucciones
 * =====================================================
 */

import { VOICE_CONFIG } from "./voice-config.js";
import { getGreetingByTime } from "./utils/greeting.js";

console.log("app.js cargado");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");

let pc = null;
let dc = null;
let localStream = null;
let remoteAudio = null;

function log(msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logEl.textContent += line + "\n";
  logEl.scrollTop = logEl.scrollHeight;
  console.log(line);
}

function sendEvent(payload) {
  if (dc && dc.readyState === "open") {
    dc.send(JSON.stringify(payload));
  }
}

async function startCall() {
  try {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    statusEl.textContent = "Conectando…";

    log("📞 Llamar pulsado");

    pc = new RTCPeerConnection();

    // Audio remoto
    remoteAudio = document.createElement("audio");
    remoteAudio.autoplay = true;
    remoteAudio.playsInline = true;
    remoteAudio.volume = 1;
    document.body.appendChild(remoteAudio);

    pc.ontrack = async (e) => {
      log("🔊 Track de audio recibido");
      remoteAudio.srcObject = e.streams[0];
      await remoteAudio.play().catch(() => {});
    };

    // Micrófono
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
    log("🎤 Micrófono capturado");

    // DataChannel
    dc = pc.createDataChannel("oai-events");

    dc.onopen = () => {
      log("🟢 DataChannel abierto");

      const greeting = getGreetingByTime();
      const systemPrompt = VOICE_CONFIG.buildSystemPrompt({ greeting });

      // SOLO instrucciones
      sendEvent({
        type: "session.update",
        session: {
          instructions: systemPrompt
        }
      });

      // Orden de saludo
      sendEvent({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Di exactamente: "${greeting}, ${VOICE_CONFIG.clinicName}, le atiende ${VOICE_CONFIG.assistantName}."`
            }
          ]
        }
      });

      // Solicitar respuesta (sin modalities)
      sendEvent({
        type: "response.create"
      });

      log("📢 Saludo solicitado");
    };

    // SDP
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const sdpRes = await fetch("/session", {
      method: "POST",
      headers: { "Content-Type": "application/sdp" },
      body: offer.sdp
    });

    const answerSdp = await sdpRes.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

    statusEl.textContent = "En llamada…";
    log("✅ Llamada establecida");
  } catch (err) {
    log("❌ Error: " + err.message);
    stopCall();
  }
}

function stopCall() {
  log("🛑 Colgar pulsado");

  startBtn.disabled = false;
  stopBtn.disabled = true;

  try { dc?.close(); } catch {}
  try { pc?.close(); } catch {}

  localStream?.getTracks().forEach(t => t.stop());
  remoteAudio?.remove();

  pc = dc = localStream = remoteAudio = null;
  statusEl.textContent = "Listo.";
  log("🔴 Llamada finalizada");
}

startBtn.onclick = startCall;
stopBtn.onclick = stopCall;
