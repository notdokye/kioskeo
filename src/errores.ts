import { supabase } from "./sync/supabase";

// Si a alguien le explota algo en el celular, nos enteramos: los errores
// no capturados se mandan a la tabla `errores` (solo lectura para admins).
// Con tope por sesión y sin repetir el mismo mensaje, para no inundar.

const TOPE = 5;
const vistos = new Set<string>();
let enviados = 0;

export async function reportarError(mensaje: string, detalle?: string): Promise<void> {
  if (enviados >= TOPE || vistos.has(mensaje)) return;
  vistos.add(mensaje);
  enviados++;
  const sb = supabase();
  if (!sb) return;
  try {
    const { data } = await sb.auth.getSession();
    if (!data.session) return;
    await sb.from("errores").insert({
      mensaje: mensaje.slice(0, 500),
      detalle: detalle?.slice(0, 4000) ?? null,
      url: window.location.href,
      agente: navigator.userAgent,
      version: import.meta.env.MODE,
    });
  } catch {
    // reportar un error jamás puede causar otro
  }
}

export function iniciarReporteDeErrores(): void {
  window.addEventListener("error", (e) => {
    reportarError(e.message || "Error sin mensaje", e.error?.stack);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const razon = e.reason;
    const mensaje = razon instanceof Error ? razon.message : String(razon);
    reportarError(mensaje, razon instanceof Error ? razon.stack : undefined);
  });
}
