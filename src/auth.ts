import { supabase } from "./sync/supabase";

// Autenticación en dos modos:
// - Con Supabase configurado (.env.local): cuentas REALES — entran desde
//   cualquier dispositivo, contraseña recuperable, datos respaldados.
// - Sin configurar: cuentas locales del dispositivo (modo desarrollo).
// La interfaz es la misma; las pantallas no saben en qué modo corren.

export interface Sesion {
  email: string;
  nombreNegocio: string;
}

/** signUp puede requerir confirmación por email según el proyecto Supabase. */
export type ResultadoRegistro = Sesion | "confirmar-email";

// --- modo local (fallback de desarrollo) ---

interface CuentaLocal {
  email: string;
  nombreNegocio: string;
  hash: string;
}

const CLAVE_CUENTAS = "kioskeo-cuentas";
const CLAVE_SESION = "kioskeo-sesion";

async function hashear(texto: string): Promise<string> {
  const datos = new TextEncoder().encode(`kioskeo:${texto}`);
  const digest = await crypto.subtle.digest("SHA-256", datos);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function leerCuentas(): CuentaLocal[] {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_CUENTAS) ?? "[]");
  } catch {
    return [];
  }
}

function validar(email: string, contrasena: string, nombreNegocio?: string) {
  if (!email.trim().toLowerCase().includes("@")) {
    throw new Error("Ese email no parece válido");
  }
  if (contrasena.length < 6) {
    throw new Error("La contraseña necesita al menos 6 caracteres");
  }
  if (nombreNegocio !== undefined && !nombreNegocio.trim()) {
    throw new Error("Contanos el nombre del negocio");
  }
}

// --- API única ---

export async function crearCuenta(
  email: string,
  contrasena: string,
  nombreNegocio: string,
): Promise<ResultadoRegistro> {
  validar(email, contrasena, nombreNegocio);
  const normalizado = email.trim().toLowerCase();
  const sb = supabase();

  if (sb) {
    const { data, error } = await sb.auth.signUp({
      email: normalizado,
      password: contrasena,
      options: { data: { nombre_negocio: nombreNegocio.trim() } },
    });
    if (error) throw new Error(traducirError(error.message));
    if (!data.session) return "confirmar-email";
    return { email: normalizado, nombreNegocio: nombreNegocio.trim() };
  }

  const cuentas = leerCuentas();
  if (cuentas.some((c) => c.email === normalizado)) {
    throw new Error("Ya existe una cuenta con ese email en este dispositivo");
  }
  const cuenta: CuentaLocal = {
    email: normalizado,
    nombreNegocio: nombreNegocio.trim(),
    hash: await hashear(contrasena),
  };
  localStorage.setItem(CLAVE_CUENTAS, JSON.stringify([...cuentas, cuenta]));
  const sesion: Sesion = { email: cuenta.email, nombreNegocio: cuenta.nombreNegocio };
  localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
  return sesion;
}

export async function iniciarSesion(
  email: string,
  contrasena: string,
): Promise<Sesion> {
  const normalizado = email.trim().toLowerCase();
  const sb = supabase();

  if (sb) {
    const { data, error } = await sb.auth.signInWithPassword({
      email: normalizado,
      password: contrasena,
    });
    if (error) throw new Error(traducirError(error.message));
    return {
      email: data.user.email ?? normalizado,
      nombreNegocio:
        (data.user.user_metadata?.nombre_negocio as string) ?? "Mi negocio",
    };
  }

  const cuenta = leerCuentas().find((c) => c.email === normalizado);
  if (!cuenta || cuenta.hash !== (await hashear(contrasena))) {
    throw new Error("Email o contraseña incorrectos");
  }
  const sesion: Sesion = { email: cuenta.email, nombreNegocio: cuenta.nombreNegocio };
  localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
  return sesion;
}

export async function sesionActual(): Promise<Sesion | null> {
  const sb = supabase();
  if (sb) {
    const { data } = await sb.auth.getSession();
    const usuario = data.session?.user;
    if (!usuario) return null;
    return {
      email: usuario.email ?? "",
      nombreNegocio:
        (usuario.user_metadata?.nombre_negocio as string) ?? "Mi negocio",
    };
  }
  try {
    return JSON.parse(localStorage.getItem(CLAVE_SESION) ?? "null");
  } catch {
    return null;
  }
}

/** Reenvía el email de confirmación de una cuenta recién creada. */
export async function reenviarConfirmacion(email: string): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  const { error } = await sb.auth.resend({
    type: "signup",
    email: email.trim().toLowerCase(),
  });
  if (error) throw new Error(traducirError(error.message));
}

/** Confirma una cuenta nueva con el código de 6 dígitos del email. */
export async function confirmarConCodigo(email: string, codigo: string): Promise<Sesion> {
  const sb = supabase();
  if (!sb) throw new Error("En modo local no hace falta código");
  const { data, error } = await sb.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: codigo.trim(),
    type: "signup",
  });
  if (error || !data.user) throw new Error(traducirError(error?.message ?? "Código inválido"));
  return {
    email: data.user.email ?? email,
    nombreNegocio: (data.user.user_metadata?.nombre_negocio as string) ?? "Mi negocio",
  };
}

/** Entra con el código del email de recuperación; después se cambia la contraseña. */
export async function entrarConCodigoRecuperacion(email: string, codigo: string): Promise<void> {
  const sb = supabase();
  if (!sb) throw new Error("En modo local no se puede recuperar la contraseña");
  const { error } = await sb.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: codigo.trim(),
    type: "recovery",
  });
  if (error) throw new Error(traducirError(error.message));
}

/** Manda el email para cambiar la contraseña (solo con Supabase). */
export async function pedirRecuperacion(email: string): Promise<void> {
  const normalizado = email.trim().toLowerCase();
  if (!normalizado.includes("@")) throw new Error("Ese email no parece válido");
  const sb = supabase();
  if (!sb) throw new Error("En modo local no se puede recuperar la contraseña");
  const { error } = await sb.auth.resetPasswordForEmail(normalizado, {
    redirectTo: window.location.origin,
  });
  if (error) throw new Error(traducirError(error.message));
}

/** true si la app se abrió desde el link de recuperación del email. */
export function hayRecuperacionEnURL(): boolean {
  const hash = window.location.hash;
  const query = new URLSearchParams(window.location.search);
  return /type=recovery/.test(hash) || query.get("type") === "recovery";
}

/** Avisa cuando Supabase procesó un link de recuperación (cualquier flujo). */
export function alRecuperarContrasena(callback: () => void): () => void {
  const sb = supabase();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((evento) => {
    if (evento === "PASSWORD_RECOVERY") callback();
  });
  return () => data.subscription.unsubscribe();
}

export async function cambiarContrasena(nueva: string): Promise<Sesion> {
  if (nueva.length < 6) throw new Error("La contraseña necesita al menos 6 caracteres");
  const sb = supabase();
  if (!sb) throw new Error("En modo local no se puede cambiar la contraseña");
  const { data, error } = await sb.auth.updateUser({ password: nueva });
  if (error) throw new Error(traducirError(error.message));
  // Limpia el token del link de la barra de direcciones.
  window.history.replaceState(null, "", window.location.pathname);
  return {
    email: data.user.email ?? "",
    nombreNegocio: (data.user.user_metadata?.nombre_negocio as string) ?? "Mi negocio",
  };
}

export async function actualizarNombreNegocio(nombre: string): Promise<void> {
  const limpio = nombre.trim();
  if (!limpio) throw new Error("El nombre no puede quedar vacío");
  const sb = supabase();
  if (sb) {
    const { error } = await sb.auth.updateUser({ data: { nombre_negocio: limpio } });
    if (error) throw new Error(traducirError(error.message));
    return;
  }
  const sesion = JSON.parse(localStorage.getItem(CLAVE_SESION) ?? "null") as Sesion | null;
  if (sesion) localStorage.setItem(CLAVE_SESION, JSON.stringify({ ...sesion, nombreNegocio: limpio }));
}

export async function cerrarSesion(): Promise<void> {
  const sb = supabase();
  if (sb) await sb.auth.signOut();
  localStorage.removeItem(CLAVE_SESION);
}

function traducirError(mensaje: string): string {
  const m = mensaje.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email o contraseña incorrectos";
  if (m.includes("already registered")) return "Ya existe una cuenta con ese email";
  if (m.includes("rate limit")) return "Demasiados intentos, esperá un minuto";
  if (m.includes("security purposes")) {
    const seg = /after (\d+) seconds/.exec(m)?.[1];
    return seg ? `Esperá ${seg} segundos antes de pedir otro email` : "Esperá un minuto antes de pedir otro email";
  }
  if (m.includes("email not confirmed")) return "Todavía no confirmaste el email: buscá el código en tu correo";
  if (m.includes("token has expired") || m.includes("otp") || m.includes("invalid")) return "Código incorrecto o vencido. Revisá el email o pedí otro.";
  if (m.includes("same password") || m.includes("different from the old")) return "Elegí una contraseña distinta a la anterior";
  if (m.includes("session") && m.includes("missing")) return "El link venció: pedí uno nuevo desde Olvidé mi contraseña";
  if (m.includes("network") || m.includes("fetch")) return "Sin conexión: probá de nuevo";
  return mensaje;
}
