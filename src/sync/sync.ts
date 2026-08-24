import { db, escribirConfig, leerConfig, type TablaSync } from "../db/db";

// Motor de sincronización offline-first.
//
// SUBIDA: la outbox garantiza que todo cambio local llega al servidor.
// Se sube en orden, y una entrada se borra SOLO cuando el servidor confirmó.
// Si la subida se repite (reintento tras corte), el servidor hace upsert por
// id y no duplica — la idempotencia viene de los ids únicos del core.
//
// BAJADA: se piden los cambios desde el último cursor y se aplican con `put`
// (idempotente). Las bajadas NO pasan por la outbox: lo remoto no se re-sube.

export interface FilaRemota {
  tabla: TablaSync;
  id: string;
  datos: unknown;
  actualizadoEn: string;
}

export interface BackendSync {
  /** Upsert de registros completos. Debe ser idempotente por id. */
  subir(tabla: TablaSync, registros: { id: string; datos: unknown }[]): Promise<void>;
  /**
   * Una página de cambios de UNA tabla desde el cursor (inclusive), ordenada
   * por fecha de actualización. Devuelve el cursor para la página siguiente.
   */
  bajar(
    tabla: TablaSync,
    cursor: string | null,
    limite: number,
  ): Promise<{ filas: FilaRemota[]; cursor: string | null }>;
}

export const TABLAS_SYNC: TablaSync[] = [
  "productos",
  "clientes",
  "ventas",
  "anulaciones",
  "pagosFiado",
  "cajas",
];

const LOTE = 50;
/** Tamaño de página al bajar. Se pagina hasta agotar: nunca se saltea nada. */
export const PAGINA_BAJADA = 500;

export async function pendientesDeSubida(): Promise<number> {
  return db.outbox.count();
}

export async function empujar(backend: BackendSync): Promise<number> {
  let subidos = 0;
  // Lotes chicos y en orden: si se corta a mitad, lo confirmado ya no se repite.
  for (;;) {
    const lote = await db.outbox.orderBy("seq").limit(LOTE).toArray();
    if (lote.length === 0) break;

    const porTabla = new Map<TablaSync, Set<string>>();
    for (const item of lote) {
      if (!porTabla.has(item.tabla)) porTabla.set(item.tabla, new Set());
      porTabla.get(item.tabla)!.add(item.registroId);
    }

    for (const [tabla, ids] of porTabla) {
      const registros = (await db.table(tabla).bulkGet([...ids]))
        .filter((r): r is NonNullable<typeof r> => r !== undefined)
        .map((r) => ({ id: (r as { id: string }).id, datos: r }));
      if (registros.length > 0) {
        await backend.subir(tabla, registros);
      }
    }

    // Recién acá, con el servidor confirmado, se limpia la cola.
    await db.outbox.bulkDelete(lote.map((i) => i.seq!));
    subidos += lote.length;
  }
  return subidos;
}

/**
 * Baja TODO lo nuevo de cada tabla, página por página, con un cursor
 * propio por tabla. Así una tabla grande (miles de ventas) jamás queda a
 * medio bajar ni hace saltear filas de otra.
 */
export async function traer(backend: BackendSync): Promise<number> {
  let total = 0;
  for (const tabla of TABLAS_SYNC) {
    const clave = `sync-cursor:${tabla}`;
    let cursor = await leerConfig(clave);
    for (let pagina = 0; pagina < 200; pagina++) {
      const { filas, cursor: siguiente } = await backend.bajar(tabla, cursor, PAGINA_BAJADA);
      for (const fila of filas) {
        await db.table(fila.tabla).put(fila.datos);
      }
      total += filas.length;
      if (siguiente) await escribirConfig(clave, siguiente);
      // Última página: menos filas que el límite, o no avanzó el cursor.
      if (filas.length < PAGINA_BAJADA || siguiente === cursor) break;
      cursor = siguiente;
    }
  }
  return total;
}

export interface EstadoSync {
  ultimoIntento: string | null;
  ultimoExito: string | null;
  error: string | null;
  pendientes: number;
}

const estado: EstadoSync = {
  ultimoIntento: null,
  ultimoExito: null,
  error: null,
  pendientes: 0,
};

export function estadoSync(): EstadoSync {
  return { ...estado };
}

let sincronizando = false;

export async function sincronizar(backend: BackendSync): Promise<void> {
  if (sincronizando) return;
  sincronizando = true;
  estado.ultimoIntento = new Date().toISOString();
  try {
    await empujar(backend);
    await traer(backend);
    estado.ultimoExito = new Date().toISOString();
    estado.error = null;
  } catch (e) {
    // Sin drama: la outbox conserva lo pendiente y el próximo intento reintenta.
    estado.error = e instanceof Error ? e.message : String(e);
  } finally {
    estado.pendientes = await pendientesDeSubida();
    sincronizando = false;
  }
}

/** Arranca el ciclo: al volver la conexión, al volver a la app, y cada tanto. */
export function iniciarSync(backend: BackendSync, intervaloMs = 20000): () => void {
  const correr = () => void sincronizar(backend);
  const alVolverVisible = () => {
    if (document.visibilityState === "visible") correr();
  };
  window.addEventListener("online", correr);
  document.addEventListener("visibilitychange", alVolverVisible);
  const timer = setInterval(correr, intervaloMs);
  correr();
  return () => {
    window.removeEventListener("online", correr);
    document.removeEventListener("visibilitychange", alVolverVisible);
    clearInterval(timer);
  };
}
