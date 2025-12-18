/**
 * =====================================================
 * app.js
 * =====================================================
 * Frontend WebRTC para pruebas del asistente.
 * - Captura audio del micrófono
 * - Conecta con OpenAI Realtime (vía tu backend /session)
 * - Envía eventos por DataChannel para que el asistente HABLE
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

function sendEvent(obj) {
  if (!dc || dc.readyState !== "open") return;
  dc.send(JSON.stringify(obj));
}

async function startCall() {
  try {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    statusEl.textContent = "Conectando…";

    log("📞 Llamar pulsado");

    // 1) PeerConnection
    pc = new RTCPeerConnection();

    // 2) Audio remoto (IMPORTANTE: play() tras gesto del usuario)
    remoteAudio = document.createElement("audio");
    remoteAudio.autoplay = true;
    remoteAudio.playsInline = true;
    remoteAudio.muted = false;
    remoteAudio.volume = 1;
    document.body.appendChild(remoteAudio);

    pc.ontrack = async (e) => {
      log("🔊 Audio remoto recibido (track)");
      remoteAudio.srcObject = e.streams[0];

      // Forzar reproducción (algunos navegadores lo exigen)
      try {
        await remoteAudio.play();
        log("✅ remoteAudio.play() OK");
      } catch (err) {
        log("⚠️ remoteAudio.play() bloqueado: " + (err?.message || err));
      }
    };

    // 3) Micrófono
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
    log("🎤 Micrófono capturado");

    // 4) DataChannel
    dc = pc.createDataChannel("oai-events");
    dc.onopen = () => {
      log("🟢 DataChannel abierto");

      // Construimos prompt + saludo
      const greeting = getGreetingByTime();
      const systemPrompt = VOICE_CONFIG.buildSystemPrompt({ greeting });

      // A) Actualiza la sesión (instrucciones + modalidades)
      sendEvent({
        type: "session.update",
        session: {
          instructions: systemPrompt,
          modalities: ["audio", "text"],
        },
      });

      // B) Forzar que hable primero (esto es CLAVE)
      sendEvent({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                `Inicia la llamada saludando con: "${greeting}". ` +
                `Después pregunta en una sola frase: "¿En qué puedo ayudarte?" y espera.`,
            },
          ],
        },
      });

      // C) Pide una respuesta en AUDIO
      sendEvent({
        type: "response.create",
        response: {
          modalities: ["audio", "text"],
        },
      });

      log("➡️ Eventos enviados: session.update + greeting + response.create");
    };

    dc.onmessage = (event) => {
      // Útil para debug: ver eventos del modelo
      try {
        const data = JSON.parse(event.data);
        if (data?.type) {
          log(`📩 Event: ${data.type}`);
        }
      } catch {
        // ignore
      }
    };

    // 5) SDP Offer -> backend /session -> SDP Answer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    log("📡 Enviando SDP a /session…");
    const sdpRes = await fetch("/session", {
      method: "POST",
      headers: { "Content-Type": "application/sdp" },
      body: offer.sdp,
    });

    if (!sdpRes.ok) {
      const err = await sdpRes.text();
      throw new Error("Error /session: " + err);
    }

    const answerSdp = await sdpRes.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

    statusEl.textContent = "En llamada…";
    log("✅ Llamada establecida");
  } catch (e) {
    log("❌ Error: " + (e?.message || e));
    statusEl.textContent = "Error";
    stopCall();
  }
}

function stopCall() {
  log("🛑 Colgar pulsado");

  startBtn.disabled = false;
  stopBtn.disabled = true;

  try {
    dc?.close();
  } catch {}
  try {
    pc?.close();
  } catch {}

  localStream?.getTracks().forEach((t) => t.stop());

  if (remoteAudio) {
    remoteAudio.srcObject = null;
    remoteAudio.remove();
  }

  dc = null;
  pc = null;
  localStream = null;
  remoteAudio = null;

  statusEl.textContent = "Listo.";
  log("🔴 Llamada finalizada");
}

startBtn.onclick = startCall;
stopBtn.onclick = stopCall;
