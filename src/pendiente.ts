import type { Ajustes } from "./ajustes";

// Registro a medio confirmar. Safari recarga la página cuando el usuario
// vuelve de Gmail con el código: si esto no se guarda, la app arranca en la
// landing y el código no tiene dónde ir.

export interface Pendiente {
  email: string;
  ajustes?: Ajustes;
  creadoEn: number;
}

const CLAVE = "kioskeo-pendiente";
const VIGENCIA_MS = 24 * 60 * 60 * 1000;

export function guardarPendiente(p: Omit<Pendiente, "creadoEn">): void {
  localStorage.setItem(CLAVE, JSON.stringify({ ...p, creadoEn: Date.now() }));
}

export function leerPendiente(): Pendiente | null {
  try {
    const p = JSON.parse(localStorage.getItem(CLAVE) ?? "null") as Pendiente | null;
    if (!p || typeof p.email !== "string") return null;
    if (Date.now() - p.creadoEn > VIGENCIA_MS) {
      borrarPendiente();
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

export function borrarPendiente(): void {
  localStorage.removeItem(CLAVE);
}
