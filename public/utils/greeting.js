/**
 * =====================================================
 * greeting.js
 * =====================================================
 * REGLA INMUTABLE DE SALUDO
 *
 * - 00:00 → 11:59  → "Buenos días"
 * - 12:00 → 23:59  → "Buenas tardes"
 *
 * La IA NO decide esto.
 * Se calcula por código.
 *
 * Importancia: ALTA
 */

export function getGreetingByTime() {
  const hour = Number(
    new Intl.DateTimeFormat("es-ES", {
      timeZone: "Atlantic/Canary",
      hour: "2-digit",
      hour12: false
    }).format(new Date())
  );

  return hour < 12 ? "Buenos días" : "Buenas tardes";
}
