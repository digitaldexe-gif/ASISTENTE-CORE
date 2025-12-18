/**
 * =====================================================
 * app.js
 * =====================================================
 * Frontend WebRTC para OpenAI Realtime (audio real)
 * - Captura micrófono
 * - Reproduce audio del asistente
 * - Fuerza saludo hablado al iniciar llamada
 * =====================================================
 */

import { VOICE_CONFIG } from "./voice-config.js";
import { getGreetingByTime } from "./utils/greeting.js";

console.log("app.js cargado");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");

let pc;
let dc;
let localStream;
let remoteAudio;

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

    // ===== 1) RTCPeerConnection =====
    pc = new RTCPeerConnection();

    // ===== 2) Audio remoto =====
    remoteAudio = document.createElement("audio");
    remoteAudio.autoplay = true;
    remoteAudio.playsInline = true;
    remoteAudio.volume = 1;
    document.body.appendChild(remoteAudio);

    pc.ontrack = async (e) => {
      log("🔊 Audio remoto recibido");
      remoteAudio.srcObject = e.streams[0];
      try {
        await remoteAudio.play();
        log("✅ remoteAudio.play() OK");
      } catch (err) {
        log("⚠️ play() bloqueado: " + err.message);
      }
    };

    // ===== 3) Micrófono =====
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
    log("🎤 Micrófono capturado");

    // ===== 4) DataChannel =====
    dc = pc.createDataChannel("oai-events");

    dc.onopen = () => {
      log("🟢 DataChannel abierto");

      const greeting = getGreetingByTime();
      const systemPrompt = VOICE_CONFIG.buildSystemPrompt({ greeting });

      // A) Actualizar sesión con instrucciones
      sendEvent({
        type: "session.update",
        session: {
          instructions: systemPrompt
        }
      });

      // B) Forzar que el asistente HABLE primero
      sendEvent({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Inicia la llamada saludando con: "${greeting}".`
            }
          ]
        }
      });

      // C) Crear respuesta en AUDIO (CLAVE)
      sendEvent({
        type: "response.create",
        response: {
          output_modalities: ["audio", "text"],
          max_output_tokens: 150
        }
      });

      log("📢 Saludo solicitado al asistente (AUDIO)");
    };

    dc.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.type) {
          log(`📩 Event: ${data.type}`);
        }
      } catch {}
    };

    // ===== 5) SDP =====
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    log("📡 Enviando SDP a /session");
    const sdpRes = await fetch("/session", {
      method: "POST",
      headers: { "Content-Type": "application/sdp" },
      body: offer.sdp
    });

    if (!sdpRes.ok) {
      throw new Error(await sdpRes.text());
    }

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

  localStream?.getTracks().forEach((t) => t.stop());

  if (remoteAudio) {
    remoteAudio.srcObject = null;
    remoteAudio.remove();
  }

  pc = null;
  dc = null;
  localStream = null;
  remoteAudio = null;

  statusEl.textContent = "Listo.";
  log("🔴 Llamada finalizada");
}

startBtn.onclick = startCall;
stopBtn.onclick = stopCall;
