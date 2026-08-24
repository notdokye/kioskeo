import { supabase } from "./sync/supabase";

// Empleados y turnos del negocio. Viajan con la cuenta (user_metadata) para
// que todos los dispositivos los vean, con copia local para arrancar rápido.
// La tardanza se calcula con matemática pura y testeada (abajo).

export interface Turno {
  /** Días de la semana: 0 = domingo … 6 = sábado (como Date.getDay). */
  dias: number[];
  /** "08:00" */
  desde: string;
  /** "14:00" */
  hasta: string;
}

export interface Empleado {
  id: string;
  nombre: string;
  turnos: Turno[];
}

export const DIAS_CORTOS = ["D", "L", "M", "X", "J", "V", "S"];
export const DIAS_LARGOS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

const CLAVE_LOCAL = "kioskeo-empleados";

export async function guardarEmpleados(empleados: Empleado[]): Promise<void> {
  localStorage.setItem(CLAVE_LOCAL, JSON.stringify(empleados));
  const sb = supabase();
  if (sb) {
    try {
      await sb.auth.updateUser({ data: { empleados } });
    } catch {
      // offline: la copia local manda, el próximo guardado sube
    }
  }
}

export async function leerEmpleados(): Promise<Empleado[]> {
  const sb = supabase();
  if (sb) {
    try {
      const { data } = await sb.auth.getSession();
      const usuario = data.session?.user;
      if (usuario) {
        const remotos = usuario.user_metadata?.empleados;
        if (Array.isArray(remotos)) {
          localStorage.setItem(CLAVE_LOCAL, JSON.stringify(remotos));
          return remotos as Empleado[];
        }
        return [];
      }
    } catch {
      // sin red: copia local
    }
  }
  try {
    const local = JSON.parse(localStorage.getItem(CLAVE_LOCAL) ?? "[]");
    return Array.isArray(local) ? local : [];
  } catch {
    return [];
  }
}

// ---------- matemática de la tardanza (pura, testeada) ----------

export function minutosDesdeHHMM(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** El turno del empleado que corresponde a ese día (o null si no trabaja). */
export function turnoDelDia(empleado: Empleado, fecha: Date): Turno | null {
  const dia = fecha.getDay();
  return empleado.turnos.find((t) => t.dias.includes(dia)) ?? null;
}

/**
 * Minutos de tardanza al abrir el turno: positivo = llegó tarde,
 * negativo = llegó antes, null = ese día no tenía turno programado.
 */
export function minutosDeTardanza(
  empleado: Empleado,
  abiertaEn: Date,
): number | null {
  const turno = turnoDelDia(empleado, abiertaEn);
  if (!turno) return null;
  const inicio = minutosDesdeHHMM(turno.desde);
  if (inicio === null) return null;
  const real = abiertaEn.getHours() * 60 + abiertaEn.getMinutes();
  return real - inicio;
}

export type Semaforo = "verde" | "amarillo" | "rojo";

/** Tolerancia acordada: hasta 20' verde, hasta 40' amarillo, más rojo. */
export function semaforoTardanza(minutos: number | null): Semaforo {
  if (minutos === null || minutos <= 20) return "verde";
  if (minutos <= 40) return "amarillo";
  return "rojo";
}

export function describirTardanza(minutos: number | null): string {
  if (minutos === null) return "sin turno programado";
  if (minutos <= 0) return "a horario";
  if (minutos <= 20) return `${minutos} min tarde · a horario`;
  return `${minutos} min tarde`;
}
