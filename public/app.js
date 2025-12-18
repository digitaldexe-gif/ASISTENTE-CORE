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
  if (!dc || dc.readyState !== "open") return;
  dc.send(JSON.stringify(payload));
}

async function startCall() {
  try {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    statusEl.textContent = "Conectando…";
    log("📞 Llamar pulsado");

    // 1) PeerConnection
    pc = new RTCPeerConnection();

    pc.onconnectionstatechange = () => {
      log(`🔁 PC state: ${pc.connectionState}`);
    };

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

      // A) Session update: deja TODO explícito (audio + voz + formato)
      sendEvent({
        type: "session.update",
        session: {
          instructions: systemPrompt,
          modalities: ["audio", "text"],
          voice: VOICE_CONFIG.voice,
          output_audio_format: "pcm16",
        },
      });

      // B) Fuerza que hable PRIMERO (sin depender de tu input)
      // Schema correcto: response.create -> response.output_modalities :contentReference[oaicite:3]{index=3}
      sendEvent({
        type: "response.create",
        response: {
          output_modalities: ["audio"],
          instructions: `Di exactamente: "${greeting}, ${VOICE_CONFIG.clinicName}, le atiende ${VOICE_CONFIG.assistantName}." Luego CALLAS.`,
          max_output_tokens: 120,
        },
      });

      log("📢 Saludo solicitado al asistente (AUDIO)");
    };

    dc.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Log básico de tipos
        if (data?.type) log(`📩 Event: ${data.type}`);

        // Log extendido del error (CLAVE para no “adivinar”)
        if (data?.type === "error") {
          const msg =
            data?.error?.message ||
            data?.message ||
            JSON.stringify(data, null, 2);
          log("❌ OpenAI ERROR: " + msg);
        }
      } catch {
        // ignore
      }
    };

    // 5) SDP offer -> /session -> answer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    log("📡 Enviando SDP a /session…");
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
    log("❌ Error: " + (e?.message || e));
    statusEl.textContent = "Error";
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
