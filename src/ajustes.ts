import { createContext } from "react";
import { supabase } from "./sync/supabase";

// Los interruptores del negocio: ESCONDEN pantallas y botones, jamás tocan
// un cálculo. Viajan con la cuenta (user_metadata de Supabase) para que
// todos los dispositivos del negocio obedezcan, con copia local para
// arrancar rápido y funcionar offline.

export interface Ajustes {
  /** Botón FIADO al cobrar + pestaña Fiados. */
  fiados: boolean;
  /** Pestaña Caja (apertura, retiros, cierre ciego). */
  caja: boolean;
  /** Insights del panel ("secretos del negocio"). */
  secretos: boolean;
  /** Cómo prefiere cargar productos (define qué le mostramos primero). */
  carga: "excel" | "escanear" | "mano";
  /** Bip al escanear, sonido al cobrar. */
  sonidos: boolean;
}

export const AJUSTES_DEFAULT: Ajustes = {
  fiados: true,
  caja: true,
  secretos: true,
  carga: "mano",
  sonidos: true,
};

export const AjustesContext = createContext<Ajustes>(AJUSTES_DEFAULT);

const CLAVE_LOCAL = "kioskeo-ajustes";

function normalizar(crudo: unknown): Ajustes {
  const a = (crudo ?? {}) as Partial<Ajustes>;
  return {
    fiados: a.fiados ?? AJUSTES_DEFAULT.fiados,
    caja: a.caja ?? AJUSTES_DEFAULT.caja,
    secretos: a.secretos ?? AJUSTES_DEFAULT.secretos,
    carga: a.carga ?? AJUSTES_DEFAULT.carga,
    sonidos: a.sonidos ?? AJUSTES_DEFAULT.sonidos,
  };
}

export async function guardarAjustes(ajustes: Ajustes): Promise<void> {
  localStorage.setItem(CLAVE_LOCAL, JSON.stringify(ajustes));
  const sb = supabase();
  if (sb) {
    // Si no hay red ahora, la copia local manda; el próximo guardado sube.
    try {
      await sb.auth.updateUser({ data: { ajustes } });
    } catch {
      // sin conexión: no es un error, es offline-first
    }
  }
}

export async function leerAjustes(): Promise<Ajustes> {
  const sb = supabase();
  if (sb) {
    try {
      const { data } = await sb.auth.getSession();
      const usuario = data.session?.user;
      if (usuario) {
        const remotos = usuario.user_metadata?.ajustes;
        if (remotos) {
          const ajustes = normalizar(remotos);
          localStorage.setItem(CLAVE_LOCAL, JSON.stringify(ajustes));
          return ajustes;
        }
        // Cuenta sin ajustes guardados (anterior al cuestionario): defaults.
        // NUNCA la copia local, que podría ser de otro negocio.
        return AJUSTES_DEFAULT;
      }
    } catch {
      // sin red: cae a la copia local (misma cuenta, porque el cambio de
      // cuenta borra la copia en asegurarNegocioLocal)
    }
  }
  try {
    return normalizar(JSON.parse(localStorage.getItem(CLAVE_LOCAL) ?? "null"));
  } catch {
    return AJUSTES_DEFAULT;
  }
}
