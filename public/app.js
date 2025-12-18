/**
 * =====================================================
 * app.js (DEBUG PROFUNDO)
 * =====================================================
 * Frontend WebRTC para OpenAI Realtime
 * - Captura micrófono
 * - Reproduce audio remoto
 * - Instrumentación completa para depurar audio
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
let audioTrack = null;
let statsInterval = null;

function log(msg, obj) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logEl.textContent += line + "\n";
  logEl.scrollTop = logEl.scrollHeight;
  console.log(line, obj ?? "");
}

function sendEvent(payload) {
  if (dc && dc.readyState === "open") {
    dc.send(JSON.stringify(payload));
    log("➡️ Enviado a OpenAI", payload);
  }
}

async function startCall() {
  try {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    statusEl.textContent = "Conectando…";

    log("📞 Llamar pulsado");

    // ===============================
    // 1) RTCPeerConnection
    // ===============================
    pc = new RTCPeerConnection();

    pc.onconnectionstatechange = () =>
      log("🌐 PC state:", pc.connectionState);

    pc.oniceconnectionstatechange = () =>
      log("🧊 ICE state:", pc.iceConnectionState);

    // ===============================
    // 2) Audio remoto
    // ===============================
    remoteAudio = document.createElement("audio");
    remoteAudio.autoplay = true;
    remoteAudio.playsInline = true;
    remoteAudio.muted = false;
    remoteAudio.volume = 1;
    document.body.appendChild(remoteAudio);

    pc.ontrack = async (e) => {
      audioTrack = e.track;
      log("🔊 Track remoto recibido", {
        kind: audioTrack.kind,
        enabled: audioTrack.enabled,
        muted: audioTrack.muted,
        readyState: audioTrack.readyState,
      });

      remoteAudio.srcObject = e.streams[0];

      try {
        await remoteAudio.play();
        log("✅ remoteAudio.play() OK");
      } catch (err) {
        log("❌ remoteAudio.play() FALLÓ", err);
      }

      // ===============================
      // STATS DE AUDIO (CLAVE)
      // ===============================
      statsInterval = setInterval(async () => {
        const stats = await pc.getStats();
        stats.forEach((r) => {
          if (r.type === "inbound-rtp" && r.kind === "audio") {
            log("📊 Audio stats", {
              packetsReceived: r.packetsReceived,
              bytesReceived: r.bytesReceived,
              audioLevel: r.audioLevel,
            });
          }
        });
      }, 1000);
    };

    // ===============================
    // 3) Micrófono
    // ===============================
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
    log("🎤 Micrófono capturado");

    // ===============================
    // 4) DataChannel
    // ===============================
    dc = pc.createDataChannel("oai-events");

    dc.onopen = () => {
      log("🟢 DataChannel abierto");

      const greeting = getGreetingByTime();
      const systemPrompt = VOICE_CONFIG.buildSystemPrompt({ greeting });

      sendEvent({
        type: "session.update",
        session: {
          instructions: systemPrompt,
        },
      });

      sendEvent({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Di exactamente: "${greeting}, ${VOICE_CONFIG.clinicName}, le atiende ${VOICE_CONFIG.assistantName}."`,
            },
          ],
        },
      });

      sendEvent({
        type: "response.create",
        response: {
          modalities: ["audio", "text"],
        },
      });

      log("📢 Saludo solicitado (AUDIO)");
    };

    dc.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        log("📩 Evento OpenAI", data);

        if (data.type === "error") {
          log("❌ ERROR OPENAI", data);
        }
      } catch (e) {
        log("⚠️ Mensaje no JSON", event.data);
      }
    };

    // ===============================
    // 5) SDP
    // ===============================
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    log("📡 Enviando SDP a /session");

    const sdpRes = await fetch("/session", {
      method: "POST",
      headers: { "Content-Type": "application/sdp" },
      body: offer.sdp,
    });

    if (!sdpRes.ok) throw new Error(await sdpRes.text());

    const answerSdp = await sdpRes.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

    statusEl.textContent = "En llamada…";
    log("✅ Llamada establecida");
  } catch (e) {
    log("❌ Error fatal", e);
    stopCall();
  }
}

function stopCall() {
  log("🛑 Colgar pulsado");

  clearInterval(statsInterval);

  startBtn.disabled = false;
  stopBtn.disabled = true;

  try { dc?.close(); } catch {}
  try { pc?.close(); } catch {}

  localStream?.getTracks().forEach((t) => t.stop());

  if (remoteAudio) {
    remoteAudio.srcObject = null;
    remoteAudio.remove();
  }

  pc = dc = localStream = remoteAudio = audioTrack = null;
  statusEl.textContent = "Listo.";
  log("🔴 Llamada finalizada");
}

startBtn.onclick = startCall;
stopBtn.onclick = stopCall;
