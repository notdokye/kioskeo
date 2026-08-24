import { supabase } from "./sync/supabase";

// Suscripción del negocio. El servidor es la única fuente de verdad (la
// app no puede escribirla); acá se guarda una copia local con la hora del
// servidor al momento de leerla, para que la decisión de bloquear funcione
// sin internet y no dependa del reloj del celular.

export interface Suscripcion {
  /** "YYYY-MM-DD": último día incluido. */
  venceEl: string;
  graciaDias: number;
  plan: string;
  /** ISO: hora del servidor cuando se leyó. */
  horaServidor: string;
  /** Date.now() local cuando se leyó. */
  leidoEn: number;
}

export type EstadoSuscripcion = "desconocida" | "activa" | "por_vencer" | "gracia" | "bloqueada";

export interface Resumen {
  estado: EstadoSuscripcion;
  /** Días hasta el vencimiento: 0 = vence hoy, negativo = ya venció. */
  dias: number;
  venceEl: string | null;
  prueba: boolean;
}

const CLAVE_LOCAL = "kioskeo-suscripcion";
export const DIAS_AVISO = 5;

function diaLocal(fecha: Date): number {
  return Math.floor(
    new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime() / 86400000,
  );
}

function diaDesdeISO(yyyyMMdd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(yyyyMMdd);
  if (!m) return null;
  return diaLocal(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** "Ahora" que nunca es anterior a la última hora del servidor vista. */
export function ahoraEfectivo(s: Suscripcion, ahora: Date): Date {
  const servidor = new Date(s.horaServidor).getTime();
  if (!Number.isFinite(servidor)) return ahora;
  // La hora del servidor más el tiempo local transcurrido desde que se leyó.
  const estimado = servidor + Math.max(0, ahora.getTime() - s.leidoEn);
  return new Date(Math.max(ahora.getTime(), estimado));
}

export function calcularEstado(s: Suscripcion | null, ahora: Date = new Date()): Resumen {
  if (!s) return { estado: "desconocida", dias: 0, venceEl: null, prueba: false };
  const vence = diaDesdeISO(s.venceEl);
  if (vence === null) return { estado: "desconocida", dias: 0, venceEl: null, prueba: false };
  const hoy = diaLocal(ahoraEfectivo(s, ahora));
  const dias = vence - hoy;
  const prueba = s.plan === "prueba";
  let estado: EstadoSuscripcion;
  if (dias > DIAS_AVISO) estado = "activa";
  else if (dias >= 0) estado = "por_vencer";
  else if (dias >= -s.graciaDias) estado = "gracia";
  else estado = "bloqueada";
  return { estado, dias, venceEl: s.venceEl, prueba };
}

export function leerSuscripcionLocal(): Suscripcion | null {
  try {
    const s = JSON.parse(localStorage.getItem(CLAVE_LOCAL) ?? "null");
    return s && typeof s.venceEl === "string" ? (s as Suscripcion) : null;
  } catch {
    return null;
  }
}

export function olvidarSuscripcionLocal(): void {
  localStorage.removeItem(CLAVE_LOCAL);
}

/**
 * Pide el estado al servidor y lo guarda. Sin red o sin Supabase, devuelve
 * la copia local (o null): la app nunca se bloquea por no poder consultar.
 */
export async function refrescarSuscripcion(): Promise<Suscripcion | null> {
  const sb = supabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb.rpc("estado_suscripcion");
    if (error || !data) return leerSuscripcionLocal();
    const d = data as { vence_el: string; gracia_dias: number; plan: string; ahora: string };
    const s: Suscripcion = {
      venceEl: d.vence_el,
      graciaDias: d.gracia_dias ?? 3,
      plan: d.plan ?? "mensual",
      horaServidor: d.ahora,
      leidoEn: Date.now(),
    };
    localStorage.setItem(CLAVE_LOCAL, JSON.stringify(s));
    return s;
  } catch {
    return leerSuscripcionLocal();
  }
}

export function describirVencimiento(venceEl: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(venceEl);
  if (!m) return venceEl;
  return `${Number(m[3])}/${Number(m[2])}`;
}
