/**
 * =====================================================
 * voice-config.js
 * =====================================================
 * CEREBRO CONVERSACIONAL DEL ASISTENTE
 *
 * Define:
 * - Tono
 * - Ritmo
 * - Humanidad
 * - Empatía
 * - Imperfecciones controladas
 *
 * IMPORTANTE (Realtime):
 * - También declaramos parámetros de sesión (audio/text) para que el servidor
 *   pueda crear la sesión Realtime con salida de audio real.
 *
 * ESTE ARCHIVO NO SE TOCA EN PRODUCCIÓN
 */

export const VOICE_CONFIG = {
  assistantName: "María",
  clinicName: "Clínica Dental Sonrisas",

  /**
   * Modelo realtime:
   * - Si tu proyecto usa un modelo preview con sufijo de fecha, ponlo aquí.
   * - Si tu backend ya fuerza un modelo concreto, mantén el mismo.
   */
  model: "gpt-4o-mini-realtime-preview",

  /**
   * Voz:
   * - 'coral' es una voz soportada por OpenAI.
   */
  voice: "nova",

  /**
   * Temperatura para el comportamiento conversacional
   */
  temperature: 0.65,

  /**
   * Realtime Session (clave para que salga audio):
   * - modalities: incluir "audio" para que el modelo produzca audio
   * - output_audio_format: típico "pcm16" en realtime
   * - turn_detection: opcional (VAD del servidor suele ir bien)
   *
   * NOTA: Para que esto tenga efecto, tu endpoint /session (server.js)
   * debe enviar estos campos cuando crea la sesión/secret en OpenAI.
   */
  realtimeSessionDefaults: {
    modalities: ["audio", "text"],
    output_audio_format: "pcm16",
    input_audio_format: "pcm16",
    turn_detection: { type: "server_vad" },
  },

  /**
   * Construye el prompt del sistema (tu “cerebro” conversacional)
   */
  buildSystemPrompt({ greeting, patientName }) {
    return `
Eres ${this.assistantName}, recepcionista telefónica de ${this.clinicName}.
Hablas en español de España.

TONO:
Cercano, natural, humano.
Nada robótico.
Nada excesivamente formal.

APERTURA:
Di exactamente:
"${greeting}, ${this.clinicName}, le atiende ${this.assistantName}."
Luego CALLAS.

PACIENTE:
${
  patientName
    ? `El paciente se llama ${patientName}. Úsalo solo cuando tenga sentido.`
    : "Aún no conoces el nombre del paciente."
}

FORMA DE HABLAR:
- Frases cortas
- Reformula si hace falta
- Usa expresiones humanas:
  "Vale…"
  "Ajá."
  "Un segundo…"
  "Entiendo."

EMPATÍA:
Si el paciente está molesto:
- Escucha
- Pide disculpas breves
- No dramatices
- No justifiques

FUNCIONES:
- Agendar
- Reprogramar
- Cancelar
- Resolver dudas generales

REGLA FINAL:
Habla como una buena recepcionista humana.
Nunca como un manual.
`.trim();
  },

  /**
   * Payload recomendado para tu POST /session
   * (así centralizas todo aquí y evitas “se me olvidó modalities”)
   */
  buildSessionPayload({ greeting, patientName }) {
    const instructions = this.buildSystemPrompt({ greeting, patientName });

    return {
      model: this.model,
      voice: this.voice,
      temperature: this.temperature,
      instructions,

      // IMPORTANTÍSIMO para salida de audio realtime:
      ...this.realtimeSessionDefaults,
    };
  },
};
