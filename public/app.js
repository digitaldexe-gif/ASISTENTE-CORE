/**
 * =====================================================
 * app.js
 * =====================================================
 * Frontend WebRTC para OpenAI Realtime (audio real)
 * - Captura micrófono
 * - Reproduce audio remoto del asistente
 * - Fuerza saludo hablado al iniciar llamada
 *
 * CLAVE:
 * - NO usar response.output_modalities (te da Unknown parameter)
 * - Usar response.modalities
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

    // 1) PeerConnection
    pc = new RTCPeerConnection();

    // 2) Audio remoto
    remoteAudio = document.createElement("audio");
    remoteAudio.autoplay = true;
    remoteAudio.playsInline = true;
    remoteAudio.muted = false;
    remoteAudio.volume = 1;
    document.body.appendChild(remoteAudio);

    pc.ontrack = async (e) => {
      log("🔊 Audio remoto recibido (track)");
      remoteAudio.srcObject = e.streams[0];

      // Intentar play() (gesture ya ocurrió al pulsar "Llamar")
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

      const greeting = getGreetingByTime();
      const systemPrompt = VOICE_CONFIG.buildSystemPrompt({ greeting });

      // A) Ajustar sesión (instrucciones)
      // Nota: aquí NO meto output_modalities para evitar sorpresas;
      // el audio ya viene por la pista remota si la sesión fue creada con voz.
      sendEvent({
        type: "session.update",
        session: {
          instructions: systemPrompt,
        },
      });

      // B) Crear item "user" que ordena el saludo EXACTO
      sendEvent({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                `Di exactamente: "${greeting}, ${VOICE_CONFIG.clinicName}, le atiende ${VOICE_CONFIG.assistantName}." ` +
                `Luego quédate en silencio y espera.`,
            },
          ],
        },
      });

      // C) Pedir respuesta en AUDIO (✅ usar modalities, no output_modalities)
      sendEvent({
        type: "response.create",
        response: {
          modalities: ["audio", "text"],
          // opcional: si quieres forzar un poco más:
          // instructions: systemPrompt,
        },
      });

      log("📢 Saludo solicitado al asistente (AUDIO)");
    };

    dc.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.type) log(`📩 Event: ${data.type}`);

        // Si quieres ver el error exacto cuando haya "Event: error"
        if (data?.type === "error") {
          log("❌ OpenAI error payload: " + JSON.stringify(data, null, 2));
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

  pc = null;
  dc = null;
  localStream = null;
  remoteAudio = null;

  statusEl.textContent = "Listo.";
  log("🔴 Llamada finalizada");
}

startBtn.onclick = startCall;
stopBtn.onclick = stopCall;
