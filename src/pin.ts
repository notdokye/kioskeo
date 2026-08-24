import { supabase } from "./sync/supabase";

// PIN del dueño: 4 dígitos que protegen lo que un empleado no debería ver
// (el esperado en caja y el panel). Se guarda solo el hash, en la cuenta
// (user_metadata) y en copia local para funcionar sin internet. El
// desbloqueo dura hasta que se cierra la app.

const CLAVE_LOCAL = "kioskeo-pin";
let desbloqueado = false;

async function hashear(pin: string): Promise<string> {
  const datos = new TextEncoder().encode(`kioskeo-pin:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", datos);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function pinValido(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export async function cargarPin(): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  try {
    const { data } = await sb.auth.getSession();
    const hash = data.session?.user.user_metadata?.pin_dueno_hash;
    if (typeof hash === "string" && hash) localStorage.setItem(CLAVE_LOCAL, hash);
    else if (data.session) localStorage.removeItem(CLAVE_LOCAL);
  } catch {
    // sin red: copia local
  }
}

export function hayPin(): boolean {
  return !!localStorage.getItem(CLAVE_LOCAL);
}

/** null = sacar el PIN. */
export async function guardarPin(pin: string | null): Promise<void> {
  const hash = pin === null ? null : await hashear(pin);
  if (hash) localStorage.setItem(CLAVE_LOCAL, hash);
  else localStorage.removeItem(CLAVE_LOCAL);
  desbloqueado = true;
  const sb = supabase();
  if (sb) {
    try {
      await sb.auth.updateUser({ data: { pin_dueno_hash: hash } });
    } catch {
      // offline: la copia local manda
    }
  }
}

export async function verificarPin(pin: string): Promise<boolean> {
  const guardado = localStorage.getItem(CLAVE_LOCAL);
  if (!guardado) return true;
  const ok = (await hashear(pin)) === guardado;
  if (ok) desbloqueado = true;
  return ok;
}

export function estaDesbloqueado(): boolean {
  return !hayPin() || desbloqueado;
}

export function bloquear(): void {
  desbloqueado = false;
}
